-- R-15: customer-specific actual service prices.
-- price_snapshot_krw remains the booking-time service-master snapshot.

alter table public.appointments
  add column if not exists actual_price_krw integer,
  add column if not exists actual_price_updated_at timestamptz,
  add column if not exists actual_price_updated_by uuid references auth.users(id),
  add column if not exists actual_price_update_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_actual_price_krw_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_actual_price_krw_check check (
        actual_price_krw is null or actual_price_krw >= 0
      );
  end if;
end
$$;

create or replace function public.guard_appointment_actual_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  -- 빈 실제 금액은 감사 필드도 비워 둔다. 기존 이력을 추정하지 않는다.
  if tg_op = 'INSERT' and new.actual_price_krw is null then
    if new.actual_price_updated_at is not null
       or new.actual_price_updated_by is not null
       or nullif(btrim(coalesce(new.actual_price_update_reason, '')), '') is not null then
      raise exception '실제 금액이 없으면 실제 금액 감사 필드를 기록할 수 없습니다.' using errcode = '22023';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.actual_price_krw is not distinct from old.actual_price_krw then
    if new.actual_price_updated_at is distinct from old.actual_price_updated_at
       or new.actual_price_updated_by is distinct from old.actual_price_updated_by
       or new.actual_price_update_reason is distinct from old.actual_price_update_reason then
      raise exception '실제 금액 감사 필드는 실제 금액 변경 없이 수정할 수 없습니다.' using errcode = '42501';
    end if;
    return new;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '실제 금액을 기록할 권한이 없습니다.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and current_setting('app.r15_actual_price_rpc', true) is distinct from 'on' then
    raise exception '실제 금액 변경은 전용 RPC를 사용해야 합니다.' using errcode = '42501';
  end if;

  new.actual_price_update_reason := nullif(btrim(coalesce(new.actual_price_update_reason, '')), '');
  if new.status = 'completed' and new.actual_price_update_reason is null then
    raise exception '완료 예약의 실제 금액 변경 사유가 필요합니다.' using errcode = '22023';
  end if;

  new.actual_price_updated_at := clock_timestamp();
  new.actual_price_updated_by := v_actor;
  return new;
end;
$$;

revoke all on function public.guard_appointment_actual_price() from public, anon, authenticated;

drop trigger if exists guard_appointment_actual_price on public.appointments;
create trigger guard_appointment_actual_price
  before insert or update of actual_price_krw, actual_price_updated_at, actual_price_updated_by, actual_price_update_reason
  on public.appointments
  for each row execute function public.guard_appointment_actual_price();

create or replace function public.set_appointment_actual_price(
  p_appointment_id uuid,
  p_actual_price_krw integer,
  p_expected_actual_price_updated_at timestamptz,
  p_update_reason text default null
)
returns table (
  actual_price_krw integer,
  actual_price_updated_at timestamptz,
  actual_price_updated_by uuid,
  actual_price_update_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_appointment public.appointments%rowtype;
  v_reason text := nullif(btrim(coalesce(p_update_reason, '')), '');
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '실제 금액을 수정할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_appointment_id is null then
    raise exception '예약 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_actual_price_krw is not null and p_actual_price_krw < 0 then
    raise exception '실제 금액은 0원 이상이어야 합니다.' using errcode = '22023';
  end if;

  select a.* into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.customers c
    where c.id = v_appointment.customer_id
      and (c.archived_at is not null or c.merged_into_customer_id is not null or c.anonymized_at is not null)
  ) then
    raise exception '읽기 전용 고객의 실제 금액은 수정할 수 없습니다.' using errcode = '42501';
  end if;

  if v_appointment.actual_price_updated_at is distinct from p_expected_actual_price_updated_at then
    raise exception '다른 사용자가 실제 금액을 먼저 수정했습니다. 최신 값을 다시 불러오세요.' using errcode = '40001';
  end if;

  if v_appointment.actual_price_krw is not distinct from p_actual_price_krw then
    return query
    select v_appointment.actual_price_krw, v_appointment.actual_price_updated_at,
      v_appointment.actual_price_updated_by, v_appointment.actual_price_update_reason;
    return;
  end if;

  if v_appointment.status = 'completed' and v_reason is null then
    raise exception '완료 예약의 실제 금액 변경 사유가 필요합니다.' using errcode = '22023';
  end if;

  perform set_config('app.r15_actual_price_rpc', 'on', true);
  return query
  update public.appointments a
  set actual_price_krw = p_actual_price_krw,
      actual_price_update_reason = v_reason
  where a.id = v_appointment.id
  returning a.actual_price_krw, a.actual_price_updated_at,
    a.actual_price_updated_by, a.actual_price_update_reason;
end;
$$;

revoke all on function public.set_appointment_actual_price(uuid, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.set_appointment_actual_price(uuid, integer, timestamptz, text) to authenticated;

-- Data API can insert a new optional actual price on create, but audit fields and
-- actual-price updates stay RPC-only. actual_price_update_reason is intentionally
-- absent from INSERT grants so clients cannot forge audit reasons.
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

-- R-15 replaces the R-09 snapshot-led revenue names with explicit actual-price
-- and booking-snapshot measures. It intentionally has no snapshot fallback.
drop function if exists public.get_stats_summary(date, date);
create function public.get_stats_summary(
  p_start_date date,
  p_end_date date
)
returns table (
  period_start date,
  period_end date,
  completed_count bigint,
  actual_revenue_krw bigint,
  paid_actual_completed_count bigint,
  actual_average_ticket_krw bigint,
  zero_actual_price_completed_count bigint,
  missing_actual_price_completed_count bigint,
  missing_actual_price_rate numeric,
  missing_actual_price_without_service_count bigint,
  missing_actual_price_with_service_count bigint,
  booking_snapshot_revenue_krw bigint,
  booking_snapshot_priced_completed_count bigint,
  booking_snapshot_missing_completed_count bigint,
  completed_customer_count bigint,
  repeat_customer_count bigint,
  repeat_rate numeric,
  service_breakdown jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '통계를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception '시작일과 종료일은 필수입니다.' using errcode = '22023';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.' using errcode = '22023';
  end if;
  if p_end_date - p_start_date > 365 then
    raise exception '조회 기간은 최대 366일까지 선택할 수 있습니다.' using errcode = '22023';
  end if;

  return query
  with period_completed as materialized (
    select
      a.customer_id,
      coalesce(nullif(btrim(a.service), ''), '기타') as service_name,
      a.service_id,
      a.actual_price_krw,
      a.price_snapshot_krw
    from public.appointments a
    where a.status = 'completed'
      and a.date >= p_start_date
      and a.date <= p_end_date
  ), customer_completion_counts as (
    select customer_id, count(*)::bigint as appointment_count
    from period_completed
    group by customer_id
  ), summary as (
    select
      count(*)::bigint as completed_count,
      coalesce(sum(actual_price_krw) filter (where actual_price_krw is not null), 0)::bigint as actual_revenue_krw,
      count(*) filter (where actual_price_krw > 0)::bigint as paid_actual_completed_count,
      case when count(*) filter (where actual_price_krw > 0) = 0 then null
        else round((sum(actual_price_krw) filter (where actual_price_krw > 0))::numeric / count(*) filter (where actual_price_krw > 0))::bigint end as actual_average_ticket_krw,
      count(*) filter (where actual_price_krw = 0)::bigint as zero_actual_price_completed_count,
      count(*) filter (where actual_price_krw is null)::bigint as missing_actual_price_completed_count,
      count(*) filter (where actual_price_krw is null and service_id is null)::bigint as missing_actual_price_without_service_count,
      count(*) filter (where actual_price_krw is null and service_id is not null)::bigint as missing_actual_price_with_service_count,
      coalesce(sum(price_snapshot_krw) filter (where price_snapshot_krw is not null), 0)::bigint as booking_snapshot_revenue_krw,
      count(*) filter (where price_snapshot_krw is not null)::bigint as booking_snapshot_priced_completed_count,
      count(*) filter (where price_snapshot_krw is null)::bigint as booking_snapshot_missing_completed_count
    from period_completed
  ), customer_summary as (
    select count(*)::bigint as completed_customer_count,
      count(*) filter (where appointment_count >= 2)::bigint as repeat_customer_count
    from customer_completion_counts
  ), service_metrics as (
    select
      service_name,
      count(*)::bigint as completed_count,
      coalesce(sum(actual_price_krw) filter (where actual_price_krw is not null), 0)::bigint as actual_revenue_krw,
      count(*) filter (where actual_price_krw > 0)::bigint as paid_actual_completed_count,
      case when count(*) filter (where actual_price_krw > 0) = 0 then null
        else round((sum(actual_price_krw) filter (where actual_price_krw > 0))::numeric / count(*) filter (where actual_price_krw > 0))::bigint end as actual_average_ticket_krw,
      count(*) filter (where actual_price_krw is null)::bigint as missing_actual_price_count,
      coalesce(sum(price_snapshot_krw) filter (where price_snapshot_krw is not null), 0)::bigint as booking_snapshot_revenue_krw
    from period_completed
    group by service_name
  ), top_services as (
    select * from service_metrics
    order by completed_count desc, actual_revenue_krw desc, service_name asc
    limit 5
  ), service_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'service_name', ts.service_name,
      'completed_count', ts.completed_count,
      'actual_revenue_krw', ts.actual_revenue_krw,
      'paid_actual_completed_count', ts.paid_actual_completed_count,
      'actual_average_ticket_krw', ts.actual_average_ticket_krw,
      'missing_actual_price_count', ts.missing_actual_price_count,
      'booking_snapshot_revenue_krw', ts.booking_snapshot_revenue_krw
    ) order by ts.completed_count desc, ts.actual_revenue_krw desc, ts.service_name asc), '[]'::jsonb) as service_breakdown
    from top_services ts
  )
  select
    p_start_date, p_end_date,
    s.completed_count, s.actual_revenue_krw, s.paid_actual_completed_count,
    s.actual_average_ticket_krw, s.zero_actual_price_completed_count,
    s.missing_actual_price_completed_count,
    case when s.completed_count = 0 then null else round(s.missing_actual_price_completed_count::numeric * 100 / s.completed_count, 1) end,
    s.missing_actual_price_without_service_count, s.missing_actual_price_with_service_count,
    s.booking_snapshot_revenue_krw, s.booking_snapshot_priced_completed_count, s.booking_snapshot_missing_completed_count,
    cs.completed_customer_count, cs.repeat_customer_count,
    case when cs.completed_customer_count = 0 then null else round(cs.repeat_customer_count::numeric * 100 / cs.completed_customer_count, 1) end,
    sj.service_breakdown
  from summary s cross join customer_summary cs cross join service_json sj;
end;
$$;

comment on function public.get_stats_summary(date, date) is
  'R-15 KST aggregate. Actual revenue uses completed actual_price_krw only; booking snapshots are separate auxiliary measures and never a fallback.';

revoke all on function public.get_stats_summary(date, date) from public, anon, authenticated;
grant execute on function public.get_stats_summary(date, date) to authenticated;
