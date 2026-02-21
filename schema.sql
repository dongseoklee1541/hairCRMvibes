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
  memo text,
  status text not null default 'confirmed', -- confirmed, completed, cancelled
  created_at timestamptz not null default now(),
  constraint appointments_pkey primary key (id),
  constraint appointments_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete cascade
);

-- 3. RLS (Row Level Security) 설정
-- 개인 사용 앱이므로 anon 키로 모든 권한을 허용합니다 (추후 인증 도입 시 수정 필요)

alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create policy "Allow all access to customers"
  on public.customers
  for all
  using (true)
  with check (true);

create policy "Allow all access to appointments"
  on public.appointments
  for all
  using (true)
  with check (true);

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

create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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

-- 인증 사용자만 사용하도록 수정 (기존 열려있던 정책을 점차 단계적으로 교체)
create policy "Authenticated users can access customers"
  on public.customers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can access appointments"
  on public.appointments
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

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

drop policy if exists "Authenticated users can read closed dates" on public.salon_closed_dates;
create policy "Authenticated users can read closed dates"
  on public.salon_closed_dates
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;
create policy "Owners can manage closed dates"
  on public.salon_closed_dates
  for all
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
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
