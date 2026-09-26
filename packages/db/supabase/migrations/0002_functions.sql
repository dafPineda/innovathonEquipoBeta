-- =============================================================================
-- 0002_functions.sql · API transaccional del dominio
--
-- Todas son SECURITY DEFINER: el cliente no puede escribir en el ledger
-- directamente, solo pasar por aquí. Cada una es atómica: o se mueve el
-- crédito entero, o no se mueve nada.
--
-- Constantes duplicadas a propósito: en packages/credits (TS) para dar feedback
-- inmediato en la API/UI, y aquí en app_config para que la BD sea la autoridad.
-- Si cambias una, cambia la otra y actualiza el test de paridad.
-- =============================================================================

-- ── Balance ─────────────────────────────────────────────────────────────────
create or replace function public.fn_credit_balance(p_user uuid default auth.uid())
returns table (balance bigint, lifetime_earned bigint, lifetime_spent bigint)
language sql
stable
set search_path = public
as $$
  select a.balance, a.lifetime_earned, a.lifetime_spent
  from public.credit_accounts a
  where a.user_id = p_user;
$$;

-- ── Historial de movimientos ────────────────────────────────────────────────
create or replace function public.fn_credit_history(
  p_user   uuid default auth.uid(),
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id            bigint,
  direction     text,
  counterparty  uuid,
  amount        bigint,
  reason        public.credit_reason,
  session_id    uuid,
  metadata      jsonb,
  created_at    timestamptz
)
language sql
stable
set search_path = public
as $$
  select l.id,
         case when l.to_user_id = p_user then 'in' else 'out' end,
         case when l.to_user_id = p_user then l.from_user_id else l.to_user_id end,
         l.amount, l.reason, l.session_id, l.metadata, l.created_at
  from public.credit_ledger l
  where l.from_user_id = p_user or l.to_user_id = p_user
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ── Reservar sesión: fondea la bóveda desde el saldo del estudiante ─────────
create or replace function public.fn_book_session(
  p_request_id   uuid,
  p_tutor_id     uuid,
  p_scheduled_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request   public.help_requests%rowtype;
  v_balance   bigint;
  v_session   uuid;
begin
  -- Desde el navegador, el tutor solo puede reservarse a sí mismo.
  if not public.current_is_service() and p_tutor_id is distinct from auth.uid() then
    raise exception 'NO_AUTORIZADO: solo puedes agendar sesiones a tu nombre' using errcode = '42501';
  end if;

  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then
    raise exception 'SOLICITUD_NO_ENCONTRADA: %', p_request_id using errcode = 'P0002';
  end if;
  if v_request.status not in ('open','in_session') then
    raise exception 'SOLICITUD_CERRADA: estado %', v_request.status using errcode = 'P0001';
  end if;
  if v_request.student_id = p_tutor_id then
    raise exception 'AUTOSERVICIO: un estudiante no puede reservarse a sí mismo' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tutor_profiles
                  where user_id = p_tutor_id and is_verified) then
    raise exception 'TUTOR_NO_VERIFICADO: %', p_tutor_id using errcode = 'P0001';
  end if;

  select balance into v_balance from public.credit_accounts where user_id = v_request.student_id;
  if coalesce(v_balance, 0) < v_request.credits_offered then
    raise exception 'SALDO_INSUFICIENTE: el estudiante tiene % créditos y la sesión cuesta %',
      coalesce(v_balance, 0), v_request.credits_offered using errcode = 'P0001';
  end if;

  -- El estudiante bloquea los créditos al agendar: sale de su cuenta a la bóveda.
  insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, ref_type, ref_id, metadata)
  values (v_request.student_id, null, v_request.credits_offered, 'escrow_funded', 'help_request', p_request_id,
          jsonb_build_object('tutor_id', p_tutor_id));

  insert into public.sessions (request_id, student_id, tutor_id, status, scheduled_at)
  values (p_request_id, v_request.student_id, p_tutor_id,
          case when p_scheduled_at is null then 'in_progress' else 'scheduled' end,
          p_scheduled_at)
  returning id into v_session;

  insert into public.credit_escrow (session_id, student_id, credits_held)
  values (v_session, v_request.student_id, v_request.credits_offered);

  update public.help_requests
     set status = 'in_session', tutor_id = p_tutor_id
   where id = p_request_id;

  return v_session;
end;
$$;

-- ── Marcar inicio ───────────────────────────────────────────────────────────
create or replace function public.fn_start_session(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_started timestamptz;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESION_NO_ENCONTRADA: %', p_session_id using errcode = 'P0002';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'ESTADO_INVALIDO: %', v_session.status using errcode = 'P0001';
  end if;

  update public.sessions
     set status = 'in_progress', started_at = now()
   where id = p_session_id
  returning started_at into v_started;

  return v_started;
end;
$$;

-- ── Liquidar sesión: la bóveda paga al tutor y devuelve el sobrante ──────────
create or replace function public.fn_settle_session(
  p_session_id uuid,
  p_minutes    integer,
  p_actor      uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.sessions%rowtype;
  v_escrow   public.credit_escrow%rowtype;
  v_rate     integer;
  v_billable integer;
  v_gross    integer;
  v_fee      integer;
  v_net      integer;
  v_refund   integer;
  v_capped   boolean := false;
  v_min      integer := public.config_int('min_billable_minutes');
  v_max      integer := public.config_int('max_billable_minutes');
  v_fee_pct  integer := public.config_int('platform_fee_percent');
begin
  -- El actor es siempre quien llama: un cliente web no puede pasar otro uuid
  -- y liquidar o cancelar la sesión de otra persona.
  if not public.current_is_service() then
    p_actor := auth.uid();
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESION_NO_ENCONTRADA: %', p_session_id using errcode = 'P0002';
  end if;
  if p_actor is not null and p_actor not in (v_session.student_id, v_session.tutor_id) then
    raise exception 'NO_PARTICIPANTE: % no participa en la sesión %', p_actor, p_session_id using errcode = 'P0001';
  end if;
  if v_session.status not in ('in_progress','scheduled') then
    raise exception 'ESTADO_INVALIDO: la sesión ya está en %', v_session.status using errcode = 'P0001';
  end if;

  select * into v_escrow from public.credit_escrow where session_id = p_session_id for update;
  if not found or v_escrow.status <> 'held' then
    raise exception 'BOVEDA_INVALIDA: la sesión % no tiene créditos retenidos', p_session_id using errcode = 'P0001';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'DURACION_INVALIDA: %', p_minutes using errcode = 'P0001';
  end if;

  select coalesce(t.credits_per_hour, 3) into v_rate
  from public.profiles p
  left join public.tutor_profiles t on t.user_id = p.id
  where p.id = v_session.tutor_id;

  -- Facturable = duración real acotada por la ventana (mínimo y máximo).
  v_billable := least(greatest(p_minutes, v_min), v_max);
  v_gross    := round(v_billable::numeric / 60 * v_rate)::integer;

  -- Nunca cobramos más de lo que el estudiante retuvo.
  if v_gross > v_escrow.credits_held then
    v_gross  := v_escrow.credits_held;
    v_capped := true;
  end if;
  if v_gross < 1 then
    raise exception 'PAGO_MINIMO: la sesión no alcanza el mínimo de 1 crédito' using errcode = 'P0001';
  end if;

  -- Comisión: redondeo hacia arriba, pero el tutor siempre cobra >= 1 crédito.
  v_fee := least(ceil(v_gross::numeric * v_fee_pct / 100)::integer, v_gross - 1);
  v_net  := v_gross - v_fee;

  -- 1) La bóveda paga al tutor.
  insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, session_id, metadata)
  values (null, v_session.tutor_id, v_net, 'session_settled', p_session_id,
          jsonb_build_object('gross', v_gross, 'platform_fee', v_fee, 'fee_percent', v_fee_pct,
                             'minutes', v_billable, 'rate_credits_per_hour', v_rate,
                             'capped_by_escrow', v_capped, 'confirmed_by', p_actor));

  -- 2) Lo que sobró de la bóveda vuelve al estudiante.
  v_refund := v_escrow.credits_held - v_gross;
  if v_refund > 0 then
    insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, session_id, metadata)
    values (null, v_session.student_id, v_refund, 'escrow_refunded', p_session_id,
            jsonb_build_object('note', 'Sobrante de la bóveda tras liquidar'));
  end if;

  update public.credit_escrow
     set credits_settled = v_gross, status = 'settled'
   where session_id = p_session_id;

  update public.sessions
     set status           = 'completed',
         ended_at         = now(),
         duration_minutes = v_billable,
         credits_gross    = v_gross,
         credits_paid     = v_net,
         platform_fee     = v_fee
   where id = p_session_id;

  update public.help_requests set status = 'resolved' where id = v_session.request_id;

  update public.tutor_profiles
     set sessions_completed = sessions_completed + 1
   where user_id = v_session.tutor_id;

  return jsonb_build_object(
    'session_id',      p_session_id,
    'duration_minutes',v_billable,
    'rate_per_hour',   v_rate,
    'gross',           v_gross,
    'platform_fee',    v_fee,
    'tutor_net',       v_net,
    'refunded',        v_refund,
    'capped_by_escrow',v_capped,
    'fee_percent',     v_fee_pct
  );
end;
$$;

-- ── Cancelar: política de reembolso ─────────────────────────────────────────
create or replace function public.fn_cancel_session(
  p_session_id uuid,
  p_actor      uuid default auth.uid(),
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.sessions%rowtype;
  v_escrow    public.credit_escrow%rowtype;
  v_hours     numeric := 0;
  v_penalty   integer := 0;
  v_refund    integer;
  v_free      boolean;
  v_free_hrs  integer := public.config_int('free_cancellation_hours');
  v_pen_pct   integer := public.config_int('late_cancellation_penalty_percent');
begin
  -- Misma regla que en fn_settle_session: el actor es quien llama.
  if not public.current_is_service() then
    p_actor := auth.uid();
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESION_NO_ENCONTRADA: %', p_session_id using errcode = 'P0002';
  end if;
  if p_actor is not null and p_actor not in (v_session.student_id, v_session.tutor_id) then
    raise exception 'NO_PARTICIPANTE: % no participa en la sesión %', p_actor, p_session_id using errcode = 'P0001';
  end if;
  if v_session.status not in ('scheduled','in_progress') then
    raise exception 'ESTADO_INVALIDO: no se puede cancelar una sesión en %', v_session.status using errcode = 'P0001';
  end if;

  select * into v_escrow from public.credit_escrow where session_id = p_session_id for update;
  if not found or v_escrow.status <> 'held' then
    raise exception 'BOVEDA_INVALIDA: la sesión % ya no tiene créditos retenidos', p_session_id using errcode = 'P0002';
  end if;

  if v_session.started_at is not null then
    v_free := false;                       -- ya empezó: no se devuelve nada
  else
    v_hours := coalesce(extract(epoch from (v_session.scheduled_at - now())) / 3600, v_free_hrs);
    v_free  := v_hours >= v_free_hrs;
  end if;

  if v_free then
    v_refund := v_escrow.credits_held;
  else
    v_penalty := ceil(v_escrow.credits_held::numeric * v_pen_pct / 100)::integer;
    v_refund  := v_escrow.credits_held - v_penalty;
  end if;

  if v_refund > 0 then
    insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, session_id, metadata)
    values (null, v_session.student_id, v_refund, 'escrow_refunded', p_session_id,
            jsonb_build_object('penalty', v_penalty, 'free_cancellation', v_free,
                               'reason', coalesce(p_reason, 'sin motivo'), 'cancelled_by', p_actor));
  end if;

  update public.credit_escrow set status = 'refunded' where session_id = p_session_id;
  update public.sessions     set status = 'cancelled' where id = p_session_id;

  -- La solicitud vuelve al bolsa para que otro tutor pueda tomarla.
  update public.help_requests
     set status = 'open', tutor_id = null
   where id = v_session.request_id and v_session.started_at is null;

  return jsonb_build_object(
    'session_id',       p_session_id,
    'refunded',         v_refund,
    'penalty',          v_penalty,
    'free_cancellation',v_free,
    'free_cancellation_hours', v_free_hrs
  );
end;
$$;

-- ── Calificar sesión ────────────────────────────────────────────────────────
create or replace function public.fn_rate_session(
  p_session_id uuid,
  p_rating     integer,
  p_actor      uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.sessions%rowtype;
  v_promedio numeric;
  v_conteo   integer;
begin
  if not public.current_is_service() then
    p_actor := auth.uid();
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESION_NO_ENCONTRADA: %', p_session_id using errcode = 'P0002';
  end if;
  if p_actor is distinct from v_session.student_id then
    raise exception 'SOLO_ESTUDIANTE: solo el estudiante puede calificar' using errcode = 'P0001';
  end if;
  if v_session.status <> 'completed' then
    raise exception 'ESTADO_INVALIDO: solo se califican sesiones completadas' using errcode = 'P0001';
  end if;
  if v_session.rating is not null then
    raise exception 'YA_CALIFICADA: la sesión ya tiene calificación' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'CALIFICACION_INVALIDA: %', p_rating using errcode = 'P0001';
  end if;

  update public.sessions set rating = p_rating where id = p_session_id;

  -- Promedio móvil ponderado, guardado con 2 decimales.
  update public.tutor_profiles
     set rating = round(((coalesce(rating, 0) * rating_count) + p_rating) / (rating_count + 1)::numeric, 2),
         rating_count = rating_count + 1
   where user_id = v_session.tutor_id
  returning rating, rating_count into v_promedio, v_conteo;

  return jsonb_build_object('session_id', p_session_id, 'rating', p_rating,
                            'tutor_rating', v_promedio, 'rating_count', v_conteo);
end;
$$;

-- =============================================================================
-- Autorización de "actuar en nombre de"
--
-- El backend llama estas funciones con la service role (auth.uid() es NULL),
-- pero si algún día se llaman desde el navegador con la anon key, un usuario
-- solo puede actuar sobre sí mismo. La service role es de confianza.
-- =============================================================================
create or replace function public.current_is_service()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.role(), 'service_role') in ('service_role', 'supabase_admin', 'postgres');
$$;

create or replace function public.assert_can_act_as(p_user uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), 'service_role');
begin
  if p_user is null then
    raise exception 'USUARIO_REQUERIDO: falta p_user' using errcode = 'P0001';
  end if;
  if v_role in ('service_role', 'supabase_admin', 'postgres') then
    return p_user;
  end if;
  if p_user is distinct from auth.uid() then
    raise exception 'NO_AUTORIZADO: no puedes actuar en nombre de otro usuario'
      using errcode = '42501';
  end if;
  return p_user;
end;
$$;

-- ── Canjear créditos por dinero simbólico ───────────────────────────────────
create or replace function public.fn_redeem_credits(
  p_user_id uuid,
  p_credits integer,
  p_method  public.redemption_method default 'gift_card'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := public.assert_can_act_as(p_user_id);
  v_min    integer := public.config_int('min_redemption_credits');
  v_rate   integer := case when p_method = 'discount'
                           then public.config_int('discount_value_cents')
                           else public.config_int('credit_value_cents') end;
  v_balance bigint;
  v_cents  integer;
  v_code   text;
  v_id     uuid;
begin
  if p_credits is null or p_credits < v_min then
    raise exception 'CANJE_MINIMO: el canje mínimo es de % créditos', v_min using errcode = 'P0001';
  end if;
  if p_credits > 100000 then
    raise exception 'CANJE_LIMITE: canje máximo de 100000 créditos' using errcode = 'P0001';
  end if;

  select balance into v_balance from public.credit_accounts where user_id = v_user;
  if coalesce(v_balance, 0) < p_credits then
    raise exception 'SALDO_INSUFICIENTE: tienes % créditos y pediste %', coalesce(v_balance, 0), p_credits
      using errcode = 'P0001';
  end if;

  v_cents := p_credits * v_rate;
  v_code  := upper(substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4));

  -- El saldo sale de la cuenta del usuario hacia la bóveda de la plataforma.
  insert into public.credit_ledger (from_user_id, to_user_id, amount, reason, ref_type, metadata)
  values (v_user, null, p_credits, 'redemption', 'redemption',
          jsonb_build_object('method', p_method, 'cash_value_cents', v_cents, 'code', v_code));

  insert into public.redemptions (user_id, credits, cash_value_cents, method, redemption_code)
  values (v_user, p_credits, v_cents, p_method, v_code)
  returning id into v_id;

  return jsonb_build_object(
    'redemption_id',    v_id,
    'code',             v_code,
    'credits',          p_credits,
    'cash_value_cents', v_cents,
    'currency',         'PEN',
    'method',           p_method,
    'status',           'pending'
  );
end;
$$;

-- ── Descubrimiento: solicitudes abiertas y directorio de tutores ────────────
create or replace function public.fn_open_requests(
  p_subject text default null,
  p_limit   integer default 25
)
returns table (
  id              uuid,
  student_id      uuid,
  student_name    text,
  subject         text,
  title           text,
  description     text,
  urgency         public.request_urgency,
  credits_offered integer,
  created_at      timestamptz
)
language sql
stable
set search_path = public
as $$
  select r.id, r.student_id, p.display_name, r.subject, r.title, r.description,
         r.urgency, r.credits_offered, r.created_at
  from public.help_requests r
  join public.profiles p on p.id = r.student_id
  where r.status = 'open'
    and (p_subject is null or r.subject = p_subject)
    and r.student_id is distinct from auth.uid()
  order by case r.urgency when 'high' then 0 when 'normal' then 1 else 2 end, r.created_at
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

create or replace function public.fn_tutor_directory(
  p_subject text default null,
  p_limit   integer default 25
)
returns table (
  user_id          uuid,
  display_name     text,
  headline         text,
  subjects         text[],
  credits_per_hour integer,
  rating           numeric,
  sessions_completed integer
)
language sql
stable
set search_path = public
as $$
  select t.user_id, p.display_name, t.headline, t.subjects,
         t.credits_per_hour, t.rating, t.sessions_completed
  from public.tutor_profiles t
  join public.profiles p on p.id = t.user_id
  where t.is_verified
    and (p_subject is null or p_subject = any (t.subjects))
  order by t.rating desc nulls last, t.sessions_completed desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- ── Ajuste manual de créditos (solo admin) ──────────────────────────────────
create or replace function public.fn_admin_adjust_credits(
  p_user_id uuid,
  p_amount  integer,
  p_note    text default 'ajuste manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), 'service_role');
begin
  if v_role <> 'service_role' and v_role <> 'supabase_admin' and v_role <> 'postgres' then
    raise exception 'SOLO_ADMIN: requiere rol de servicio' using errcode = '42501';
  end if;
  if p_amount = 0 or p_amount is null then
    raise exception 'AJUSTE_INVALIDO: el monto no puede ser 0' using errcode = 'P0001';
  end if;

  if p_amount > 0 then
    insert into public.credit_ledger (to_user_id, amount, reason, metadata)
    values (p_user_id, p_amount, 'adjustment', jsonb_build_object('note', p_note));
  else
    insert into public.credit_ledger (from_user_id, amount, reason, metadata)
    values (p_user_id, -p_amount, 'adjustment', jsonb_build_object('note', p_note));
  end if;

  return jsonb_build_object('user_id', p_user_id, 'amount', p_amount);
end;
$$;
