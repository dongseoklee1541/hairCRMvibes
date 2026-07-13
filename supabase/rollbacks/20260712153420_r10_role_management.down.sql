-- Manual rollback reference for R-10.
-- Review before use. Close RPC/table exposure first and preserve audit rows.

revoke all on function public.list_staff_profiles() from public;
revoke all on function public.list_staff_profiles() from anon;
revoke all on function public.list_staff_profiles() from authenticated;
revoke all on function public.list_staff_profiles() from service_role;

revoke all on function public.provision_invited_staff(uuid, uuid) from public;
revoke all on function public.provision_invited_staff(uuid, uuid) from anon;
revoke all on function public.provision_invited_staff(uuid, uuid) from authenticated;
revoke all on function public.provision_invited_staff(uuid, uuid) from service_role;

revoke all on function public.change_staff_role(uuid, text, uuid) from public;
revoke all on function public.change_staff_role(uuid, text, uuid) from anon;
revoke all on function public.change_staff_role(uuid, text, uuid) from authenticated;
revoke all on function public.change_staff_role(uuid, text, uuid) from service_role;

revoke all on table public.role_management_events from public;
revoke all on table public.role_management_events from anon;
revoke all on table public.role_management_events from authenticated;
revoke all on table public.role_management_events from service_role;

drop policy if exists "Owners can read role management events"
  on public.role_management_events;

drop function if exists public.change_staff_role(uuid, text, uuid);
drop function if exists public.provision_invited_staff(uuid, uuid);
drop function if exists public.list_staff_profiles();

-- Keep the R-01 profile boundary explicit after rollback.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

-- role_management_events is intentionally retained with RLS enabled and no
-- Data API grants. Dropping it would destroy the append-only security audit.
-- Role changes already applied to profiles are operational data and are not
-- automatically reversed; use a separately reviewed forward operation.
