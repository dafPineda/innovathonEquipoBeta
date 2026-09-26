-- =============================================================================
-- 0001_init.sql · Esquema base
-- Reglas del libro mayor de créditos:
--   1. credit_ledger es APPEND-ONLY. Ni UPDATE ni DELETE, ni por admin.
--   2. credit_accounts.balance es una caché: se recalcula SOLO desde el ledger
--      mediante trigger. Nunca se escribe a mano.
--   3. Todo movimiento de saldo pasa por el trigger apply_ledger_entry, que
--      falla si el saldo queda negativo. El saldo negativo es imposible.
--   4. `null` como usuario en el ledger = bóveda de la plataforma (system).
--      Ej: estudiante -> null (escrow), null -> tutor (payout), null -> null
--      nunca ocurre.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ── Enums (idempotentes) ────────────────────────────────────────────────────
do $$ begin create type public.user_role as enum ('student','tutor','admin');
exception when duplicate_object then null; end $$;

do $$ begin create type public.request_status as enum ('open','in_session','resolved','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.request_urgency as enum ('low','normal','high');
exception when duplicate_object then null; end $$;

do $$ begin create type public.session_status as enum ('scheduled','in_progress','completed','cancelled','disputed');
exception when duplicate_object then null; end $$;

do $$ begin create type public.escrow_status as enum ('held','settled','refunded');
exception when duplicate_object then null; end $$;

do $$ begin create type public.credit_reason as enum (
  'signup_bonus','onboarding_bonus','escrow_funded','session_settled',
  'escrow_refunded','redemption','reversal','expired','adjustment'
);
exception when duplicate_object then null; end $$;

do $$ begin create type public.redemption_method as enum ('gift_card','bank_transfer','platform_wallet','discount');
exception when duplicate_object then null; end $$;

do $$ begin create type public.redemption_status as enum ('pending','fulfilled','rejected');
exception when duplicate_object then null; end $$;

-- ── Configuración editable sin redeploy ─────────────────────────────────────
create table if not exists public.app_config (
  key         text primary key,
  value       text        not null,
  description text
);

insert into public.app_config (key, value, description) values
  ('platform_fee_percent',              '10', 'Comisión de la plataforma por sesión liquidada (0-30)'),
  ('signup_bonus_credits',              '20', 'Créditos de bienvenida para estudiantes nuevos'),
  ('tutor_onboarding_bonus_credits',    '5',  'Créditos para tutores verificados'),
  ('min_billable_minutes',              '15', 'Mínimo facturable por sesión'),
  ('max_billable_minutes',              '180','Máximo facturable por sesión'),
  ('free_cancellation_hours',           '24', 'Anticipación para cancelar sin penalización'),
  ('late_cancellation_penalty_percent', '50', '% que se queda la plataforma si cancela tarde'),
  ('min_redemption_credits',            '10', 'Mínimo de créditos para pedir canje'),
  ('credit_value_cents',                '50', 'Valor de 1 crédito en céntimos (canjes directos)'),
  ('discount_value_cents',              '40', 'Valor de 1 crédito en céntimos (canjes tipo descuento)')
on conflict (key) do nothing;

create or replace function public.config_int(p_key text)
returns integer
language sql
stable
set search_path = public
as $$
  select (select a.value from public.app_config a where a.key = p_key)::integer;
$$;

comment on function public.config_int(text) is
  'Lee un entero de app_config. Fuente de verdad en BD, con defaults seguros en el código TS.';

-- ── Perfiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null default 'student',
  display_name text        not null check (char_length(display_name) between 2 and 60),
  avatar_url   text,
  university   text,
  timezone     text        not null default 'America/Lima',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.tutor_profiles (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  headline           text,
  subjects           text[]      not null default '{}',
  bio                text check (char_length(coalesce(bio,'')) <= 2000),
  credits_per_hour   integer     not null default 3 check (credits_per_hour between 1 and 50),
  is_verified        boolean     not null default false,
  rating             numeric(3,2) check (rating between 0 and 5),
  rating_count       integer     not null default 0,
  sessions_completed integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tutor_profiles_verified_idx
  on public.tutor_profiles (is_verified, rating desc) where is_verified;

-- ── Cuentas + libro mayor ───────────────────────────────────────────────────
create table if not exists public.credit_accounts (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  balance         bigint not null default 0 check (balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_spent  bigint not null default 0 check (lifetime_spent >= 0),
  updated_at      timestamptz not null default now()
);

comment on table public.credit_accounts is
  'Saldo cacheado. Se mantiene exclusivamente via trigger apply_ledger_entry.';

create table if not exists public.credit_ledger (
  id            bigint generated always as identity primary key,
  from_user_id  uuid references public.profiles(id) on delete restrict,
  to_user_id    uuid references public.profiles(id) on delete restrict,
  amount        bigint not null check (amount > 0),
  reason        public.credit_reason not null,
  session_id    uuid,
  ref_type      text,
  ref_id        uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint ledger_no_self_transfer check (from_user_id is null or to_user_id is null or from_user_id <> to_user_id),
  constraint ledger_has_a_side   check (from_user_id is not null or to_user_id is not null)
);

create index if not exists credit_ledger_to_idx   on public.credit_ledger (to_user_id,   created_at desc);
create index if not exists credit_ledger_from_idx on public.credit_ledger (from_user_id, created_at desc);
create index if not exists credit_ledger_session_idx on public.credit_ledger (session_id) where session_id is not null;

comment on table public.credit_ledger is
  'Libro mayor append-only. from/to = null significa "bóveda del sistema (escrow)".';

-- ── Solicitudes de ayuda ────────────────────────────────────────────────────
create table if not exists public.help_requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  tutor_id       uuid references public.profiles(id) on delete set null,
  subject        text not null check (char_length(subject) between 2 and 60),
  title          text not null check (char_length(title) between 8 and 120),
  description    text not null check (char_length(description) between 20 and 4000),
  urgency        public.request_urgency not null default 'normal',
  status         public.request_status  not null default 'open',
  credits_offered integer not null check (credits_offered between 1 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists help_requests_open_idx
  on public.help_requests (subject, created_at desc) where status = 'open';

-- ── Sesiones + bóveda por sesión ────────────────────────────────────────────
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.help_requests(id) on delete cascade,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  tutor_id         uuid not null references public.profiles(id) on delete restrict,
  status           public.session_status not null default 'scheduled',
  scheduled_at     timestamptz,
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  credits_gross    integer check (credits_gross is null or credits_gross >= 0),
  credits_paid     integer check (credits_paid   is null or credits_paid   >= 0),
  platform_fee     integer check (platform_fee  is null or platform_fee  >= 0),
  rating           integer check (rating between 1 and 5),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sessions_distinct_participants check (student_id <> tutor_id)
);

create index if not exists sessions_tutor_idx   on public.sessions (tutor_id,   created_at desc);
create index if not exists sessions_student_idx on public.sessions (student_id, created_at desc);

create table if not exists public.credit_escrow (
  session_id      uuid primary key references public.sessions(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  credits_held    integer not null check (credits_held > 0),
  credits_settled integer not null default 0,
  status          public.escrow_status not null default 'held',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint escrow_settled_within_held check (credits_settled <= credits_held)
);

-- ── Canjes de créditos por dinero simbólico ─────────────────────────────────
create table if not exists public.redemptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  credits         integer not null check (credits > 0),
  cash_value_cents integer not null check (cash_value_cents > 0),
  currency        char(3) not null default 'PEN',
  method          public.redemption_method not null,
  status          public.redemption_status not null default 'pending',
  redemption_code text unique,
  created_at      timestamptz not null default now(),
  fulfilled_at    timestamptz
);

create index if not exists redemptions_user_idx on public.redemptions (user_id, created_at desc);

-- =============================================================================
-- Triggers de integridad
-- =============================================================================

-- El libro mayor no se toca. Ni siquiera un admin.
create or replace function public.forbid_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'LEDGER_APPEND_ONLY: el libro mayor de créditos es inmutable (operación % rechazada)', tg_op
    using errcode = 'P0001';
end;
$$;

create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function public.forbid_ledger_mutation();

-- Única fuente de verdad de los saldos: el ledger.
create or replace function public.apply_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  -- Salida: el emisor pierde, y solo cuenta como "gastado" si el motivo es gasto real.
  if new.from_user_id is not null then
    update public.credit_accounts
       set balance        = balance - new.amount,
           lifetime_spent = lifetime_spent
                             + case when new.reason in ('escrow_funded','redemption')
                                    then new.amount else 0 end,
           updated_at     = now()
     where user_id = new.from_user_id
    returning balance into v_new_balance;

    if v_new_balance is null then
      raise exception 'CUENTA_INEXISTENTE: el usuario % no tiene cuenta de créditos', new.from_user_id
        using errcode = 'P0001';
    end if;

    if v_new_balance < 0 then
      raise exception 'SALDO_INSUFICIENTE: % necesita % créditos y solo tiene %',
        new.from_user_id, new.amount, v_new_balance + new.amount
        using errcode = 'P0001';
    end if;
  end if;

  -- Entrada: el receptor suma. "Ganado" solo cuenta lo que fue ingreso real.
  if new.to_user_id is not null then
    insert into public.credit_accounts (user_id, balance)
    values (new.to_user_id, new.amount)
    on conflict (user_id) do update
      set balance         = credit_accounts.balance + excluded.balance,
          lifetime_earned = credit_accounts.lifetime_earned
                             + case when new.reason in ('session_settled','signup_bonus','onboarding_bonus','adjustment')
                                    then new.amount else 0 end,
          updated_at      = now();
  end if;

  return new;
end;
$$;

create trigger credit_ledger_apply
  after insert on public.credit_ledger
  for each row execute function public.apply_ledger_entry();

-- Alta de perfil => cuenta de créditos + bono de bienvenida.
create or replace function public.on_profile_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus integer := public.config_int('signup_bonus_credits');
begin
  insert into public.credit_accounts (user_id) values (new.id) on conflict do nothing;

  if new.role = 'student' and coalesce(v_bonus, 0) > 0 then
    insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, metadata)
    values (null, new.id, v_bonus, 'signup_bonus',
            jsonb_build_object('note', 'Bono de bienvenida para estudiantes'));
  end if;
  return new;
end;
$$;

create trigger profiles_after_insert
  after insert on public.profiles
  for each row execute function public.on_profile_created();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','tutor_profiles','credit_accounts','help_requests','sessions','credit_escrow']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;
