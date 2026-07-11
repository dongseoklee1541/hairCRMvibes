-- ==========================================
-- R-05 Rollback: 설정 데이터 모델 제거
-- ==========================================

drop trigger if exists set_service_defaults_updated_at on public.salon_service_defaults;
drop trigger if exists set_business_hours_updated_at on public.salon_business_hours;
drop trigger if exists set_operation_settings_updated_at on public.salon_operation_settings;

drop policy if exists "Owners can manage service defaults" on public.salon_service_defaults;
drop policy if exists "Owner and staff can read service defaults" on public.salon_service_defaults;
drop policy if exists "Owners can manage business hours" on public.salon_business_hours;
drop policy if exists "Owner and staff can read business hours" on public.salon_business_hours;
drop policy if exists "Owners can manage operation settings" on public.salon_operation_settings;
drop policy if exists "Owner and staff can read operation settings" on public.salon_operation_settings;

drop table if exists public.salon_service_defaults;
drop table if exists public.salon_business_hours;
drop table if exists public.salon_operation_settings;
