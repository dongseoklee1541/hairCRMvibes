-- ==========================================
-- R-02 Rollback: 예약 상태변경/취소 기반 제거
-- ==========================================

revoke all on function public.set_appointment_status(uuid, text, text) from authenticated;
drop function if exists public.set_appointment_status(uuid, text, text);

alter table public.appointments
  drop constraint if exists appointments_status_check;
