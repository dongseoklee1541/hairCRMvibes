-- R-16 local rollback. This removes all R-16 pass/usage/idempotency data.
-- Run only in an explicitly approved environment after taking any required backup.

begin;

drop trigger if exists guard_r16_customer_lifecycle on public.customers;
drop function if exists public.guard_r16_customer_lifecycle();

drop function if exists public.create_customer_session_pass(uuid, text, uuid, integer, date, date, text);
drop function if exists public.update_customer_session_pass(uuid, text, uuid, integer, date, date, text, text, timestamptz);
drop function if exists public.list_customer_session_passes(uuid);
drop function if exists public.list_appointment_session_pass_options(uuid, uuid);
drop function if exists public.create_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, text, uuid, integer, text);
drop function if exists public.update_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, uuid);
drop function if exists public.set_appointment_status(uuid, uuid, text, text, uuid);

drop function if exists private.r16_transition_appointment_usage(uuid, uuid, uuid, text, uuid, uuid, text);
drop function if exists private.r16_appointment_response(uuid);
drop function if exists private.r16_claim_appointment_request(uuid, uuid, text, uuid);
drop function if exists private.r16_remaining_sessions(uuid);
drop function if exists private.r16_require_actor(boolean);

drop table if exists private.appointment_mutation_requests;
drop table if exists public.appointment_session_pass_usages;
drop table if exists public.customer_session_passes;

create function public.set_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_cancel_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_row public.appointments;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '예약 상태를 변경할 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_appointment_id is null then
    raise exception '예약 ID는 필수입니다.' using errcode = '22023';
  end if;
  if p_status not in ('confirmed', 'completed', 'cancelled') then
    raise exception '지원하지 않는 예약 상태입니다.' using errcode = '22023';
  end if;

  update public.appointments
  set status = p_status,
      cancelled_reason = case when p_status = 'cancelled' then coalesce(nullif(btrim(p_cancel_reason), ''), 'manual') else null end,
      cancelled_by = case when p_status = 'cancelled' then v_actor else null end,
      cancelled_at = case when p_status = 'cancelled' then now() else null end,
      updated_at = now()
  where id = p_appointment_id
  returning * into v_row;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.set_appointment_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;

create or replace function public.apply_closed_day_with_cancellations(
  p_closed_date date,
  p_cancel_ids uuid[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_remaining integer;
  v_applied integer := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_role is distinct from 'owner' then
    raise exception '휴무일 설정 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_closed_date is null then
    raise exception '휴무일 날짜는 필수입니다.';
  end if;

  if coalesce(array_length(p_cancel_ids, 1), 0) > 0 then
    update public.appointments
    set status = 'cancelled',
        cancelled_reason = 'closed_day',
        cancelled_by = v_actor,
        cancelled_at = now(),
        updated_at = now()
    where id = any(p_cancel_ids)
      and date = p_closed_date
      and status = 'confirmed';
    get diagnostics v_applied = row_count;
  end if;

  select count(*) into v_remaining
  from public.appointments a
  where a.date = p_closed_date and a.status = 'confirmed';
  if v_remaining > 0 then
    raise exception '해당 날짜에 confirmed 예약이 남아 있어 휴무일로 저장할 수 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (closed_date, note, created_by, updated_by)
  values (p_closed_date, p_note, v_actor, v_actor)
  on conflict (closed_date) do update
  set note = excluded.note, updated_by = v_actor, updated_at = now();

  return jsonb_build_object(
    'closed_date', p_closed_date,
    'cancelled_count', v_applied,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_closed_day_with_cancellations(date, uuid[], text) to authenticated;

create or replace function public.apply_closed_days_batch_with_cancellations(
  p_mode text,
  p_start_date date,
  p_end_date date,
  p_weekday int default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_span_days int;
  v_target_dates date[] := '{}'::date[];
  v_target_count int := 0;
  v_cancelled_count int := 0;
  v_remaining int := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_role is distinct from 'owner' then
    raise exception '휴무일 설정 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_mode not in ('range', 'weekly') then
    raise exception 'p_mode는 range 또는 weekly 여야 합니다.';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception '시작일과 종료일은 필수입니다.';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.';
  end if;
  v_span_days := (p_end_date - p_start_date) + 1;
  if v_span_days > 366 then
    raise exception '휴무일 등록 범위는 최대 366일입니다.';
  end if;
  if p_mode = 'weekly' and (p_weekday is null or p_weekday < 0 or p_weekday > 6) then
    raise exception '정기휴무 요일은 0(일)~6(토) 범위여야 합니다.';
  end if;

  select coalesce(array_agg(d order by d), '{}'::date[]), count(*)::int
  into v_target_dates, v_target_count
  from (
    select gs::date as d
    from generate_series(p_start_date, p_end_date, interval '1 day') gs
    where p_mode = 'range' or extract(dow from gs)::int = p_weekday
  ) target_days;
  if v_target_count = 0 then
    raise exception '선택한 조건에 적용할 휴무일이 없습니다.';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_reason = 'closed_day',
      cancelled_by = v_actor,
      cancelled_at = now(),
      updated_at = now()
  where date = any(v_target_dates) and status = 'confirmed';
  get diagnostics v_cancelled_count = row_count;

  select count(*)::int into v_remaining
  from public.appointments a
  where a.date = any(v_target_dates) and a.status = 'confirmed';
  if v_remaining > 0 then
    raise exception '해당 기간에 confirmed 예약이 남아 있어 휴무일 저장을 완료할 수 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (closed_date, note, created_by, updated_by)
  select d, p_note, v_actor, v_actor from unnest(v_target_dates) as d
  on conflict (closed_date) do update
  set note = excluded.note, updated_by = v_actor, updated_at = now();

  return jsonb_build_object(
    'mode', p_mode,
    'applied_days', v_target_count,
    'cancelled_count', v_cancelled_count,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) from public, anon, authenticated;
grant execute on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) to authenticated;

revoke all on table public.appointments from anon, authenticated;
grant select on table public.appointments to authenticated;
grant insert (
  id, customer_id, date, time, service, service_id, duration, duration_minutes,
  price_snapshot_krw, memo, status, actual_price_krw
) on table public.appointments to authenticated;
grant update (
  customer_id, date, time, service, service_id, duration, duration_minutes,
  price_snapshot_krw, memo, status, updated_at,
  cancelled_at, cancelled_by, cancelled_reason
) on table public.appointments to authenticated;

commit;
