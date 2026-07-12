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
  service_id uuid,
  duration text, -- 예상 소요시간 (예: "1시간 30분")
  duration_minutes integer,
  price_snapshot_krw integer,
  memo text,
  status text not null default 'confirmed', -- confirmed, completed, cancelled
  created_at timestamptz not null default now(),
  constraint appointments_pkey primary key (id),
  constraint appointments_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete restrict,
  constraint appointments_status_check check (status in ('confirmed', 'completed', 'cancelled')),
  constraint appointments_duration_minutes_check check (
    duration_minutes is null or (duration_minutes >= 15 and duration_minutes <= 480)
  ),
  constraint appointments_price_snapshot_krw_check check (
    price_snapshot_krw is null or price_snapshot_krw >= 0
  )
);

-- 3. RLS (Row Level Security) 기본 설정

alter table public.customers enable row level security;
alter table public.appointments enable row level security;

revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select, insert, update on table public.customers to authenticated;

revoke all on table public.appointments from anon;
revoke all on table public.appointments from authenticated;
grant select, insert, update on table public.appointments to authenticated;

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

-- 신규 Auth 사용자의 profile/role은 초대 또는 운영 절차에서 명시적으로
-- 생성합니다. 첫 가입자를 자동 owner로 승격하는 auth.users trigger는
-- 보안 경계가 합의될 때까지 schema snapshot과 live DB 모두에 두지 않습니다.

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
set search_path = public
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
set search_path = public
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
set search_path = public
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
revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from anon;
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
revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) from anon;
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
revoke all on function public.remove_closed_day_range(date, date) from anon;
grant execute on function public.remove_closed_day_range(date, date) to authenticated;

-- ==========================================
-- 9. R-05 설정: 영업시간/기본 시술/기본 소요시간
-- ==========================================

create table if not exists public.salon_operation_settings (
  id boolean primary key default true,
  default_service_name text not null default '커트',
  default_service_id uuid,
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
  price_krw integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_service_defaults_name_check check (btrim(name) <> ''),
  constraint salon_service_defaults_duration_check check (
    default_duration_minutes >= 15 and default_duration_minutes <= 480
  ),
  constraint salon_service_defaults_price_krw_check check (
    price_krw is null or price_krw >= 0
  ),
  constraint salon_service_defaults_name_key unique (name)
);

alter table public.salon_operation_settings
  add constraint salon_operation_settings_default_service_id_fkey
  foreign key (default_service_id)
  references public.salon_service_defaults (id)
  on delete set null;

alter table public.appointments
  add constraint appointments_service_id_fkey
  foreign key (service_id)
  references public.salon_service_defaults (id)
  on delete restrict;

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
grant select, insert, update on table public.salon_service_defaults to authenticated;

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

create policy "Owners can create service defaults"
  on public.salon_service_defaults
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create policy "Owners can update service defaults"
  on public.salon_service_defaults
  for update
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

create or replace function public.guard_active_default_service()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- default 지정과 service 비활성화의 cross-table write skew를 직렬화한다.
  perform pg_catalog.pg_advisory_xact_lock(20260712, 8);

  if new.default_service_id is not null
     and not exists (
       select 1
       from public.salon_service_defaults s
       where s.id = new.default_service_id
         and s.is_active is true
     ) then
    raise exception '기본 서비스는 활성 서비스만 선택할 수 있습니다.' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_active_default_service() from public;
revoke all on function public.guard_active_default_service() from anon;
revoke all on function public.guard_active_default_service() from authenticated;

drop trigger if exists guard_active_default_service on public.salon_operation_settings;
create trigger guard_active_default_service
  before insert or update of default_service_id
  on public.salon_operation_settings
  for each row execute function public.guard_active_default_service();

create or replace function public.guard_default_service_deactivation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- guard_active_default_service()와 동일한 transaction lock을 사용한다.
  perform pg_catalog.pg_advisory_xact_lock(20260712, 8);

  if old.is_active is true
     and new.is_active is false
     and exists (
       select 1
       from public.salon_operation_settings s
       where s.id = true
         and s.default_service_id = old.id
     ) then
    raise exception '현재 기본 서비스는 비활성화할 수 없습니다. 다른 기본 서비스를 먼저 선택하세요.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_default_service_deactivation() from public;
revoke all on function public.guard_default_service_deactivation() from anon;
revoke all on function public.guard_default_service_deactivation() from authenticated;

drop trigger if exists guard_default_service_deactivation on public.salon_service_defaults;
create trigger guard_default_service_deactivation
  before update of is_active
  on public.salon_service_defaults
  for each row execute function public.guard_default_service_deactivation();

-- ==========================================
-- 10. R-08 서비스 마스터/예약 snapshot
-- ==========================================

create index if not exists appointments_service_id_idx
  on public.appointments (service_id);

create or replace function public.apply_appointment_service_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_price_krw integer;
  v_default_duration_minutes integer;
  v_is_active boolean;
  v_refresh_snapshot boolean;
  v_requires_active_check boolean;
begin
  if tg_op = 'INSERT' then
    v_refresh_snapshot := true;
    v_requires_active_check := true;
  else
    v_refresh_snapshot := new.service_id is distinct from old.service_id;
    v_requires_active_check :=
      v_refresh_snapshot
      or (
        old.status is distinct from 'confirmed'
        and new.status = 'confirmed'
      );
  end if;

  if tg_op = 'INSERT'
     and new.service_id is null
     and new.status is distinct from 'completed' then
    raise exception '서비스 없는 신규 자유입력 예약은 완료 이력만 허용됩니다.' using errcode = '22023';
  end if;

  -- 한 번 master snapshot이 생성된 예약은 연결과 가격 근거를 함께 보존한다.
  -- nullable service_id는 legacy 행과 신규 completed 자유입력 이력에만 사용한다.
  if tg_op = 'UPDATE'
     and old.service_id is not null
     and new.service_id is null then
    raise exception '서비스가 연결된 예약은 서비스 연결을 해제할 수 없습니다.' using errcode = '22023';
  end if;

  -- 기존 confirmed + NULL service_id 행의 무관한 수정은 계속 허용한다.
  -- 신규 confirmed와 completed/cancelled -> confirmed 전환만 활성 FK를 요구한다.
  if new.status = 'confirmed'
     and new.service_id is null
     and v_requires_active_check then
    raise exception '확정 예약에는 활성 서비스가 필요합니다.' using errcode = '22023';
  end if;

  if new.service_id is null then
    -- master가 없는 과거 completed 이력은 자유입력 시술명/시간을 유지하되
    -- 가격을 임의로 받을 수 없다.
    new.price_snapshot_krw := null;
    return new;
  end if;

  if v_requires_active_check then
    select
      s.name,
      s.price_krw,
      s.default_duration_minutes,
      s.is_active
    into
      v_name,
      v_price_krw,
      v_default_duration_minutes,
      v_is_active
    from public.salon_service_defaults s
    where s.id = new.service_id;

    if not found then
      raise exception '선택한 서비스를 찾을 수 없습니다.' using errcode = '23503';
    end if;

    if v_is_active is distinct from true then
      raise exception '비활성 서비스는 예약에 새로 선택할 수 없습니다.' using errcode = '55000';
    end if;
  end if;

  if v_refresh_snapshot then
    new.service := btrim(v_name);
    new.price_snapshot_krw := v_price_krw;

    -- INSERT/서비스 변경 모두 NULL만 "master 기본시간 사용"을 뜻한다.
    -- UPDATE row에 남아 있는 값과 명시적 same-as-old override를 구별할 수
    -- 없으므로 모든 non-NULL 값은 예약 snapshot으로 그대로 보존한다.
    new.duration_minutes := coalesce(
      new.duration_minutes,
      v_default_duration_minutes
    );
  else
    -- 같은 service_id에 대한 client-side 이름/가격 변조와 현재가 재평가를 막는다.
    new.service := old.service;
    new.price_snapshot_krw := old.price_snapshot_krw;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_appointment_service_snapshot() from public;
revoke all on function public.apply_appointment_service_snapshot() from anon;
revoke all on function public.apply_appointment_service_snapshot() from authenticated;

drop trigger if exists apply_appointment_service_snapshot on public.appointments;
create trigger apply_appointment_service_snapshot
  before insert or update of service_id, service, price_snapshot_krw, duration_minutes, status
  on public.appointments
  for each row execute function public.apply_appointment_service_snapshot();

-- ==========================================
-- 11. R-03 잔여: 더블부킹/영업시간 충돌 방지
-- ==========================================

create index if not exists appointments_confirmed_slot_idx
  on public.appointments (date, time)
  where status = 'confirmed';

create or replace function public.parse_duration_minutes(p_duration text)
returns integer
language plpgsql
immutable
set search_path = public
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
revoke all on function public.parse_duration_minutes(text) from anon;
grant execute on function public.parse_duration_minutes(text) to authenticated;

create or replace function public.resolve_appointment_duration_minutes(
  p_duration_minutes integer,
  p_duration text
)
returns integer
language plpgsql
stable
set search_path = public
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
revoke all on function public.resolve_appointment_duration_minutes(integer, text) from anon;
grant execute on function public.resolve_appointment_duration_minutes(integer, text) to authenticated;

create or replace function public.guard_appointment_conflict_and_business_hours()
returns trigger
language plpgsql
set search_path = public
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
revoke all on function public.guard_appointment_conflict_and_business_hours() from anon;

drop trigger if exists guard_appointment_conflict_and_business_hours on public.appointments;
create trigger guard_appointment_conflict_and_business_hours
  before insert or update of date, time, duration, duration_minutes, service_id, status
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
revoke all on function public.set_appointment_status(uuid, text, text) from anon;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;

-- ==========================================
-- 12. R-07 고객 lifecycle / 중복 후보 / 원자적 병합
-- ==========================================

-- ==========================================
-- R-07: 고객 lifecycle / 중복 후보 / 원자적 병합
--
-- 원칙
-- - 고객 hard delete를 공개 API에서 제거하고 예약 FK는 RESTRICT로 보존한다.
-- - 일반 삭제는 archive/restore, 개인정보 삭제 요청은 irreversible anonymize로 처리한다.
-- - 중복은 exact normalized phone을 주 신호, exact normalized name을 보조 신호로만 제시한다.
-- - 병합/취소는 owner 전용 원자적 RPC로만 수행하며 감사 테이블에는 ID 관계만 기록한다.
-- ==========================================

alter table public.customers
  add column if not exists phone_normalized text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists merged_into_customer_id uuid references public.customers (id) on delete restrict,
  add column if not exists anonymized_at timestamptz,
  add column if not exists anonymized_by uuid references auth.users (id) on delete set null;

update public.customers
set phone_normalized = nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
where phone_normalized is distinct from nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '');

alter table public.customers
  drop constraint if exists customers_phone_normalized_matches_phone,
  add constraint customers_phone_normalized_matches_phone check (
    phone_normalized is not distinct from
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
  ) not valid;

alter table public.customers
  validate constraint customers_phone_normalized_matches_phone;

alter table public.customers
  drop constraint if exists customers_merged_customer_is_archived,
  add constraint customers_merged_customer_is_archived check (
    merged_into_customer_id is null
    or (
      archived_at is not null
      and merged_into_customer_id <> id
    )
  );

alter table public.customers
  drop constraint if exists customers_anonymized_customer_is_archived,
  add constraint customers_anonymized_customer_is_archived check (
    anonymized_at is null
    or (
      archived_at is not null
      and name = '삭제된 고객'
      and phone is null
      and phone_normalized is null
      and memo is null
    )
  );

alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;

alter table public.appointments
  add constraint appointments_customer_id_fkey
  foreign key (customer_id)
  references public.customers (id)
  on delete restrict;

create index if not exists customers_active_phone_normalized_idx
  on public.customers (phone_normalized)
  where archived_at is null and phone_normalized is not null;

create index if not exists customers_active_name_normalized_idx
  on public.customers (lower(btrim(name)))
  where archived_at is null;

create index if not exists customers_merged_into_idx
  on public.customers (merged_into_customer_id)
  where merged_into_customer_id is not null;

create or replace function public.sync_customer_phone_normalized()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.phone_normalized := nullif(
    regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'),
    ''
  );
  return new;
end;
$$;

revoke all on function public.sync_customer_phone_normalized() from public;
revoke all on function public.sync_customer_phone_normalized() from anon;
revoke all on function public.sync_customer_phone_normalized() from authenticated;

drop trigger if exists sync_customer_phone_normalized on public.customers;
create trigger sync_customer_phone_normalized
  before insert or update of phone
  on public.customers
  for each row execute function public.sync_customer_phone_normalized();

create or replace function public.set_customer_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Merge undo uses this timestamp as a stale-state guard, so transaction-start
  -- time (now()) is insufficient when multiple operations share a transaction.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.set_customer_updated_at() from public;
revoke all on function public.set_customer_updated_at() from anon;
revoke all on function public.set_customer_updated_at() from authenticated;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute function public.set_customer_updated_at();

-- 고객 lifecycle 컬럼은 RPC만 변경할 수 있다. 인증 사용자는 기본정보만 직접 생성/수정한다.
revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select on table public.customers to authenticated;
grant insert (name, phone, memo) on table public.customers to authenticated;
-- 기존 고객 상세의 memo 저장 payload는 updated_at도 보내지만 trigger가 서버 시각으로 덮어쓴다.
grant update (name, phone, memo, updated_at) on table public.customers to authenticated;

-- 예약 이력도 status 전환으로 관리하며 직접 hard delete를 허용하지 않는다.
revoke delete on table public.appointments from authenticated;

drop policy if exists "Owner and staff can manage customers" on public.customers;
drop policy if exists "Owner and staff can read customers" on public.customers;
drop policy if exists "Owner and staff can create customers" on public.customers;
drop policy if exists "Owner and staff can update active customer profiles" on public.customers;

create policy "Owner and staff can read customers"
  on public.customers
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

create policy "Owner and staff can create customers"
  on public.customers
  for insert
  to authenticated
  with check (
    archived_at is null
    and archived_by is null
    and archive_reason is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and anonymized_by is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owner and staff can update active customer profiles"
  on public.customers
  for update
  to authenticated
  using (
    archived_at is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    archived_at is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create table if not exists public.customer_merge_events (
  id uuid primary key default gen_random_uuid(),
  source_customer_id uuid not null references public.customers (id) on delete restrict,
  target_customer_id uuid not null references public.customers (id) on delete restrict,
  merged_by uuid references auth.users (id) on delete set null,
  merged_at timestamptz not null default now(),
  source_updated_at_at_merge timestamptz not null,
  target_updated_at_at_merge timestamptz not null,
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  constraint customer_merge_events_distinct_customers check (source_customer_id <> target_customer_id),
  constraint customer_merge_events_undo_fields_match check (
    (undone_at is null and undone_by is null)
    or undone_at is not null
  )
);

create table if not exists public.customer_merge_appointment_moves (
  event_id uuid not null references public.customer_merge_events (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  from_customer_id uuid not null references public.customers (id) on delete restrict,
  to_customer_id uuid not null references public.customers (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_id, appointment_id),
  constraint customer_merge_appointment_moves_distinct_customers check (
    from_customer_id <> to_customer_id
  )
);

create unique index if not exists customer_merge_events_active_source_idx
  on public.customer_merge_events (source_customer_id)
  where undone_at is null;

create index if not exists customer_merge_events_active_target_idx
  on public.customer_merge_events (target_customer_id)
  where undone_at is null;

create index if not exists customer_merge_moves_appointment_idx
  on public.customer_merge_appointment_moves (appointment_id);

alter table public.customer_merge_events enable row level security;
alter table public.customer_merge_appointment_moves enable row level security;

revoke all on table public.customer_merge_events from anon;
revoke all on table public.customer_merge_events from authenticated;
grant select on table public.customer_merge_events to authenticated;

revoke all on table public.customer_merge_appointment_moves from anon;
revoke all on table public.customer_merge_appointment_moves from authenticated;
grant select on table public.customer_merge_appointment_moves to authenticated;

drop policy if exists "Owners can read customer merge events" on public.customer_merge_events;
create policy "Owners can read customer merge events"
  on public.customer_merge_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

drop policy if exists "Owners can read customer merge appointment moves"
  on public.customer_merge_appointment_moves;
create policy "Owners can read customer merge appointment moves"
  on public.customer_merge_appointment_moves
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create or replace function public.guard_appointment_customer_active()
returns trigger
language plpgsql
-- Archived rows are intentionally hidden from direct UPDATE RLS. This trigger
-- must still lock and inspect them to distinguish "inactive" from "missing".
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz;
  v_merged_into uuid;
  v_anonymized_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.customer_id is not distinct from old.customer_id then
    return new;
  end if;

  select c.archived_at, c.merged_into_customer_id, c.anonymized_at
  into v_archived_at, v_merged_into, v_anonymized_at
  from public.customers c
  where c.id = new.customer_id
  for share;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_archived_at is not null or v_merged_into is not null or v_anonymized_at is not null then
    raise exception '보관되었거나 병합된 고객에게 새 예약을 등록할 수 없습니다.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_appointment_customer_active() from public;
revoke all on function public.guard_appointment_customer_active() from anon;
revoke all on function public.guard_appointment_customer_active() from authenticated;

drop trigger if exists guard_appointment_customer_active on public.appointments;
create trigger guard_appointment_customer_active
  before insert or update of customer_id
  on public.appointments
  for each row execute function public.guard_appointment_customer_active();

create or replace function public.archive_customer(
  p_customer_id uuid,
  p_reason text default null
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 보관할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 병합 취소로만 복원할 수 있습니다.' using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    return v_customer;
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_customer_id
      and e.undone_at is null
  ) then
    raise exception '활성 병합의 대표 고객은 먼저 병합을 취소해야 보관할 수 있습니다.'
      using errcode = '55000';
  end if;

  if v_customer.archived_at is not null then
    return v_customer;
  end if;

  update public.customers c
  set
    archived_at = clock_timestamp(),
    archived_by = v_actor,
    archive_reason = nullif(btrim(p_reason), '')
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.restore_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 복원할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 병합 취소로만 복원할 수 있습니다.' using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    raise exception '비식별화된 고객은 복원할 수 없습니다.' using errcode = '55000';
  end if;

  if v_customer.archived_at is null then
    return v_customer;
  end if;

  update public.customers c
  set
    archived_at = null,
    archived_by = null,
    archive_reason = null
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.anonymize_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 비식별화할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 먼저 병합을 취소해야 비식별화할 수 있습니다.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_customer_id
      and e.undone_at is null
  ) then
    raise exception '활성 병합의 대표 고객은 먼저 병합을 취소해야 비식별화할 수 있습니다.'
      using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    return v_customer;
  end if;

  update public.customers c
  set
    name = '삭제된 고객',
    phone = null,
    memo = null,
    archived_at = coalesce(c.archived_at, clock_timestamp()),
    archived_by = v_actor,
    archive_reason = 'privacy_anonymized',
    anonymized_at = clock_timestamp(),
    anonymized_by = v_actor
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.find_customer_duplicates(
  p_name text default null,
  p_phone text default null,
  p_exclude_customer_id uuid default null
)
returns table (
  customer_id uuid,
  name text,
  phone text,
  memo text,
  phone_normalized text,
  appointment_count bigint,
  match_reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_name_normalized text := nullif(lower(btrim(coalesce(p_name, ''))), '');
  v_phone_normalized text := nullif(
    regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'),
    ''
  );
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '중복 고객 후보를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.phone,
    c.memo,
    c.phone_normalized,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = c.id
    )::bigint,
    case
      when v_phone_normalized is not null
        and c.phone_normalized = v_phone_normalized
        then 'phone_exact'
      when v_name_normalized is not null
        and lower(btrim(c.name)) = v_name_normalized
        then 'name_exact_advisory'
      when exists (
        select 1
        from public.customers phone_match
        where phone_match.id <> c.id
          and phone_match.archived_at is null
          and phone_match.phone_normalized is not null
          and phone_match.phone_normalized = c.phone_normalized
      ) then 'phone_exact'
      else 'name_exact_advisory'
    end
  from public.customers c
  where c.archived_at is null
    and c.merged_into_customer_id is null
    and c.anonymized_at is null
    and c.id is distinct from p_exclude_customer_id
    and (
      (
        v_phone_normalized is null
        and v_name_normalized is null
        and (
          exists (
            select 1
            from public.customers phone_match
            where phone_match.id <> c.id
              and phone_match.archived_at is null
              and phone_match.phone_normalized is not null
              and phone_match.phone_normalized = c.phone_normalized
          )
          or exists (
            select 1
            from public.customers name_match
            where name_match.id <> c.id
              and name_match.archived_at is null
              and lower(btrim(name_match.name)) = lower(btrim(c.name))
          )
        )
      )
      or (
        v_phone_normalized is not null
        and c.phone_normalized = v_phone_normalized
      )
      or (
        v_name_normalized is not null
        and lower(btrim(c.name)) = v_name_normalized
      )
    )
  order by
    case
      when c.phone_normalized = v_phone_normalized then 0
      when v_phone_normalized is null and exists (
        select 1
        from public.customers phone_match
        where phone_match.id <> c.id
          and phone_match.archived_at is null
          and phone_match.phone_normalized is not null
          and phone_match.phone_normalized = c.phone_normalized
      ) then 0
      else 1
    end,
    c.name,
    c.id;
end;
$$;

create or replace function public.list_customer_duplicate_candidates()
returns table (
  source_customer_id uuid,
  source_name text,
  source_phone text,
  source_appointment_count bigint,
  target_customer_id uuid,
  target_name text,
  target_phone text,
  target_appointment_count bigint,
  match_reason text
)
language plpgsql
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

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '중복 고객 후보를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    source.id,
    source.name,
    source.phone,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = source.id
    )::bigint,
    target.id,
    target.name,
    target.phone,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = target.id
    )::bigint,
    case
      when source.phone_normalized is not null
        and source.phone_normalized = target.phone_normalized
        then 'phone_exact'
      else 'name_exact_advisory'
    end
  from public.customers source
  join public.customers target
    on source.id < target.id
   and (
     (
       source.phone_normalized is not null
       and source.phone_normalized = target.phone_normalized
     )
     or lower(btrim(source.name)) = lower(btrim(target.name))
   )
  where source.archived_at is null
    and source.merged_into_customer_id is null
    and source.anonymized_at is null
    and target.archived_at is null
    and target.merged_into_customer_id is null
    and target.anonymized_at is null
  order by
    case
      when source.phone_normalized is not null
        and source.phone_normalized = target.phone_normalized
        then 0
      else 1
    end,
    source.name,
    target.name,
    source.id,
    target.id;
end;
$$;

create or replace function public.merge_customers(
  p_source_customer_id uuid,
  p_target_customer_id uuid
)
returns table (
  event_id uuid,
  source_customer_id uuid,
  target_customer_id uuid,
  moved_appointment_count integer,
  merged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_source public.customers%rowtype;
  v_target public.customers%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_merged_at timestamptz := clock_timestamp();
  v_source_updated_at timestamptz;
  v_target_updated_at timestamptz;
  v_expected_count integer := 0;
  v_moved_count integer := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 병합할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_source_customer_id is null or p_target_customer_id is null then
    raise exception '원본 고객과 대표 고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_source_customer_id = p_target_customer_id then
    raise exception '동일한 고객끼리는 병합할 수 없습니다.' using errcode = '22023';
  end if;

  -- UUID 오름차순으로 잠가 동시 병합의 교착 위험을 낮춘다.
  perform 1
  from public.customers c
  where c.id in (p_source_customer_id, p_target_customer_id)
  order by c.id
  for update;

  select c.* into v_source
  from public.customers c
  where c.id = p_source_customer_id;

  if not found then
    raise exception '원본 고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select c.* into v_target
  from public.customers c
  where c.id = p_target_customer_id;

  if not found then
    raise exception '대표 고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_source.archived_at is not null
     or v_source.merged_into_customer_id is not null
     or v_source.anonymized_at is not null then
    raise exception '보관·병합·비식별화된 원본 고객은 병합할 수 없습니다.'
      using errcode = '55000';
  end if;

  if v_target.archived_at is not null
     or v_target.merged_into_customer_id is not null
     or v_target.anonymized_at is not null then
    raise exception '보관·병합·비식별화된 고객을 대표 고객으로 선택할 수 없습니다.'
      using errcode = '55000';
  end if;

  -- UI 후보 목록은 편의 계층일 뿐 보안 경계가 아니다. RPC 직접 호출도
  -- 서버에서 동일한 exact-phone 또는 exact-name 후보 관계를 재검증한다.
  if not (
    (
      v_source.phone_normalized is not null
      and v_source.phone_normalized = v_target.phone_normalized
    )
    or (
      nullif(lower(btrim(v_source.name)), '') is not null
      and lower(btrim(v_source.name)) = lower(btrim(v_target.name))
    )
  ) then
    raise exception '중복 후보 관계가 확인되지 않은 고객은 병합할 수 없습니다.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_source_customer_id
      and e.undone_at is null
  ) then
    raise exception '다른 병합의 대표 고객은 먼저 해당 병합을 취소해야 원본이 될 수 있습니다.'
      using errcode = '55000';
  end if;

  v_target_updated_at := v_target.updated_at;

  update public.customers c
  set
    archived_at = v_merged_at,
    archived_by = v_actor,
    archive_reason = 'merged',
    merged_into_customer_id = p_target_customer_id
  where c.id = p_source_customer_id
  returning c.updated_at into v_source_updated_at;

  insert into public.customer_merge_events (
    id,
    source_customer_id,
    target_customer_id,
    merged_by,
    merged_at,
    source_updated_at_at_merge,
    target_updated_at_at_merge
  ) values (
    v_event_id,
    p_source_customer_id,
    p_target_customer_id,
    v_actor,
    v_merged_at,
    v_source_updated_at,
    v_target_updated_at
  );

  insert into public.customer_merge_appointment_moves (
    event_id,
    appointment_id,
    from_customer_id,
    to_customer_id
  )
  select
    v_event_id,
    a.id,
    p_source_customer_id,
    p_target_customer_id
  from public.appointments a
  where a.customer_id = p_source_customer_id
  order by a.id;

  get diagnostics v_expected_count = row_count;

  update public.appointments a
  set customer_id = p_target_customer_id
  where a.customer_id = p_source_customer_id;

  get diagnostics v_moved_count = row_count;

  if v_moved_count <> v_expected_count then
    raise exception '병합 중 예약 이동 건수가 일치하지 않습니다. 변경 사항이 취소되었습니다.'
      using errcode = '55000';
  end if;

  return query
  select
    v_event_id,
    p_source_customer_id,
    p_target_customer_id,
    v_moved_count,
    v_merged_at;
end;
$$;

create or replace function public.undo_customer_merge(p_event_id uuid)
returns table (
  event_id uuid,
  source_customer_id uuid,
  target_customer_id uuid,
  restored_appointment_count integer,
  undone_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_event public.customer_merge_events%rowtype;
  v_source public.customers%rowtype;
  v_target public.customers%rowtype;
  v_expected_count integer := 0;
  v_current_count integer := 0;
  v_restored_count integer := 0;
  v_undone_at timestamptz := clock_timestamp();
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객 병합을 취소할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception '병합 이벤트 ID는 필수입니다.' using errcode = '22023';
  end if;

  select e.* into v_event
  from public.customer_merge_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception '병합 이벤트를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_event.undone_at is not null then
    raise exception '이미 취소된 병합입니다.' using errcode = '55000';
  end if;

  perform 1
  from public.customers c
  where c.id in (v_event.source_customer_id, v_event.target_customer_id)
  order by c.id
  for update;

  select c.* into v_source
  from public.customers c
  where c.id = v_event.source_customer_id;

  select c.* into v_target
  from public.customers c
  where c.id = v_event.target_customer_id;

  if v_source.id is null or v_target.id is null then
    raise exception '병합 고객 레코드가 없어 취소할 수 없습니다.' using errcode = '55000';
  end if;

  if v_source.merged_into_customer_id is distinct from v_event.target_customer_id
     or v_source.archived_at is distinct from v_event.merged_at
     or v_source.anonymized_at is not null
     or v_source.updated_at is distinct from v_event.source_updated_at_at_merge then
    raise exception '원본 고객 상태가 병합 이후 변경되어 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  if v_target.archived_at is not null
     or v_target.merged_into_customer_id is not null
     or v_target.anonymized_at is not null
     or v_target.updated_at is distinct from v_event.target_updated_at_at_merge then
    raise exception '대표 고객 상태가 병합 이후 변경되어 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.customer_merge_events later
    where later.id <> v_event.id
      and later.undone_at is null
      and later.merged_at > v_event.merged_at
      and (
        later.source_customer_id in (v_event.source_customer_id, v_event.target_customer_id)
        or later.target_customer_id in (v_event.source_customer_id, v_event.target_customer_id)
      )
  ) then
    raise exception '이후 병합 이력이 있어 먼저 최신 병합부터 취소해야 합니다.'
      using errcode = '55000';
  end if;

  select count(*)::integer into v_expected_count
  from public.customer_merge_appointment_moves m
  where m.event_id = v_event.id;

  select count(*)::integer into v_current_count
  from public.customer_merge_appointment_moves m
  join public.appointments a on a.id = m.appointment_id
  where m.event_id = v_event.id
    and a.customer_id = v_event.target_customer_id;

  if v_current_count <> v_expected_count then
    raise exception '병합된 예약의 현재 소유 고객이 달라 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  -- 예약 guard가 원본 고객을 활성 상태로 확인하도록 고객을 먼저 복원한다.
  update public.customers c
  set
    archived_at = null,
    archived_by = null,
    archive_reason = null,
    merged_into_customer_id = null
  where c.id = v_event.source_customer_id;

  update public.appointments a
  set customer_id = v_event.source_customer_id
  where exists (
    select 1
    from public.customer_merge_appointment_moves m
    where m.event_id = v_event.id
      and m.appointment_id = a.id
  )
    and a.customer_id = v_event.target_customer_id;

  get diagnostics v_restored_count = row_count;

  if v_restored_count <> v_expected_count then
    raise exception '병합 취소 중 예약 복원 건수가 일치하지 않습니다. 변경 사항이 취소되었습니다.'
      using errcode = '55000';
  end if;

  update public.customer_merge_events e
  set
    undone_at = v_undone_at,
    undone_by = v_actor
  where e.id = v_event.id;

  return query
  select
    v_event.id,
    v_event.source_customer_id,
    v_event.target_customer_id,
    v_restored_count,
    v_undone_at;
end;
$$;

-- public schema 함수는 기본적으로 PUBLIC EXECUTE가 부여되므로 모두 회수한 뒤 최소 grant만 연다.
revoke all on function public.archive_customer(uuid, text) from public;
revoke all on function public.archive_customer(uuid, text) from anon;
revoke all on function public.archive_customer(uuid, text) from authenticated;
grant execute on function public.archive_customer(uuid, text) to authenticated;

revoke all on function public.restore_customer(uuid) from public;
revoke all on function public.restore_customer(uuid) from anon;
revoke all on function public.restore_customer(uuid) from authenticated;
grant execute on function public.restore_customer(uuid) to authenticated;

revoke all on function public.anonymize_customer(uuid) from public;
revoke all on function public.anonymize_customer(uuid) from anon;
revoke all on function public.anonymize_customer(uuid) from authenticated;
grant execute on function public.anonymize_customer(uuid) to authenticated;

revoke all on function public.find_customer_duplicates(text, text, uuid) from public;
revoke all on function public.find_customer_duplicates(text, text, uuid) from anon;
revoke all on function public.find_customer_duplicates(text, text, uuid) from authenticated;
grant execute on function public.find_customer_duplicates(text, text, uuid) to authenticated;

revoke all on function public.list_customer_duplicate_candidates() from public;
revoke all on function public.list_customer_duplicate_candidates() from anon;
revoke all on function public.list_customer_duplicate_candidates() from authenticated;
grant execute on function public.list_customer_duplicate_candidates() to authenticated;

revoke all on function public.merge_customers(uuid, uuid) from public;
revoke all on function public.merge_customers(uuid, uuid) from anon;
revoke all on function public.merge_customers(uuid, uuid) from authenticated;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

revoke all on function public.undo_customer_merge(uuid) from public;
revoke all on function public.undo_customer_merge(uuid) from anon;
revoke all on function public.undo_customer_merge(uuid) from authenticated;
grant execute on function public.undo_customer_merge(uuid) to authenticated;

-- ==========================================
-- 13. R-09 서버 통계 집계
-- ==========================================

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
