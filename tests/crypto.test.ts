import { test } from "node:test";
import assert from "node:assert/strict";
import { createVault, unlockWithPassword, unlockWithRecovery, rewrapForPassword, isValidRecoveryPhrase } from "../src/lib/crypto/vault";
import { newDek, encryptText, decryptText, aad, wrapDekForOwner, unwrapOwnerDek, buildDelivery, unwrapRecipientDek, keyModeFor, timelockSeal } from "../src/lib/crypto/message";
import { generateAccessCode, normalizeCode, isWellFormedCode } from "../src/lib/crypto/code";

test("vault: create, unlock with password and recovery phrase, change password", async () => {
  const { record, recoveryWords, unlocked } = await createVault("u1", "una frase molto lunga e segreta");
  assert.equal(recoveryWords.split(" ").length, 24);
  assert.ok(isValidRecoveryPhrase(recoveryWords));
  const a = await unlockWithPassword("u1", record, "una frase molto lunga e segreta");
  assert.deepEqual(a.privateKey, unlocked.privateKey);
  await assert.rejects(unlockWithPassword("u1", record, "sbagliata"));
  await assert.rejects(unlockWithPassword("u2", record, "una frase molto lunga e segreta"), "AAD binds to uid");
  const b = await unlockWithRecovery("u1", record, recoveryWords.toUpperCase());
  assert.deepEqual(b.privateKey, unlocked.privateKey);
  const rewrapped = await rewrapForPassword("u1", unlocked, "nuova password altrettanto lunga");
  const c = await unlockWithPassword("u1", { ...record, ...rewrapped }, "nuova password altrettanto lunga");
  assert.deepEqual(c.privateKey, unlocked.privateKey);
});

test("message: owner wrap and recipient code wrap", async () => {
  const { unlocked } = await createVault("u1", "una frase molto lunga e segreta");
  const dek = newDek();
  const enc = await encryptText(dek, "Caro Tommaso ❤️", aad.body("m1"));
  const wrapped = await wrapDekForOwner(dek, unlocked.publicKey, "m1");
  const dek2 = await unwrapOwnerDek(unlocked.privateKey, wrapped, "m1");
  assert.equal(await decryptText(dek2, enc, aad.body("m1")), "Caro Tommaso ❤️");
  await assert.rejects(decryptText(dek2, enc, aad.title("m1")), "AAD binds to field");

  const trigger = { kind: "MANUAL_NOW" as const };
  const { input, code } = await buildDelivery(dek, "m1", trigger, { contactId: "c1", name: "T", email: "t@x.it", senderShares: false });
  assert.equal(input.keyMode, "ESCROW_SERVER");
  assert.equal(input.escrow, code);
  const dek3 = await unwrapRecipientDek(code.toLowerCase().replace(/-/g, " "), input.codeSalt, input.wrappedDek, "m1");
  assert.equal(await decryptText(dek3, enc, aad.body("m1")), "Caro Tommaso ❤️");
  await assert.rejects(unwrapRecipientDek(generateAccessCode(), input.codeSalt, input.wrappedDek, "m1"));
});

test("access code format", () => {
  const c = generateAccessCode();
  assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  assert.ok(isWellFormedCode(c.toLowerCase()));
  assert.equal(normalizeCode("abcd-oil1"), "ABCD0111");
});

test("key mode selection", () => {
  assert.equal(keyModeFor({ kind: "FIXED_DATE", fireAt: new Date().toISOString() }, false), "ESCROW_TLOCK");
  assert.equal(keyModeFor({ kind: "DATE_OR_DEATH", fireAt: new Date().toISOString() }, false), "ESCROW_SERVER");
  assert.equal(keyModeFor({ kind: "DEATH" }, true), "SENDER_SHARES_CODE");
});

test("timelock encryption works offline", async () => {
  const ct = await timelockSeal("K7MQ-2XRT", new Date(Date.now() + 86400e3));
  assert.match(ct, /BEGIN AGE ENCRYPTED FILE/);
});
