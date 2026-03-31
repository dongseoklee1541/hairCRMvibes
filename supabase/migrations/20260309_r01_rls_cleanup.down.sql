-- ==========================================
-- R-01 Rollback
-- ==========================================

drop policy if exists "Staff and owners can read customers" on public.customers;
drop policy if exists "Staff and owners can insert customers" on public.customers;
drop policy if exists "Staff and owners can update customers" on public.customers;

create policy "Allow all access to customers"
  on public.customers
  for all
  using (true)
  with check (true);

create policy "Authenticated users can access customers"
  on public.customers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Staff and owners can read appointments" on public.appointments;
drop policy if exists "Staff and owners can insert appointments" on public.appointments;
drop policy if exists "Staff and owners can update appointments" on public.appointments;

create policy "Allow all access to appointments"
  on public.appointments
  for all
  using (true)
  with check (true);

create policy "Authenticated users can access appointments"
  on public.appointments
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Staff and owners can read closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can insert closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can update closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can delete closed dates" on public.salon_closed_dates;

create policy "Authenticated users can read closed dates"
  on public.salon_closed_dates
  for select
  using (auth.role() = 'authenticated');

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
