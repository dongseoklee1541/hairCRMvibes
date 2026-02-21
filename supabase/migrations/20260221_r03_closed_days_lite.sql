-- ==========================================
-- R-03 Lite 확장: 기간/정기 등록 + 기간 해제
-- ==========================================

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

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

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

  if p_mode = 'weekly' then
    if p_weekday is null or p_weekday < 0 or p_weekday > 6 then
      raise exception '정기휴무 요일은 0(일)~6(토) 범위여야 합니다.';
    end if;
  end if;

  select
    coalesce(array_agg(d order by d), '{}'::date[]),
    count(*)::int
  into v_target_dates, v_target_count
  from (
    select gs::date as d
    from generate_series(p_start_date, p_end_date, interval '1 day') gs
    where p_mode = 'range'
      or extract(dow from gs)::int = p_weekday
  ) target_days;

  if v_target_count = 0 then
    raise exception '선택한 조건에 적용할 휴무일이 없습니다.';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_reason = 'closed_day',
    cancelled_by = v_actor,
    cancelled_at = now(),
    updated_at = now()
  where date = any(v_target_dates)
    and status = 'confirmed';

  get diagnostics v_cancelled_count = row_count;

  select count(*)::int
  into v_remaining
  from public.appointments a
  where a.date = any(v_target_dates)
    and a.status = 'confirmed';

  if v_remaining > 0 then
    raise exception '해당 기간에 confirmed 예약이 남아 있어 휴무일 저장을 완료할 수 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (
    closed_date,
    note,
    created_by,
    updated_by
  )
  select
    d,
    p_note,
    v_actor,
    v_actor
  from unnest(v_target_dates) as d
  on conflict (closed_date) do update
  set
    note = excluded.note,
    updated_by = v_actor,
    updated_at = now();

  return jsonb_build_object(
    'mode', p_mode,
    'applied_days', v_target_count,
    'cancelled_count', v_cancelled_count,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) from public;
grant execute on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) to authenticated;

create or replace function public.remove_closed_day_range(
  p_start_date date,
  p_end_date date
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
  v_removed_count int := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '휴무일 해제 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception '시작일과 종료일은 필수입니다.';
  end if;

  if p_end_date < p_start_date then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.';
  end if;

  v_span_days := (p_end_date - p_start_date) + 1;
  if v_span_days > 366 then
    raise exception '휴무일 해제 범위는 최대 366일입니다.';
  end if;

  delete from public.salon_closed_dates
  where closed_date >= p_start_date
    and closed_date <= p_end_date;

  get diagnostics v_removed_count = row_count;

  return jsonb_build_object(
    'removed_days', v_removed_count
  );
end;
$$;

revoke all on function public.remove_closed_day_range(date, date) from public;
grant execute on function public.remove_closed_day_range(date, date) to authenticated;
