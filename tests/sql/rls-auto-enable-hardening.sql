\set ON_ERROR_STOP on
-- Run only against a disposable PostgreSQL 17 cluster as a superuser.
-- This fixture models platform behavior; it is not a dump of Production.
begin;
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
create role anon;
create role authenticated;
create role service_role;
create role rls_test_ddl;
-- initdb uses postgres as the bootstrap superuser in the documented command.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table') and schema_name = 'public'
  loop
    execute format('alter table if exists %s enable row level security', cmd.object_identity);
  end loop;
end;
$$;
create event trigger ensure_rls on ddl_command_end
execute function public.rls_auto_enable();
grant execute on function public.rls_auto_enable() to anon, authenticated, service_role;
grant usage, create on schema public to rls_test_ddl;
create temp table before_function as select oid, prosrc, proowner, prosecdef, proconfig
from pg_proc where oid='public.rls_auto_enable()'::regprocedure;
savepoint changed_contract;
alter function public.rls_auto_enable() set search_path = public;
\set ON_ERROR_STOP off
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
\if :ERROR
\else
  \echo FAIL: expected refusal for changed_contract
  \quit 1
\endif
\set ON_ERROR_STOP on
rollback to savepoint changed_contract;

savepoint disabled_trigger;
alter event trigger ensure_rls disable;
\set ON_ERROR_STOP off
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
\if :ERROR
\else
  \echo FAIL: expected refusal for disabled_trigger
  \quit 1
\endif
\set ON_ERROR_STOP on
rollback to savepoint disabled_trigger;

savepoint inherited_execute;
create role rls_inherited;
grant execute on function public.rls_auto_enable() to rls_inherited;
grant rls_inherited to anon;
\set ON_ERROR_STOP off
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
\if :ERROR
\else
  \echo FAIL: expected refusal for inherited_execute
  \quit 1
\endif
\set ON_ERROR_STOP on
rollback to savepoint inherited_execute;
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
\ir ../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql
-- Exercise automatic RLS as an ordinary DDL creator with no function EXECUTE.
set local role rls_test_ddl;
create table public.rls_probe_regular (id integer);
create table public.rls_probe_ctas as select 1 as id;
select 1 as id into public.rls_probe_select_into;
create table public.rls_probe_partitioned (id integer) partition by range(id);
create table public.rls_probe_partition partition of public.rls_probe_partitioned for values from (0) to (10);
reset role;
do $$
begin
  if exists(select 1 from pg_proc p join before_function b on b.oid=p.oid
    where (p.prosrc,p.proowner,p.prosecdef,p.proconfig) is distinct from
          (b.prosrc,b.proowner,b.prosecdef,b.proconfig)) then
    raise exception 'Function definition changed';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname like 'rls_probe_%' and c.relrowsecurity) <> 5 then
    raise exception 'Automatic RLS regression';
  end if;
  if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
     or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
     or has_function_privilege('rls_test_ddl','public.rls_auto_enable()','EXECUTE')
     or not has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Role matrix regression';
  end if;
  if not exists(select 1 from pg_event_trigger where evtname='ensure_rls' and evtenabled='O'
      and evtfoid='public.rls_auto_enable()'::regprocedure) then
    raise exception 'Event trigger changed';
  end if;
end;
$$;
rollback;
\echo PASS: absent function, replay, role matrix, unchanged definition, five DDL RLS cases
