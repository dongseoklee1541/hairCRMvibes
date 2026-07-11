-- ==========================================
-- R-05: 설정 페이지 기반 데이터 모델
-- 영업시간/기본 시술/기본 소요시간
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

drop policy if exists "Owner and staff can read operation settings" on public.salon_operation_settings;
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

drop policy if exists "Owners can manage operation settings" on public.salon_operation_settings;
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

drop policy if exists "Owner and staff can read business hours" on public.salon_business_hours;
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

drop policy if exists "Owners can manage business hours" on public.salon_business_hours;
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

drop policy if exists "Owner and staff can read service defaults" on public.salon_service_defaults;
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

drop policy if exists "Owners can manage service defaults" on public.salon_service_defaults;
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
