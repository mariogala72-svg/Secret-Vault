# 07 — Pseudo-codice dei componenti chiave

Pseudo-codice in stile TypeScript. Le primitive crittografiche fanno riferimento a librerie reali (WebCrypto, libsodium, hash-wasm, tlock-js, shamir-secret-sharing); i nomi delle funzioni di supporto sono indicativi.

## 1. Doppia autenticazione

### 1.1 Login (server)

```ts
// POST /auth/login
async function login(req: { email: string; password: string; totp?: string }, ctx) {
  await rateLimit(`login:ip:${ctx.ipPrefix}`, { max: 20, window: '15m' });
  await rateLimit(`login:acct:${hmac(req.email)}`, { max: 5, window: '15m' });

  const user = await db.user.findUnique({ where: { email_bidx: blindIndex(normalizeEmail(req.email)) } });
  // Verifica anche se l'utente non esiste, per tempi costanti
  const ok = await argon2.verify(user?.password_hash ?? DUMMY_HASH, req.password + PEPPER);
  if (!user || !ok || user.status !== 'ACTIVE') {
    await audit('LOGIN_FAILED', { userId: user?.id, ip: ctx.ipPrefix });
    throw Unauthorized('Email o password non corretti');
  }

  if (await hasMfa(user.id)) {
    const pending = await createSession(user.id, { mfaPassed: false, ttl: '5m' });
    return { mfaRequired: true, cookie: pending };     // l'unico endpoint accessibile sarà /auth/mfa
  }
  const session = await createSession(user.id, { mfaPassed: true, ttl: '12h', idle: '30m' });
  await audit('LOGIN', { userId: user.id, ip: ctx.ipPrefix });
  await notifyIfNewDevice(user, ctx);
  return { cookie: session };                          // __Host-sid; HttpOnly; Secure; SameSite=Lax
}
```

### 1.2 Creazione cassaforte (client)

```ts
async function createVault(vaultPassword: string, loginPassword: string) {
  if (vaultPassword === loginPassword) throw new UserError('Usa una password diversa da quella di accesso');
  if (zxcvbn(vaultPassword).score < 3)  throw new UserError('Scegli una password più robusta');

  const salt = randomBytes(16);
  const kekPwd = await argon2id(vaultPassword, salt, { m: 65536, t: 3, p: 1, len: 32 });

  const recoveryEntropy = randomBytes(32);
  const recoveryWords   = bip39.entropyToMnemonic(recoveryEntropy, ITALIAN_OR_ENGLISH_WORDLIST);
  const kekRec = hkdf(recoveryEntropy, 'sv:v1:recovery-kek');

  const { publicKey, privateKey } = sodium.crypto_box_keypair();   // X25519
  const payload = {
    kdf_salt: salt,
    kdf_params: { alg: 'argon2id', m: 65536, t: 3, p: 1 },
    public_key: publicKey,
    enc_private_key_pwd:      aeadSeal(kekPwd, privateKey, aad('vault', userId, 'sk-pwd')),
    enc_private_key_recovery: aeadSeal(kekRec, privateKey, aad('vault', userId, 'sk-rec')),
    verifier: hmac(kekPwd, 'vault-verifier'),
  };
  await api.post('/vault', payload);

  wipe(kekPwd, kekRec, recoveryEntropy);
  return { recoveryWords, session: new VaultSession(privateKey, publicKey) }; // mostra le 24 parole
}
```

### 1.3 Sblocco cassaforte (client + server)

```ts
// CLIENT
async function unlockVault(vaultPassword: string): Promise<VaultSession> {
  const v = await api.get('/vault/keys');               // richiede sessione valida (+ mfaPassed)
  const kek = await argon2id(vaultPassword, v.kdf_salt, v.kdf_params);
  try {
    const sk = aeadOpen(kek, v.enc_private_key_pwd, aad('vault', userId, 'sk-pwd'));
    await api.post('/vault/unlock-result', { ok: true });
    return new VaultSession(sk, v.public_key, { idleTimeout: 10 * 60_000 }); // solo in memoria
  } catch {
    await api.post('/vault/unlock-result', { ok: false });
    throw new UserError('Password non corretta');
  } finally {
    wipe(kek);
  }
}

// SERVER — GET /vault/keys
async function getVaultKeys(ctx) {
  requireSession(ctx, { mfaPassed: true });
  const vault = await db.vault.findUnique({ where: { user_id: ctx.userId } });
  if (vault.locked_until && vault.locked_until > now()) throw TooManyRequests(vault.locked_until);
  await rateLimit(`vault-keys:${ctx.userId}`, { max: 10, window: '15m' });
  return pick(vault, ['kdf_salt', 'kdf_params', 'public_key', 'enc_private_key_pwd']);
}

// SERVER — POST /vault/unlock-result
async function unlockResult(ctx, { ok }) {
  if (ok) {
    await db.vault.update({ where: { user_id: ctx.userId }, data: { failed_unlocks: 0 } });
    return audit('VAULT_UNLOCK', { userId: ctx.userId });
  }
  const v = await db.vault.update({ where: { user_id: ctx.userId }, data: { failed_unlocks: { increment: 1 } } });
  if (v.failed_unlocks % 5 === 0) {
    const minutes = 15 * 2 ** (v.failed_unlocks / 5 - 1);       // 15, 30, 60…
    await db.vault.update({ where: { user_id: ctx.userId }, data: { locked_until: addMinutes(now(), minutes) } });
    await notifyOwner(ctx.userId, 'VAULT_UNLOCK_LOCKED');
  }
  await audit('VAULT_UNLOCK_FAILED', { userId: ctx.userId });
}
```

> Nota: `unlock-result` è autodichiarato dal client, quindi non è una barriera contro un attaccante che usa direttamente l'API; la barriera reale è il rate limit su `GET /vault/keys` + Argon2id. Serve per audit e per avvisare il titolare.

## 2. Creazione di un messaggio (client)

```ts
async function createMessage(vs: VaultSession, draft: Draft) {
  const messageId = uuidv7();
  const dek = randomBytes(32);

  const enc_title = aesGcmEncrypt(dek, utf8(draft.title), aad('message', messageId, 'title', 1));
  const enc_body  = aesGcmEncrypt(dek, utf8(JSON.stringify(draft.tiptapJson)), aad('message', messageId, 'body', 1));

  const attachments = [];
  for (const file of draft.files) {
    assertAllowed(file);                                   // estensione + magic bytes + dimensione
    const fileKey = hkdf(dek, `sv:v1:attachment:${file.id}`);
    const { uploadUrls, storageKey } = await api.post('/attachments/upload-url', { size: file.size });
    await uploadEncryptedChunks(file, fileKey, uploadUrls); // libsodium secretstream, chunk 1 MiB
    attachments.push({ id: file.id, storageKey,
      enc_meta: aesGcmEncrypt(dek, json({ name: file.name, mime: file.type, sha256: await sha256(file) }),
                              aad('attachment', file.id, 'meta', 1)) });
  }

  const deliveries = await Promise.all(draft.recipients.map(r => buildDelivery(dek, r, draft.trigger, messageId)));

  await api.post('/messages', {
    id: messageId, enc_title, enc_body,
    owner_wrapped_dek: sodium.crypto_box_seal(dek, vs.publicKey),
    attachments, trigger: draft.trigger, deliveries,
  });
  wipe(dek);
}

async function buildDelivery(dek, r: Recipient, trigger: Trigger, messageId: string) {
  const base = { channel: r.channel, email: r.email, phone: r.phone, name: r.name, locale: r.locale, timezone: r.tz };

  if (r.linkedUserPublicKey)                                         // L1
    return { ...base, key_mode: 'DIRECT_PUBKEY', wrapped_dek: sodium.crypto_box_seal(dek, r.linkedUserPublicKey) };

  const code = generateAccessCode();                                 // 100 bit, Crockford base32, 5×4 caratteri
  const salt = randomBytes(16);
  const codeKey = await argon2id(normalizeCode(code), salt, { m: 65536, t: 3, p: 1 });
  const wrapped_dek = aesGcmEncrypt(codeKey, dek, aad('delivery', messageId, r.id, 'dek'));
  const out: any = { ...base, wrapped_dek, code_kdf_salt: salt };

  if (r.codeMode === 'SENDER_SHARES') {                              // L2
    out.key_mode = 'SENDER_SHARES_CODE';
    ui.showCodeToOwner(r, code);                                     // "Copia / Stampa"
  } else if (trigger.kind === 'FIXED_DATE') {                        // L3 timelock
    const round = drand.roundAt(trigger.fireAt);
    out.key_mode = 'ESCROW_TIMELOCK';
    out.escrow = { tlock_round: round, tlock_ciphertext: await tlock.encrypt(round, utf8(code)) };
  } else if (trigger.kind === 'MANUAL') {                            // L3 senza timelock
    out.key_mode = 'ESCROW_TIMELOCK';
    out.escrow = { tlock_round: null, tlock_ciphertext: sealToServerReleaseKey(utf8(code)) };
  } else {                                                           // L3 decesso: Shamir
    const execs = await api.get('/executors?status=ACCEPTED');       // con public_key
    const t = execs.quorum + 1;
    const shares = await shamir.split(utf8(code), execs.length + 1, t);
    out.key_mode = 'ESCROW_SHAMIR';
    out.escrow = {
      shamir_threshold: t,
      server_share: sealToServerReleaseKey(shares[0]),
      executor_shares: execs.map((e, i) => ({ executorId: e.id, sealed: sodium.crypto_box_seal(shares[i + 1], e.publicKey) })),
    };
  }
  wipe(codeKey);
  return out;
}
```

## 3. Scheduler di invio

### 3.1 Sweeper (ogni 60 s, N istanze in parallelo)

```ts
async function sweepDueDeliveries() {
  const BATCH = 200;
  while (true) {
    const ids = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT d.id FROM delivery d
        JOIN message m ON m.id = d.message_id
        WHERE d.status = 'PENDING'
          AND d.due_at <= now()
          AND m.status IN ('SCHEDULED','ARMED','RELEASING')
        ORDER BY d.due_at
        LIMIT ${BATCH}
        FOR UPDATE OF d SKIP LOCKED`;
      if (rows.length === 0) return [];
      await tx.$executeRaw`UPDATE delivery SET status='QUEUED', updated_at=now() WHERE id = ANY(${rows.map(r => r.id)})`;
      await tx.$executeRaw`UPDATE message SET status='RELEASING' WHERE id IN (SELECT message_id FROM delivery WHERE id = ANY(${rows.map(r => r.id)}))`;
      return rows.map(r => r.id);
    });
    if (ids.length === 0) break;
    // jobId = deliveryId → BullMQ deduplica se lo stesso id viene accodato due volte
    await releaseQueue.addBulk(ids.map(id => ({ name: 'release', data: { deliveryId: id }, opts: { jobId: `release:${id}` } })));
    metrics.gauge('sweeper.batch', ids.length);
  }
  await requeueStuck();   // QUEUED da > 15 min senza job attivo → ri-accoda (recupero da crash Redis)
  metrics.gauge('sweeper.lag_seconds', await oldestPendingDueLag());   // alert se > 300 s
}
```

### 3.2 Release Worker

```ts
releaseQueue.process(async ({ deliveryId }) => {
  const d = await db.delivery.findUnique({ where: { id: deliveryId }, include: { message: { include: { vault: { include: { user: true } } } }, escrow: true } });
  if (d.status !== 'QUEUED') return;                                   // idempotenza

  let code: Uint8Array | null = null;
  try {
    switch (d.key_mode) {
      case 'DIRECT_PUBKEY':
      case 'SENDER_SHARES_CODE':
        break;                                                         // la notifica non contiene codice
      case 'ESCROW_TIMELOCK':
        code = d.escrow.tlock_round
          ? await tlock.decrypt(await kms.decrypt(RELEASE_KEY, d.escrow.tlock_ciphertext))  // fallisce se il round non è ancora pubblicato
          : await kms.decrypt(RELEASE_KEY, d.escrow.tlock_ciphertext);
        break;
      case 'ESCROW_SHAMIR': {
        const caseRow = await db.death_case.findFirst({ where: { owner_id: d.message.vault.user_id, status: 'CONFIRMED' } });
        if (!caseRow) throw new FatalError('Shamir release without confirmed death case');   // difesa in profondità
        const serverShare = await kms.decrypt(RELEASE_KEY, d.escrow.server_share_kms);
        const execShares  = await loadConfirmedExecutorShares(caseRow.id, d.id);   // decifrati con KMS
        if (execShares.length + 1 < d.escrow.shamir_threshold) throw new FatalError('Threshold not met');
        code = await shamir.combine([serverShare, ...execShares]);
        break;
      }
    }

    const sender = d.message.vault.user;
    const isPostMortem = sender.status === 'DECEASED';
    const notifications = renderNotifications(d, { senderName: sender.display_name, code, isPostMortem });
    // Canali separati: link via email, codice via SMS (se entrambi disponibili)

    const notBefore = nextAllowedLocalTime(now(), d.recipient_timezone, isPostMortem ? { from: 8, to: 22 } : null);

    await db.$transaction(async tx => {
      for (const n of notifications) {
        await tx.notification_outbox.create({ data: {
          id: uuidv7(), delivery_id: d.id, channel: n.channel,
          idempotency_key: `${d.id}:${n.channel}:1`,
          sealed_payload: await kms.encrypt(OUTBOX_KEY, json(n)) } });
      }
      await tx.delivery.update({ where: { id: d.id }, data: { status: 'RELEASED', released_at: now(), next_attempt_at: notBefore } });
      await tx.key_escrow.update({ where: { delivery_id: d.id }, data: reserveOrDestroy(d) });  // riserva 90 gg o distruzione
      await tx.audit_log.create(auditRow('DELIVERY_RELEASED', { targetId: d.id, actor: 'SYSTEM' }));
    });
    await notifyQueue.add('notify', { deliveryId: d.id }, { jobId: `notify:${d.id}:1`, delay: notBefore - now() });
  } catch (e) {
    if (e instanceof TlockRoundNotReached) return reschedule(d, '+5m');
    if (e instanceof FatalError) { await markFailedAndAlert(d, e); return; }
    throw e;                                                           // BullMQ: retry con backoff
  } finally {
    if (code) sodium.memzero(code);
  }
});
```

### 3.3 Notification Worker

```ts
notifyQueue.process(async ({ deliveryId }) => {
  const pending = await db.notification_outbox.findMany({ where: { delivery_id: deliveryId, processed_at: null } });
  for (const item of pending) {
    const n = JSON.parse(await kms.decrypt(OUTBOX_KEY, item.sealed_payload));
    const provider = pickProvider(item.channel, attemptNumber(item));   // Resend→SES, Twilio→Vonage
    try {
      const res = await provider.send(n, { idempotencyKey: item.idempotency_key });
      await db.$transaction([
        db.delivery_attempt.create({ data: { delivery_id: deliveryId, channel: item.channel, provider: provider.name, provider_msg_id: res.id, status: 'ACCEPTED' } }),
        db.notification_outbox.update({ where: { id: item.id }, data: { processed_at: now(), sealed_payload: EMPTY } }), // il codice non resta a DB
      ]);
    } catch (err) {
      await db.delivery_attempt.create({ data: { delivery_id: deliveryId, channel: item.channel, provider: provider.name, status: 'FAILED', error_code: classify(err) } });
      if (isPermanent(err)) { await tryAlternativeChannel(deliveryId, item); continue; }
      throw err;                                                       // retry: 1m, 5m, 30m, 2h, 12h, 24h (+ jitter)
    }
  }
  await db.delivery.updateMany({ where: { id: deliveryId, status: 'RELEASED' }, data: { status: 'SENT' } });
  await maybeCompleteMessage(deliveryId);                              // DELIVERED / PARTIALLY_DELIVERED
});

notifyQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= MAX_ATTEMPTS) await escalate(job.data.deliveryId);  // titolare (se vivo) o esecutori + alert ops
});

// Webhook provider (firma verificata): delivered / bounced / complained
async function onProviderWebhook(evt) {
  const attempt = await db.delivery_attempt.findFirst({ where: { provider_msg_id: evt.messageId } });
  await db.delivery_attempt.create({ data: { ...attempt, id: undefined, status: evt.status, attempted_at: now() } });
  if (evt.status === 'BOUNCED') await retryOnOtherProviderOrChannel(attempt.delivery_id);
}
```

## 4. Integrazione necrologio e verifica decesso (con fallback)

### 4.1 Dead-man switch (ogni ora)

```ts
async function deadManSwitchTick() {
  const due = await db.death_switch.findMany({ where: { enabled: true, next_due_at: { lte: now() } } });
  for (const s of due) {
    const overdue = now() - s.next_due_at;
    if (overdue < s.grace_period) {
      const step = Math.floor(overdue / days(7));                     // un sollecito a settimana
      if (step >= s.reminders_sent) {
        await sendCheckinReminder(s.user_id, { channels: escalateChannels(step) });  // email → +SMS → +push
        await db.death_switch.update({ where: { user_id: s.user_id }, data: { reminders_sent: step + 1 } });
      }
    } else {
      await openDeathCase(s.user_id, 'CHECKIN_MISSED', 0.5);
    }
  }
}

async function checkIn(userId: string) {     // clic su link firmato o login
  const s = await db.death_switch.findUnique({ where: { user_id: userId } });
  await db.death_switch.update({ where: { user_id: userId },
    data: { last_checkin_at: now(), next_due_at: addInterval(now(), s.checkin_interval), reminders_sent: 0 } });
  await cancelOpenDeathCase(userId, 'OWNER_CHECKED_IN');
}
```

### 4.2 Obituary Watcher (ogni 6 ore per fonte)

```ts
interface ObituarySource { name: string; fetchSince(t: Date): AsyncIterable<ObituaryRecord> }
const sources: ObituarySource[] = [partnerFuneralHomesFeed, licensedObituaryAggregator /*, … */];

async function obituaryTick() {
  for (const src of sources) {
    const cursor = await getCursor(src.name);
    try {
      for await (const rec of src.fetchSince(cursor)) {
        const key = blindIndex(matchKey(rec.surname, rec.name, rec.birthYear ?? estimateBirthYear(rec)));
        const watches = await db.obituary_watch.findMany({ where: { match_key_bidx: key, enabled: true } });
        for (const w of watches) {
          const identity = JSON.parse(await kms.decrypt(PII_KEY, w.sealed_identity));
          const score = scoreMatch(identity, rec);   // nome+cognome .4, data nascita .3 | età .15, comune .2
          if (score >= 0.7) await openDeathCase(w.user_id, `OBITUARY:${src.name}`, score, rec.url);
        }
      }
      await setCursor(src.name, now());
    } catch (e) {
      // FALLBACK 1: una fonte non disponibile non blocca nulla: il dead-man switch e gli esecutori restano attivi
      logger.warn({ source: src.name, err: e.code }, 'obituary source unavailable');
      metrics.increment('obituary.source_error', { source: src.name });
    }
  }
}
```

### 4.3 Macchina a stati del caso decesso

```ts
async function openDeathCase(ownerId: string, reason: string, confidence: number, evidence?: string) {
  const c = await upsertOpenCase(ownerId, reason);                    // indice unico: un solo caso aperto
  await db.death_signal.create({ data: { case_id: c.id, source: reason, confidence, evidence_ref: evidence } });

  // Avvisa SEMPRE prima il titolare: potrebbe essere vivo
  await notifyOwnerAllChannels(ownerId, 'DEATH_CASE_OPENED', { cancelLink: signedLink('CANCEL_DEATH_CASE', ownerId) });

  const execs = await acceptedExecutors(ownerId);
  if (execs.length > 0) {
    await setStatus(c, 'AWAITING_EXECUTORS');
    for (const e of execs) await notifyExecutor(e, c);               // tono delicato; nessun contenuto
    await scheduleJob('death-case-followup', { caseId: c.id }, { delay: days(3) });
  } else if ((await deathSwitch(ownerId)).allow_unattended_release) {
    // FALLBACK 2: nessun esecutore → solo dopo check-in mancato, contestazione estesa a 14 gg
    if (reason === 'CHECKIN_MISSED') await startContestPeriod(c, days(14));
    // un segnale necrologio da solo NON avvia la contestazione: attende anche il check-in mancato
  } else {
    // FALLBACK 3: nessun meccanismo valido → caso in revisione operatore, nessun rilascio
    await alertOps('DEATH_CASE_NO_VERIFIER', c.id);
  }
}

async function onExecutorDecision(caseId: string, executorId: string, decision: 'CONFIRM' | 'DENY', shareUpload?: Uint8Array) {
  const c = await getCase(caseId);
  if (c.status !== 'AWAITING_EXECUTORS') throw Conflict();
  await db.executor_confirmation.create({ data: { case_id: caseId, executor_id: executorId, decision, share_upload: shareUpload } });
  await audit('EXECUTOR_DECISION', { caseId, executorId, decision });

  const { confirms, denies, total, quorum } = await tally(caseId);
  if (denies > total - quorum) return closeCase(c, 'REJECTED');      // quorum non più raggiungibile
  if (confirms >= quorum)      return startContestPeriod(c, (await deathSwitch(c.owner_id)).contest_period);
}

async function startContestPeriod(c, period) {
  await setStatus(c, 'CONTEST_PERIOD', { contest_until: addInterval(now(), period) });
  await scheduleRepeating('contest-ping', { caseId: c.id }, { every: hours(12), until: c.contest_until });  // ping al titolare
  await scheduleJob('contest-expire', { caseId: c.id }, { at: c.contest_until });
}

async function onContestExpire({ caseId }) {
  const c = await getCase(caseId);
  if (c.status !== 'CONTEST_PERIOD' || c.contest_until > now()) return;   // annullato o prorogato
  await db.$transaction(async tx => {
    await setStatus(c, 'CONFIRMED', {}, tx);
    await tx.app_user.update({ where: { id: c.owner_id }, data: { status: 'DECEASED' } });
    // Rende consegnabili tutte le consegne dei messaggi DEATH / DATE_OR_DEATH
    await tx.$executeRaw`
      UPDATE delivery d SET due_at = now()
      FROM message m JOIN trigger t ON t.message_id = m.id
      WHERE d.message_id = m.id AND m.vault_id = ${c.owner_id}
        AND m.status = 'ARMED' AND t.kind IN ('DEATH','DATE_OR_DEATH') AND d.status = 'PENDING'`;
    await tx.audit_log.create(auditRow('DEATH_CONFIRMED', { targetId: c.id, actor: 'SYSTEM' }));
  });
  // Lo sweeper le prenderà al prossimo giro; le quiet hours sono gestite dal Release Worker
  await notifyExecutors(c, 'MESSAGES_RELEASING');
}

async function cancelByOwner(ownerId: string, ctx) {
  requireStepUp(ctx);                                                // password + 2FA recenti
  const c = await getOpenCase(ownerId);
  await closeCase(c, 'CANCELLED_BY_OWNER');
  await discardUploadedShares(c.id);
  await notifyExecutors(c, 'CASE_CANCELLED');
  await checkIn(ownerId);
}
```

### 4.4 Lato esecutore (client): consegna della propria parte

```ts
async function executorConfirm(vs: VaultSession, caseId: string) {
  const { enc_shamir_shares } = await api.get(`/executor/cases/${caseId}/shares`);   // sigillati per l'esecutore
  const shares = sodium.crypto_box_seal_open(enc_shamir_shares, vs.publicKey, vs.privateKey);
  const upload = sealToServerReleaseKey(shares);                     // ri-cifrati per la chiave pubblica di rilascio
  await api.post(`/executor/cases/${caseId}/decision`, { decision: 'CONFIRM', shareUpload: upload });
}
```

## 5. Apertura da parte del destinatario (client)

```ts
async function openReceivedMessage(deliveryId: string, code?: string, vs?: VaultSession) {
  const d = await api.get(`/received/${deliveryId}`);   // server verifica: RELEASED/SENT/OPENED ∧ redeemed_by = me
  let dek: Uint8Array;
  if (d.key_mode === 'DIRECT_PUBKEY') {
    dek = sodium.crypto_box_seal_open(d.wrapped_dek, vs!.publicKey, vs!.privateKey);
  } else {
    const k = await argon2id(normalizeCode(code!), d.code_kdf_salt, { m: 65536, t: 3, p: 1 });
    try { dek = aesGcmDecrypt(k, d.wrapped_dek, aad('delivery', d.message_id, d.recipient_ref, 'dek')); }
    catch { await api.post(`/received/${deliveryId}/code-failed`); throw new UserError('Codice non corretto'); } // max 5 → blocco 24 h
    if (vs) await api.post(`/received/${deliveryId}/rewrap`, { wrapped_dek: sodium.crypto_box_seal(dek, vs.publicKey) }); // il codice non serve più
  }
  const msg = {
    title: utf8Decode(aesGcmDecrypt(dek, d.enc_title, aad('message', d.message_id, 'title', d.version))),
    body:  sanitize(renderTiptap(JSON.parse(utf8Decode(aesGcmDecrypt(dek, d.enc_body, aad('message', d.message_id, 'body', d.version)))))),
    attachments: d.attachments.map(a => ({ ...a, meta: JSON.parse(utf8Decode(aesGcmDecrypt(dek, a.enc_meta, aad('attachment', a.id, 'meta', 1)))) })),
  };
  await api.post(`/received/${deliveryId}/opened`);
  return { msg, dek };   // dek tenuta in memoria per scaricare e decifrare gli allegati a stream
}
```
