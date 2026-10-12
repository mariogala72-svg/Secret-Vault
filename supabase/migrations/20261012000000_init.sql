-- Secret Vault schema.
-- Every table has RLS enabled and NO policies: the Supabase Data API (anon /
-- authenticated keys) cannot read or write anything. The Next.js server is the
-- only client, connecting with a dedicated Postgres role.

create extension if not exists pgcrypto;

create table users (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null unique check (email = lower(email)),
  display_name         text not null,
  password_hash        text not null,
  email_verified_at    timestamptz,
  status               text not null default 'ACTIVE' check (status in ('ACTIVE', 'DECEASED')),
  failed_logins        int not null default 0,
  login_locked_until   timestamptz,
  verification_sent_at timestamptz,
  -- digital will (dead man's switch)
  ds_enabled           boolean not null default false,
  ds_interval_days     int not null default 90,
  ds_grace_days        int not null default 30,
  ds_quorum            int not null default 1,
  ds_contest_hours     int not null default 72 check (ds_contest_hours >= 24),
  ds_allow_unattended  boolean not null default false,
  ds_last_checkin_at   timestamptz,
  ds_next_due_at       timestamptz,
  ds_reminders_sent    int not null default 0,
  created_at           timestamptz not null default now()
);
create index users_ds_due_idx on users (ds_next_due_at) where ds_enabled;

create table sessions (
  token_hash   text primary key,
  user_id      uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  reauth_at    timestamptz,
  user_agent   text
);
create index sessions_user_idx on sessions (user_id);

create table auth_tokens (
  token_hash text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  purpose    text not null check (purpose in ('VERIFY_EMAIL', 'RESET_PASSWORD')),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create table vaults (
  user_id                  uuid primary key references users (id) on delete cascade,
  kdf_salt                 text not null,
  kdf_params               jsonb not null,
  public_key               text not null,
  enc_private_key_pwd      text not null,
  enc_private_key_recovery text not null,
  failed_unlocks           int not null default 0,
  locked_until             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table contacts (
  id         uuid primary key,
  user_id    uuid not null references users (id) on delete cascade,
  enc        text not null,
  updated_at timestamptz not null default now()
);
create index contacts_user_idx on contacts (user_id);

create table messages (
  id                uuid primary key,
  owner_id          uuid not null references users (id) on delete cascade,
  status            text not null,
  enc_title         text not null,
  enc_body          text not null,
  owner_wrapped_dek text not null,
  attachments       jsonb not null default '[]',
  trigger           jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index messages_owner_idx on messages (owner_id);

-- Encrypted attachment chunks (already encrypted in the browser).
create table chunks (
  aid        uuid not null,
  n          int not null,
  owner_id   uuid not null references users (id) on delete cascade,
  message_id uuid not null,
  data       bytea not null,
  created_at timestamptz not null default now(),
  primary key (aid, n)
);
create index chunks_message_idx on chunks (message_id);

create table deliveries (
  id                   uuid primary key default gen_random_uuid(),
  message_id           uuid not null references messages (id) on delete cascade,
  owner_id             uuid not null references users (id) on delete cascade,
  contact_id           uuid not null,
  sealed_name          text not null,
  sealed_email         text not null,
  sealed_phone         text,
  email_idx            text not null,
  email_masked         text not null,
  key_mode             text not null check (key_mode in ('SENDER_SHARES_CODE', 'ESCROW_TLOCK', 'ESCROW_SERVER')),
  wrapped_dek          text not null,
  code_salt            text not null,
  escrow_sealed        text,
  code_hint_sealed     text,
  code_reserve_sealed  text,
  reserve_expires_at   timestamptz,
  link_token_sealed    text,
  link_token_hash      text unique,
  status               text not null,
  pending_due_at       timestamptz,
  due_at               timestamptz,
  attempts             int not null default 0,
  last_error           text,
  sent_at              timestamptz,
  opened_at            timestamptz,
  redeemed_by          uuid references users (id) on delete set null,
  failed_code_attempts int not null default 0,
  code_locked_until    timestamptz,
  code_resent_at       timestamptz,
  created_at           timestamptz not null default now()
);
create index deliveries_message_idx on deliveries (message_id);
create index deliveries_owner_idx on deliveries (owner_id);
create index deliveries_email_idx on deliveries (email_idx);
create index deliveries_due_idx on deliveries (pending_due_at) where pending_due_at is not null;
create index deliveries_reserve_idx on deliveries (reserve_expires_at) where reserve_expires_at is not null;

create table executors (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references users (id) on delete cascade,
  sealed_name  text not null,
  sealed_email text not null,
  email_idx    text not null,
  email_masked text not null,
  status       text not null default 'INVITED' check (status in ('INVITED', 'ACCEPTED', 'DECLINED', 'REVOKED')),
  executor_id  uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
create index executors_owner_idx on executors (owner_id);
create index executors_email_idx on executors (email_idx);

create table death_cases (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users (id) on delete cascade,
  status        text not null check (status in ('AWAITING_EXECUTORS', 'CONTEST', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'NEEDS_REVIEW')),
  reason        text not null,
  decisions     jsonb not null default '{}',
  contest_until timestamptz,
  cancelled_by  text,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz
);
create unique index death_cases_one_open on death_cases (owner_id) where status in ('AWAITING_EXECUTORS', 'CONTEST', 'NEEDS_REVIEW');
create index death_cases_contest_idx on death_cases (contest_until) where status = 'CONTEST';

create table audit_logs (
  id      bigserial primary key,
  user_id uuid,
  action  text not null,
  meta    jsonb not null default '{}',
  at      timestamptz not null default now()
);
create index audit_logs_user_idx on audit_logs (user_id, at desc);

create table app_meta (
  key         text primary key,
  lock_until  timestamptz not null default 'epoch',
  last_run_at timestamptz not null default 'epoch'
);
insert into app_meta (key) values ('maintenance');

-- Lock down the Data API completely.
do $$
declare t text;
begin
  foreach t in array array['users','sessions','auth_tokens','vaults','contacts','messages','chunks','deliveries','executors','death_cases','audit_logs','app_meta'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I from anon, authenticated', t);
    end if;
  end loop;
end $$;
