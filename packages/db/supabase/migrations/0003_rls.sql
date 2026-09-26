-- =============================================================================
-- 0003_rls.sql · Row Level Security
--
-- Reglas de oro:
--   1. Nadie escribe en credit_ledger ni en credit_accounts. Jamás.
--      Solo entran por funciones SECURITY DEFINER, que a su vez exigieron
--      el saldo y la autorización.
--   2. Nadie se auto-asigna el rol 'admin', ni se marca 'is_verified'.
--      Para eso están los grants por columna de abajo: sin permiso, error.
--   3. Los perfiles y el directorio de tutores son públicos (es un mercado).
--   4. El saldo, el historial, las sesiones y los canjes son privados.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.tutor_profiles   enable row level security;
alter table public.credit_accounts  enable row level security;
alter table public.credit_ledger    enable row level security;
alter table public.help_requests    enable row level security;
alter table public.sessions         enable row level security;
alter table public.credit_escrow    enable row level security;
alter table public.redemptions      enable row level security;
alter table public.app_config       enable row level security;

-- Helper: ¿el usuario actual participa en esta sesión?
-- Se declara ANTES de las políticas porque Postgres valida la expresión al
-- crearlas, no al ejecutarlas.
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id
      and (s.student_id = auth.uid() or s.tutor_id = auth.uid())
  );
$$;

-- ── Perfiles: directorio público, escritura solo del propio ─────────────────
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Tutores ────────────────────────────────────────────────────────────────
drop policy if exists tutor_profiles_select_public on public.tutor_profiles;
create policy tutor_profiles_select_public on public.tutor_profiles
  for select using (true);

drop policy if exists tutor_profiles_insert_own on public.tutor_profiles;
create policy tutor_profiles_insert_own on public.tutor_profiles
  for insert with check (user_id = auth.uid());

drop policy if exists tutor_profiles_update_own on public.tutor_profiles;
create policy tutor_profiles_update_own on public.tutor_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Cuentas: solo leer el propio saldo ─────────────────────────────────────
drop policy if exists credit_accounts_select_own on public.credit_accounts;
create policy credit_accounts_select_own on public.credit_accounts
  for select using (user_id = auth.uid());

-- ── Libro mayor: solo leer los movimientos propios ──────────────────────────
-- (ni insert, ni update, ni delete: eso lo hacen las funciones)
drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- ── Solicitudes ────────────────────────────────────────────────────────────
drop policy if exists help_requests_select on public.help_requests;
create policy help_requests_select on public.help_requests
  for select using (
    student_id = auth.uid()
    or tutor_id = auth.uid()
    or status = 'open'   -- el mercado necesita verlas para ofrecer ayuda
  );

drop policy if exists help_requests_insert_own on public.help_requests;
create policy help_requests_insert_own on public.help_requests
  for insert with check (student_id = auth.uid());

drop policy if exists help_requests_update_participant on public.help_requests;
create policy help_requests_update_participant on public.help_requests
  for update using (student_id = auth.uid() or tutor_id = auth.uid());

-- ── Sesiones y bóveda: solo los participantes ──────────────────────────────
drop policy if exists sessions_select_participant on public.sessions;
create policy sessions_select_participant on public.sessions
  for select using (student_id = auth.uid() or tutor_id = auth.uid());

drop policy if exists sessions_update_participant on public.sessions;
create policy sessions_update_participant on public.sessions
  for update using (student_id = auth.uid() or tutor_id = auth.uid());

drop policy if exists credit_escrow_select_participant on public.credit_escrow;
create policy credit_escrow_select_participant on public.credit_escrow
  for select using (public.is_session_participant(session_id));

-- ── Canjes: privados ───────────────────────────────────────────────────────
drop policy if exists redemptions_select_own on public.redemptions;
create policy redemptions_select_own on public.redemptions
  for select using (user_id = auth.uid());

-- ── Config: lectura pública (es una tabla de constantes públicas) ───────────
drop policy if exists app_config_select_public on public.app_config;
create policy app_config_select_public on public.app_config
  for select using (true);

-- Helper declarado arriba: public.is_session_participant(uuid)

-- =============================================================================
-- Grants
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Defensa en profundidad: el ledger y las cuentas no admiten escritura directa
-- desde un cliente, solo a través de las funciones SECURITY DEFINER.
revoke insert, update, delete on public.credit_ledger   from anon, authenticated;
revoke insert, update, delete on public.credit_accounts from anon, authenticated;
revoke insert, update, delete on public.credit_escrow   from anon, authenticated;
revoke insert, update, delete on public.redemptions     from anon, authenticated;

-- Lectura pública del mercado
grant select on public.profiles, public.tutor_profiles, public.app_config to anon, authenticated;

-- El resto de tablas: solo para usuarios autenticados
grant select on public.credit_accounts, public.credit_ledger, public.help_requests,
                public.sessions, public.credit_escrow, public.redemptions to authenticated;

grant insert on public.profiles, public.tutor_profiles to authenticated;
grant insert on public.help_requests to authenticated;

-- ⚠ Grants POR COLUMNA: así nadie se auto-asigna rol admin ni is_verified.
grant update (display_name, avatar_url, university, timezone)
  on public.profiles to authenticated;

grant update (headline, subjects, bio, credits_per_hour)
  on public.tutor_profiles to authenticated;

grant update (title, description, urgency, credits_offered)
  on public.help_requests to authenticated;

grant update (scheduled_at, rating)
  on public.sessions to authenticated;

-- Funciones: nadie las ejecuta por accidente desde el anon.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.fn_credit_balance(uuid)                          to authenticated;
grant execute on function public.fn_credit_history(uuid, integer, integer)         to authenticated;
grant execute on function public.fn_book_session(uuid, uuid, timestamptz)           to authenticated;
grant execute on function public.fn_start_session(uuid)                            to authenticated;
grant execute on function public.fn_settle_session(uuid, integer, uuid)            to authenticated;
grant execute on function public.fn_cancel_session(uuid, uuid, text)                to authenticated;
grant execute on function public.fn_rate_session(uuid, integer, uuid)              to authenticated;
grant execute on function public.fn_redeem_credits(uuid, integer, public.redemption_method) to authenticated;
grant execute on function public.fn_open_requests(text, integer)                    to authenticated;
grant execute on function public.fn_tutor_directory(text, integer)                  to authenticated;
grant execute on function public.fn_admin_adjust_credits(uuid, integer, text)        to service_role;

-- Helpers de solo lectura
grant execute on function public.config_int(text)                to anon, authenticated;
grant execute on function public.is_session_participant(uuid)   to authenticated;
