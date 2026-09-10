-- Read-only semantic digest for every schema object added or replaced by R-16.
-- Run against both a full migration replay DB and a schema.sql replay DB.

with target_relations(schema_name, relation_name) as (
  values
    ('public', 'customer_session_passes'),
    ('public', 'appointment_session_pass_usages'),
    ('private', 'appointment_mutation_requests')
),
target_functions(schema_name, function_name) as (
  values
    ('private', 'r16_require_actor'),
    ('private', 'r16_remaining_sessions'),
    ('private', 'r16_claim_appointment_request'),
    ('private', 'r16_appointment_response'),
    ('private', 'r16_transition_appointment_usage'),
    ('public', 'create_customer_session_pass'),
    ('public', 'update_customer_session_pass'),
    ('public', 'list_customer_session_passes'),
    ('public', 'list_appointment_session_pass_options'),
    ('public', 'create_appointment_with_session_pass'),
    ('public', 'update_appointment_with_session_pass'),
    ('public', 'set_appointment_status'),
    ('public', 'apply_closed_day_with_cancellations'),
    ('public', 'apply_closed_days_batch_with_cancellations'),
    ('public', 'guard_r16_customer_lifecycle')
),
objects as (
  select
    'column'::text as object_type,
    format('%I.%I.%s', n.nspname, c.relname, a.attnum) as object_name,
    concat_ws('|', a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid)) as definition
  from target_relations t
  join pg_namespace n on n.nspname = t.schema_name
  join pg_class c on c.relnamespace = n.oid and c.relname = t.relation_name
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum

  union all

  select
    'constraint',
    format('%I.%I.%I', n.nspname, c.relname, con.conname),
    pg_get_constraintdef(con.oid, true)
  from target_relations t
  join pg_namespace n on n.nspname = t.schema_name
  join pg_class c on c.relnamespace = n.oid and c.relname = t.relation_name
  join pg_constraint con on con.conrelid = c.oid

  union all

  select
    'index',
    format('%I.%I', schemaname, indexname),
    indexdef
  from pg_indexes
  where (schemaname, tablename) in (
    ('public', 'customer_session_passes'),
    ('public', 'appointment_session_pass_usages'),
    ('private', 'appointment_mutation_requests')
  )

  union all

  select
    'policy',
    format('%I.%I.%I', n.nspname, c.relname, p.polname),
    concat_ws('|', p.polcmd, p.polpermissive, p.polroles::text, pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid))
  from target_relations t
  join pg_namespace n on n.nspname = t.schema_name
  join pg_class c on c.relnamespace = n.oid and c.relname = t.relation_name
  join pg_policy p on p.polrelid = c.oid

  union all

  select
    'function',
    format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
    concat_ws('|', p.prosecdef, p.provolatile, p.proconfig::text, p.proacl::text, pg_get_functiondef(p.oid))
  from target_functions t
  join pg_namespace n on n.nspname = t.schema_name
  join pg_proc p on p.pronamespace = n.oid and p.proname = t.function_name
  where not (
    n.nspname = 'public'
    and p.proname = 'set_appointment_status'
    and pg_get_function_identity_arguments(p.oid) <> 'p_request_id uuid, p_appointment_id uuid, p_status text, p_cancel_reason text, p_session_pass_id uuid'
  )

  union all

  select
    'trigger',
    format('%I.%I.%I', n.nspname, c.relname, tg.tgname),
    pg_get_triggerdef(tg.oid, true)
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'customers'
    and tg.tgname = 'guard_r16_customer_lifecycle'
    and not tg.tgisinternal

  union all

  select
    'relation_acl',
    format('%I.%I', n.nspname, c.relname),
    concat_ws('|', c.relrowsecurity, c.relacl::text)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname, c.relname) in (
    ('public', 'customer_session_passes'),
    ('public', 'appointment_session_pass_usages'),
    ('private', 'appointment_mutation_requests'),
    ('public', 'appointments')
  )

  union all

  select
    'schema_acl',
    n.nspname,
    n.nspacl::text
  from pg_namespace n
  where n.nspname in ('public', 'private')
)
select md5(string_agg(object_type || '|' || object_name || '|' || coalesce(definition, ''), E'\n' order by object_type, object_name, definition)) as r16_semantic_digest
from objects;
