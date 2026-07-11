-- ==========================================
-- Phase 1 hardening: function search_path and anon EXECUTE cleanup
-- Forward-only security migration.
-- Deliberately no down migration: restoring mutable search_path or anon EXECUTE
-- would reintroduce the vulnerabilities this migration removes. Recover by
-- applying a narrowly scoped forward-fix after reviewing the affected function.
-- ==========================================

alter function public.set_updated_at() set search_path = public;
alter function public.fill_cancel_audit_fields() set search_path = public;
alter function public.guard_closed_day_appointment() set search_path = public;
alter function public.parse_duration_minutes(text) set search_path = public;
alter function public.resolve_appointment_duration_minutes(integer, text) set search_path = public;
alter function public.guard_appointment_conflict_and_business_hours() set search_path = public;

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from anon;
revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, integer, text) from anon;
revoke all on function public.remove_closed_day_range(date, date) from anon;
revoke all on function public.set_appointment_status(uuid, text, text) from anon;
revoke all on function public.parse_duration_minutes(text) from anon;
revoke all on function public.resolve_appointment_duration_minutes(integer, text) from anon;
revoke all on function public.guard_appointment_conflict_and_business_hours() from anon;
