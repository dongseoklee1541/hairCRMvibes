-- ==========================================
-- R-08 Rollback: 서비스 가격/FK/snapshot 제거
-- live 적용은 별도 승인과 데이터 영향 검토가 필요하다.
-- ==========================================

drop trigger if exists apply_appointment_service_snapshot on public.appointments;
drop function if exists public.apply_appointment_service_snapshot();

drop trigger if exists guard_default_service_deactivation on public.salon_service_defaults;
drop function if exists public.guard_default_service_deactivation();

drop trigger if exists guard_active_default_service on public.salon_operation_settings;
drop function if exists public.guard_active_default_service();

drop trigger if exists guard_appointment_conflict_and_business_hours on public.appointments;
create trigger guard_appointment_conflict_and_business_hours
  before insert or update of date, time, duration, duration_minutes, status
  on public.appointments
  for each row execute function public.guard_appointment_conflict_and_business_hours();

drop index if exists public.appointments_service_id_idx;

alter table public.appointments
  drop constraint if exists appointments_service_id_fkey,
  drop constraint if exists appointments_price_snapshot_krw_check,
  drop column if exists service_id,
  drop column if exists price_snapshot_krw;

alter table public.salon_operation_settings
  drop constraint if exists salon_operation_settings_default_service_id_fkey,
  drop column if exists default_service_id;

alter table public.salon_service_defaults
  drop constraint if exists salon_service_defaults_price_krw_check,
  drop column if exists price_krw;

drop policy if exists "Owners can create service defaults" on public.salon_service_defaults;
drop policy if exists "Owners can update service defaults" on public.salon_service_defaults;

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

revoke all on table public.salon_service_defaults from anon;
revoke all on table public.salon_service_defaults from authenticated;
grant select, insert, update, delete on table public.salon_service_defaults to authenticated;
