-- Manual rollback reference for the R-10 invitation claim ledger.
-- Review before use. Close every callable path before preserving evidence.

revoke all on function public.claim_staff_invitation(uuid, text) from public;
revoke all on function public.claim_staff_invitation(uuid, text) from anon;
revoke all on function public.claim_staff_invitation(uuid, text) from authenticated;
revoke all on function public.claim_staff_invitation(uuid, text) from service_role;

revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from public;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from anon;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from authenticated;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from service_role;

revoke all on function public.reconcile_staff_invitation(text, uuid) from public;
revoke all on function public.reconcile_staff_invitation(text, uuid) from anon;
revoke all on function public.reconcile_staff_invitation(text, uuid) from authenticated;
revoke all on function public.reconcile_staff_invitation(text, uuid) from service_role;

drop function if exists public.reconcile_staff_invitation(text, uuid);
drop function if exists public.settle_staff_invitation(uuid, uuid, text, uuid, text);
drop function if exists public.claim_staff_invitation(uuid, text);

revoke all on table private.staff_invitation_requests from public;
revoke all on table private.staff_invitation_requests from anon;
revoke all on table private.staff_invitation_requests from authenticated;
revoke all on table private.staff_invitation_requests from service_role;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;

-- The private ledger, its RLS setting, and indexes are intentionally retained.
-- Unknown outcomes and request bindings are at-most-once evidence; dropping the
-- table could permit a previously attempted Auth email to be sent again.
