-- R-09: KST date-range statistics aggregate.
--
-- The function returns only completed-appointment KPIs and a bounded service
-- ranking. Customer identifiers and raw appointment rows never cross the RPC
-- boundary. Appointments.date is already a date column, so inclusive date
-- predicates are independent of the browser timezone.

create or replace function public.get_stats_summary(
  p_start_date date,
  p_end_date date
)
returns table (
  period_start date,
  period_end date,
  completed_count bigint,
  revenue_krw bigint,
  paid_completed_count bigint,
  average_ticket_krw bigint,
  zero_price_completed_count bigint,
  missing_price_completed_count bigint,
  missing_price_rate numeric,
  missing_price_without_service_count bigint,
  missing_price_with_service_count bigint,
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

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

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
      a.price_snapshot_krw
    from public.appointments a
    where a.status = 'completed'
      and a.date >= p_start_date
      and a.date <= p_end_date
  ),
  customer_completion_counts as (
    select
      pc.customer_id,
      count(*)::bigint as appointment_count
    from period_completed pc
    group by pc.customer_id
  ),
  summary as (
    select
      count(*)::bigint as completed_count,
      coalesce(sum(pc.price_snapshot_krw) filter (
        where pc.price_snapshot_krw is not null
      ), 0)::bigint as revenue_krw,
      count(*) filter (
        where pc.price_snapshot_krw > 0
      )::bigint as paid_completed_count,
      case
        when count(*) filter (where pc.price_snapshot_krw > 0) = 0 then null
        else round(
          (sum(pc.price_snapshot_krw) filter (where pc.price_snapshot_krw > 0))::numeric
          / count(*) filter (where pc.price_snapshot_krw > 0)
        )::bigint
      end as average_ticket_krw,
      count(*) filter (
        where pc.price_snapshot_krw = 0
      )::bigint as zero_price_completed_count,
      count(*) filter (
        where pc.price_snapshot_krw is null
      )::bigint as missing_price_completed_count,
      count(*) filter (
        where pc.price_snapshot_krw is null and pc.service_id is null
      )::bigint as missing_price_without_service_count,
      count(*) filter (
        where pc.price_snapshot_krw is null and pc.service_id is not null
      )::bigint as missing_price_with_service_count
    from period_completed pc
  ),
  customer_summary as (
    select
      count(*)::bigint as completed_customer_count,
      count(*) filter (
        where ccc.appointment_count >= 2
      )::bigint as repeat_customer_count
    from customer_completion_counts ccc
  ),
  service_metrics as (
    select
      pc.service_name,
      count(*)::bigint as completed_count,
      coalesce(sum(pc.price_snapshot_krw) filter (
        where pc.price_snapshot_krw is not null
      ), 0)::bigint as revenue_krw,
      count(*) filter (
        where pc.price_snapshot_krw > 0
      )::bigint as paid_completed_count,
      case
        when count(*) filter (where pc.price_snapshot_krw > 0) = 0 then null
        else round(
          (sum(pc.price_snapshot_krw) filter (where pc.price_snapshot_krw > 0))::numeric
          / count(*) filter (where pc.price_snapshot_krw > 0)
        )::bigint
      end as average_ticket_krw,
      count(*) filter (
        where pc.price_snapshot_krw is null
      )::bigint as missing_price_count
    from period_completed pc
    group by pc.service_name
  ),
  top_services as (
    select sm.*
    from service_metrics sm
    order by
      sm.completed_count desc,
      sm.revenue_krw desc,
      sm.service_name asc
    limit 5
  ),
  service_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'service_name', ts.service_name,
          'completed_count', ts.completed_count,
          'revenue_krw', ts.revenue_krw,
          'paid_completed_count', ts.paid_completed_count,
          'average_ticket_krw', ts.average_ticket_krw,
          'missing_price_count', ts.missing_price_count
        )
        order by
          ts.completed_count desc,
          ts.revenue_krw desc,
          ts.service_name asc
      ),
      '[]'::jsonb
    ) as service_breakdown
    from top_services ts
  )
  select
    p_start_date,
    p_end_date,
    s.completed_count,
    s.revenue_krw,
    s.paid_completed_count,
    s.average_ticket_krw,
    s.zero_price_completed_count,
    s.missing_price_completed_count,
    case
      when s.completed_count = 0 then null
      else round(s.missing_price_completed_count::numeric * 100 / s.completed_count, 1)
    end as missing_price_rate,
    s.missing_price_without_service_count,
    s.missing_price_with_service_count,
    cs.completed_customer_count,
    cs.repeat_customer_count,
    case
      when cs.completed_customer_count = 0 then null
      else round(cs.repeat_customer_count::numeric * 100 / cs.completed_customer_count, 1)
    end as repeat_rate,
    sj.service_breakdown
  from summary s
  cross join customer_summary cs
  cross join service_json sj;
end;
$$;

comment on function public.get_stats_summary(date, date) is
  'R-09 KST date-range aggregate. Returns KPI values and at most five service snapshot rows without customer PII or raw appointments.';

revoke all on function public.get_stats_summary(date, date) from public;
revoke all on function public.get_stats_summary(date, date) from anon;
revoke all on function public.get_stats_summary(date, date) from authenticated;
grant execute on function public.get_stats_summary(date, date) to authenticated;
