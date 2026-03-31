-- ==========================================
-- R-01: RLS Cleanup
-- ==========================================
--
-- Preflight audit (run manually before applying in shared env):
-- select u.id
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null;
--
-- 결과가 1건 이상이면 profiles 데이터 정리 후 적용해야 합니다.
-- 이 migration은 profiles 자동 백필을 수행하지 않습니다.

do $$
begin
  if exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  ) then
    raise exception 'public.profiles 누락 사용자가 있어 RLS 정리를 적용할 수 없습니다. preflight audit를 먼저 해결하세요.';
  end if;
end;
$$;

drop policy if exists "Allow all access to customers" on public.customers;
drop policy if exists "Authenticated users can access customers" on public.customers;
drop policy if exists "Staff and owners can read customers" on public.customers;
drop policy if exists "Staff and owners can insert customers" on public.customers;
drop policy if exists "Staff and owners can update customers" on public.customers;

create policy "Staff and owners can read customers"
  on public.customers
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

create policy "Staff and owners can insert customers"
  on public.customers
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

create policy "Staff and owners can update customers"
  on public.customers
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

drop policy if exists "Allow all access to appointments" on public.appointments;
drop policy if exists "Authenticated users can access appointments" on public.appointments;
drop policy if exists "Staff and owners can read appointments" on public.appointments;
drop policy if exists "Staff and owners can insert appointments" on public.appointments;
drop policy if exists "Staff and owners can update appointments" on public.appointments;

create policy "Staff and owners can read appointments"
  on public.appointments
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

create policy "Staff and owners can insert appointments"
  on public.appointments
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

create policy "Staff and owners can update appointments"
  on public.appointments
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Authenticated users can read closed dates" on public.salon_closed_dates;
drop policy if exists "Staff and owners can read closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can insert closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can update closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can delete closed dates" on public.salon_closed_dates;

create policy "Staff and owners can read closed dates"
  on public.salon_closed_dates
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owners can insert closed dates"
  on public.salon_closed_dates
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  );

create policy "Owners can update closed dates"
  on public.salon_closed_dates
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  );

create policy "Owners can delete closed dates"
  on public.salon_closed_dates
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  );
