-- Optional Supabase-managed event trigger: absent in Preview/fresh databases.
-- Preserve the function, event trigger, owner and service_role access.
do $hardening$
declare
  target oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
  service_before boolean;
begin
  if target is null then
    raise notice 'rls_auto_enable() absent; no ACL change required';
    return;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = target
      and p.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
      and p.prokind = 'f' and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and p.proconfig = array['search_path=pg_catalog']::text[]
  ) or not exists (
    select 1 from pg_catalog.pg_event_trigger e
    where e.evtname = 'ensure_rls' and e.evtfoid = target
      and e.evtevent = 'ddl_command_end' and e.evtenabled = 'O'
  ) then
    raise exception 'rls_auto_enable contract changed; inspect before applying ACL hardening';
  end if;

  service_before := pg_catalog.has_function_privilege('service_role', target, 'EXECUTE');
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

  if pg_catalog.has_function_privilege('anon', target, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', target, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', target, 'EXECUTE') is distinct from service_before
  then
    raise exception 'rls_auto_enable unexpected effective privileges; ACL change rolled back';
  end if;
end;
$hardening$;
