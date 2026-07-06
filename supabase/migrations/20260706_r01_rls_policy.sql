-- ==========================================
-- R-01: RLS 정책 정리
-- ==========================================

alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.salon_closed_dates enable row level security;

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

revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select, insert, update, delete on table public.customers to authenticated;

revoke all on table public.appointments from anon;
revoke all on table public.appointments from authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.salon_closed_dates from anon;
revoke all on table public.salon_closed_dates from authenticated;
grant select, insert, update, delete on table public.salon_closed_dates to authenticated;

drop policy if exists "Allow all access to customers" on public.customers;
drop policy if exists "Authenticated users can access customers" on public.customers;
drop policy if exists "Owner and staff can manage customers" on public.customers;
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

drop policy if exists "Allow all access to appointments" on public.appointments;
drop policy if exists "Authenticated users can access appointments" on public.appointments;
drop policy if exists "Owner and staff can manage appointments" on public.appointments;
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

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Authenticated users can read own profile" on public.profiles;
create policy "Authenticated users can read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Authenticated users can read closed dates" on public.salon_closed_dates;
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
