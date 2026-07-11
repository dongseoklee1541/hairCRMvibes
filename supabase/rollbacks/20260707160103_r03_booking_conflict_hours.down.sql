-- ==========================================
-- R-03 Rollback: 더블부킹/영업시간 충돌 방지 제거
-- ==========================================

drop trigger if exists guard_appointment_conflict_and_business_hours on public.appointments;
drop function if exists public.guard_appointment_conflict_and_business_hours();
drop function if exists public.resolve_appointment_duration_minutes(integer, text);
drop function if exists public.parse_duration_minutes(text);
drop index if exists public.appointments_confirmed_slot_idx;

alter table public.appointments
  drop constraint if exists appointments_duration_minutes_check,
  drop column if exists duration_minutes;
