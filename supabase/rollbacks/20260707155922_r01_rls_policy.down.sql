-- ==========================================
-- R-01 Rollback: 이전 RLS 정책으로 복원
-- ==========================================

drop policy if exists "Owner and staff can manage customers" on public.customers;
drop policy if exists "Owner and staff can manage appointments" on public.appointments;
drop policy if exists "Authenticated users can read own profile" on public.profiles;
drop policy if exists "Owner and staff can read closed dates" on public.salon_closed_dates;
drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;

grant select, insert, update, delete on table public.customers to anon, authenticated;
grant select, insert, update, delete on table public.appointments to anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.salon_closed_dates to authenticated;

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

create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
