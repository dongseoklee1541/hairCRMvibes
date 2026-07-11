-- ==========================================
-- R-03: 더블부킹/영업시간 충돌 방지
-- ==========================================

alter table public.appointments
  add column if not exists duration_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_duration_minutes_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_duration_minutes_check check (
        duration_minutes is null or (duration_minutes >= 15 and duration_minutes <= 480)
      );
  end if;
end $$;

create index if not exists appointments_confirmed_slot_idx
  on public.appointments (date, time)
  where status = 'confirmed';

create or replace function public.parse_duration_minutes(p_duration text)
returns integer
language plpgsql
immutable
as $$
declare
  v_text text := btrim(coalesce(p_duration, ''));
  v_hours integer := 0;
  v_minutes integer := 0;
  v_match text[];
begin
  if v_text = '' then
    return null;
  end if;

  if v_text ~ '^[0-9]+$' then
    return v_text::integer;
  end if;

  v_match := regexp_match(v_text, '([0-9]+)\s*시간');
  if v_match is not null then
    v_hours := v_match[1]::integer;
  end if;

  v_match := regexp_match(v_text, '([0-9]+)\s*분');
  if v_match is not null then
    v_minutes := v_match[1]::integer;
  end if;

  if v_hours = 0 and v_minutes = 0 then
    return null;
  end if;

  return (v_hours * 60) + v_minutes;
end;
$$;

revoke all on function public.parse_duration_minutes(text) from public;
grant execute on function public.parse_duration_minutes(text) to authenticated;

create or replace function public.resolve_appointment_duration_minutes(
  p_duration_minutes integer,
  p_duration text
)
returns integer
language plpgsql
stable
as $$
declare
  v_default integer := 60;
  v_resolved integer;
begin
  select s.default_duration_minutes
  into v_default
  from public.salon_operation_settings s
  where s.id = true;

  v_resolved := coalesce(
    p_duration_minutes,
    public.parse_duration_minutes(p_duration),
    v_default,
    60
  );

  if v_resolved < 15 or v_resolved > 480 then
    raise exception '예약 소요시간은 15분 이상 480분 이하만 가능합니다.' using errcode = '22023';
  end if;

  return v_resolved;
end;
$$;

revoke all on function public.resolve_appointment_duration_minutes(integer, text) from public;
grant execute on function public.resolve_appointment_duration_minutes(integer, text) to authenticated;

create or replace function public.guard_appointment_conflict_and_business_hours()
returns trigger
language plpgsql
as $$
declare
  v_weekday integer;
  v_is_open boolean := true;
  v_open_time time := '10:00'::time;
  v_close_time time := '19:00'::time;
  v_break_start time;
  v_break_end time;
  v_duration integer;
  v_start interval;
  v_end interval;
  v_open interval;
  v_close interval;
  v_break_start_i interval;
  v_break_end_i interval;
  v_conflict record;
begin
  if new.status is distinct from 'confirmed' then
    return new;
  end if;

  perform pg_advisory_xact_lock(20260706, hashtext(new.date::text));

  v_duration := public.resolve_appointment_duration_minutes(new.duration_minutes, new.duration);
  new.duration_minutes := v_duration;

  v_weekday := extract(dow from new.date)::integer;

  select
    bh.is_open,
    bh.open_time,
    bh.close_time,
    bh.break_start,
    bh.break_end
  into
    v_is_open,
    v_open_time,
    v_close_time,
    v_break_start,
    v_break_end
  from public.salon_business_hours bh
  where bh.weekday = v_weekday;

  if not found then
    v_is_open := true;
    v_open_time := '10:00'::time;
    v_close_time := '19:00'::time;
    v_break_start := null;
    v_break_end := null;
  end if;

  if v_is_open is false then
    raise exception '선택한 날짜는 영업일이 아닙니다.' using errcode = 'P0001';
  end if;

  v_start := new.time - time '00:00';
  v_end := v_start + make_interval(mins => v_duration);
  v_open := v_open_time - time '00:00';
  v_close := v_close_time - time '00:00';

  if v_start < v_open or v_end > v_close then
    raise exception '예약 시간이 영업시간을 벗어납니다.' using errcode = 'P0001';
  end if;

  if v_break_start is not null and v_break_end is not null then
    v_break_start_i := v_break_start - time '00:00';
    v_break_end_i := v_break_end - time '00:00';

    if v_start < v_break_end_i and v_end > v_break_start_i then
      raise exception '예약 시간이 휴게시간과 겹칩니다.' using errcode = 'P0001';
    end if;
  end if;

  select
    a.id,
    a.time,
    public.resolve_appointment_duration_minutes(a.duration_minutes, a.duration) as duration_minutes
  into v_conflict
  from public.appointments a
  where a.date = new.date
    and a.status = 'confirmed'
    and a.id is distinct from new.id
    and (a.time - time '00:00') < v_end
    and (
      (a.time - time '00:00')
      + make_interval(mins => public.resolve_appointment_duration_minutes(a.duration_minutes, a.duration))
    ) > v_start
  order by a.time
  limit 1;

  if found then
    raise exception '같은 시간대에 이미 확정 예약이 있습니다.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_appointment_conflict_and_business_hours() from public;

drop trigger if exists guard_appointment_conflict_and_business_hours on public.appointments;
create trigger guard_appointment_conflict_and_business_hours
  before insert or update of date, time, duration, duration_minutes, status
  on public.appointments
  for each row execute function public.guard_appointment_conflict_and_business_hours();
