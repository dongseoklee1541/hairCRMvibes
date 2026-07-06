-- ==========================================
-- 미용실 CRM 데이터베이스 스키마
-- ==========================================

-- 1. Customers 테이블
create table public.customers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_pkey primary key (id)
);

-- 2. Appointments 테이블
create table public.appointments (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  date date not null,
  time time not null,
  service text not null,
  duration text, -- 예상 소요시간 (예: "1시간 30분")
  duration_minutes integer,
  memo text,
  status text not null default 'confirmed', -- confirmed, completed, cancelled
  created_at timestamptz not null default now(),
  constraint appointments_pkey primary key (id),
  constraint appointments_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete cascade,
  constraint appointments_status_check check (status in ('confirmed', 'completed', 'cancelled')),
  constraint appointments_duration_minutes_check check (
    duration_minutes is null or (duration_minutes >= 15 and duration_minutes <= 480)
  )
);

-- 3. RLS (Row Level Security) 기본 설정

alter table public.customers enable row level security;
alter table public.appointments enable row level security;

revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select, insert, update, delete on table public.customers to authenticated;

revoke all on table public.appointments from anon;
revoke all on table public.appointments from authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;

-- 4. 실시간 구독 설정 (선택 사항)
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.appointments;

-- ==========================================
-- 5. 사용자 프로필(역할) 테이블
-- ==========================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

create policy "Authenticated users can read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

with missing_users as (
  select
    u.id,
    row_number() over (order by u.created_at, u.id) as ordinal
  from auth.users u
  where not exists (
    select 1
    from public.profiles p
    where p.id = u.id
  )
),
owner_state as (
  select exists (
    select 1
    from public.profiles p
    where p.role = 'owner'
  ) as has_owner
)
insert into public.profiles (id, role)
select
  missing_users.id,
  case
    when owner_state.has_owner = false and missing_users.ordinal = 1 then 'owner'::text
    else 'staff'::text
  end
from missing_users
cross join owner_state
on conflict (id) do nothing;

create or replace function public.ensure_user_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case
      when exists (select 1 from public.profiles p where p.role = 'owner') then 'staff'::text
      else 'owner'::text
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger if not exists create_profile_for_new_user
  after insert on auth.users
  for each row execute function public.ensure_user_profile_role();

-- ==========================================
-- 6. Customers/Appointments 정책 보강
-- ==========================================

create policy "Owner and staff can manage customers"
  on public.customers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owner and staff can manage appointments"
  on public.appointments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

-- ==========================================
-- 7. R-03 MVP (휴무일/충돌 방지/취소 감사)
-- ==========================================

alter table public.appointments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id),
  add column if not exists cancelled_reason text;

create table if not exists public.salon_closed_dates (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  note text,
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salon_closed_dates enable row level security;

revoke all on table public.salon_closed_dates from anon;
revoke all on table public.salon_closed_dates from authenticated;
grant select, insert, update, delete on table public.salon_closed_dates to authenticated;

drop policy if exists "Owner and staff can read closed dates" on public.salon_closed_dates;
create policy "Owner and staff can read closed dates"
  on public.salon_closed_dates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;
create policy "Owners can manage closed dates"
  on public.salon_closed_dates
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists set_closed_dates_updated_at on public.salon_closed_dates;
create trigger set_closed_dates_updated_at
  before update on public.salon_closed_dates
  for each row execute function public.set_updated_at();

create or replace function public.fill_cancel_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status is distinct from 'cancelled') then
    new.cancelled_at = coalesce(new.cancelled_at, now());
    new.cancelled_by = coalesce(new.cancelled_by, auth.uid());
    new.cancelled_reason = coalesce(nullif(new.cancelled_reason, ''), 'manual');
  elsif new.status is distinct from 'cancelled' then
    new.cancelled_at = null;
    new.cancelled_by = null;
    new.cancelled_reason = null;
  end if;

  return new;
end;
$$;

drop trigger if exists fill_appointments_cancel_audit on public.appointments;
create trigger fill_appointments_cancel_audit
  before insert or update on public.appointments
  for each row execute function public.fill_cancel_audit_fields();

create or replace function public.guard_closed_day_appointment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmed'
     and exists (
       select 1
       from public.salon_closed_dates scd
       where scd.closed_date = new.date
     ) then
    raise exception '해당 날짜는 휴무일로 설정되어 예약할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_closed_day_appointment on public.appointments;
create trigger guard_closed_day_appointment
  before insert or update of date, status on public.appointments
  for each row execute function public.guard_closed_day_appointment();

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

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '휴무일 설정 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_closed_date is null then
    raise exception '휴무일 날짜는 필수입니다.';
  end if;

  if coalesce(array_length(p_cancel_ids, 1), 0) > 0 then
    update public.appointments
    set
      status = 'cancelled',
      cancelled_reason = 'closed_day',
      cancelled_by = v_actor,
      cancelled_at = now(),
      updated_at = now()
    where id = any (p_cancel_ids)
      and date = p_closed_date
      and status = 'confirmed';

    get diagnostics v_applied = row_count;
  end if;

  select count(*)
  into v_remaining
  from public.appointments a
  where a.date = p_closed_date
    and a.status = 'confirmed';

  if v_remaining > 0 then
    raise exception '해당 날짜에 confirmed 예약이 남아 있어 휴무일로 저장할 수 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (
    closed_date,
    note,
    created_by,
    updated_by
  )
  values (
    p_closed_date,
    p_note,
    v_actor,
    v_actor
  )
  on conflict (closed_date) do update
  set
    note = excluded.note,
    updated_by = v_actor,
    updated_at = now();

  return jsonb_build_object(
    'closed_date', p_closed_date,
    'cancelled_count', v_applied,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from public;
grant execute on function public.apply_closed_day_with_cancellations(date, uuid[], text) to authenticated;

-- ==========================================
-- 8. R-03 Lite 확장 (기간/정기 등록 + 기간 해제)
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

-- ==========================================
-- 9. R-05 설정: 영업시간/기본 시술/기본 소요시간
-- ==========================================

create table if not exists public.salon_operation_settings (
  id boolean primary key default true,
  default_service_name text not null default '커트',
  default_duration_minutes integer not null default 60,
  appointment_slot_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_operation_settings_singleton check (id),
  constraint salon_operation_settings_default_duration_check check (
    default_duration_minutes >= 15 and default_duration_minutes <= 480
  ),
  constraint salon_operation_settings_slot_check check (
    appointment_slot_minutes in (5, 10, 15, 20, 30, 45, 60)
  )
);

create table if not exists public.salon_business_hours (
  weekday integer primary key check (weekday >= 0 and weekday <= 6),
  is_open boolean not null default true,
  open_time time not null default '10:00',
  close_time time not null default '19:00',
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_business_hours_open_range_check check (
    is_open = false or open_time < close_time
  ),
  constraint salon_business_hours_break_range_check check (
    (break_start is null and break_end is null)
    or (
      break_start is not null
      and break_end is not null
      and open_time < break_start
      and break_start < break_end
      and break_end < close_time
    )
  )
);

create table if not exists public.salon_service_defaults (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_duration_minutes integer not null default 60,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_service_defaults_name_check check (btrim(name) <> ''),
  constraint salon_service_defaults_duration_check check (
    default_duration_minutes >= 15 and default_duration_minutes <= 480
  ),
  constraint salon_service_defaults_name_key unique (name)
);

insert into public.salon_operation_settings (id)
values (true)
on conflict (id) do nothing;

insert into public.salon_business_hours (weekday, is_open, open_time, close_time)
select weekday, true, '10:00'::time, '19:00'::time
from generate_series(0, 6) as weekday
on conflict (weekday) do nothing;

insert into public.salon_service_defaults (name, default_duration_minutes, sort_order)
values
  ('커트', 60, 10),
  ('염색', 120, 20),
  ('펌', 120, 30),
  ('클리닉', 60, 40)
on conflict (name) do nothing;

alter table public.salon_operation_settings enable row level security;
alter table public.salon_business_hours enable row level security;
alter table public.salon_service_defaults enable row level security;

revoke all on table public.salon_operation_settings from anon;
revoke all on table public.salon_operation_settings from authenticated;
grant select, insert, update, delete on table public.salon_operation_settings to authenticated;

revoke all on table public.salon_business_hours from anon;
revoke all on table public.salon_business_hours from authenticated;
grant select, insert, update, delete on table public.salon_business_hours to authenticated;

revoke all on table public.salon_service_defaults from anon;
revoke all on table public.salon_service_defaults from authenticated;
grant select, insert, update, delete on table public.salon_service_defaults to authenticated;

create policy "Owner and staff can read operation settings"
  on public.salon_operation_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owners can manage operation settings"
  on public.salon_operation_settings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create policy "Owner and staff can read business hours"
  on public.salon_business_hours
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owners can manage business hours"
  on public.salon_business_hours
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create policy "Owner and staff can read service defaults"
  on public.salon_service_defaults
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owners can manage service defaults"
  on public.salon_service_defaults
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

drop trigger if exists set_operation_settings_updated_at on public.salon_operation_settings;
create trigger set_operation_settings_updated_at
  before update on public.salon_operation_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_business_hours_updated_at on public.salon_business_hours;
create trigger set_business_hours_updated_at
  before update on public.salon_business_hours
  for each row execute function public.set_updated_at();

drop trigger if exists set_service_defaults_updated_at on public.salon_service_defaults;
create trigger set_service_defaults_updated_at
  before update on public.salon_service_defaults
  for each row execute function public.set_updated_at();

-- ==========================================
-- 10. R-03 잔여: 더블부킹/영업시간 충돌 방지
-- ==========================================

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

-- ==========================================
-- 11. R-02 예약 상태변경/취소 기반
-- ==========================================

create or replace function public.set_appointment_status(
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

  select p.role
  into v_role
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
  set
    status = p_status,
    cancelled_reason = case
      when p_status = 'cancelled' then coalesce(nullif(btrim(p_cancel_reason), ''), 'manual')
      else null
    end,
    cancelled_by = case
      when p_status = 'cancelled' then v_actor
      else null
    end,
    cancelled_at = case
      when p_status = 'cancelled' then now()
      else null
    end,
    updated_at = now()
  where id = p_appointment_id
  returning * into v_row;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.set_appointment_status(uuid, text, text) from public;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;
