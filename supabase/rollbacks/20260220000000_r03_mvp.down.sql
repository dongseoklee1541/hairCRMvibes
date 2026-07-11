-- ==========================================
-- R-03 MVP Rollback
-- ==========================================

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from authenticated;
drop function if exists public.apply_closed_day_with_cancellations(date, uuid[], text);

drop trigger if exists guard_closed_day_appointment on public.appointments;
drop function if exists public.guard_closed_day_appointment();

drop trigger if exists fill_appointments_cancel_audit on public.appointments;
drop function if exists public.fill_cancel_audit_fields();

drop trigger if exists set_closed_dates_updated_at on public.salon_closed_dates;
drop trigger if exists set_appointments_updated_at on public.appointments;
drop function if exists public.set_updated_at();

drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;
drop policy if exists "Authenticated users can read closed dates" on public.salon_closed_dates;
drop table if exists public.salon_closed_dates;

alter table public.appointments
  drop column if exists cancelled_reason,
  drop column if exists cancelled_at,
  drop column if exists cancelled_by,
  drop column if exists updated_at;
