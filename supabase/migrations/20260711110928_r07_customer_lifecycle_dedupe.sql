-- ==========================================
-- R-07: 고객 lifecycle / 중복 후보 / 원자적 병합
--
-- 원칙
-- - 고객 hard delete를 공개 API에서 제거하고 예약 FK는 RESTRICT로 보존한다.
-- - 일반 삭제는 archive/restore, 개인정보 삭제 요청은 irreversible anonymize로 처리한다.
-- - 중복은 exact normalized phone을 주 신호, exact normalized name을 보조 신호로만 제시한다.
-- - 병합/취소는 owner 전용 원자적 RPC로만 수행하며 감사 테이블에는 ID 관계만 기록한다.
-- ==========================================

alter table public.customers
  add column if not exists phone_normalized text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists merged_into_customer_id uuid references public.customers (id) on delete restrict,
  add column if not exists anonymized_at timestamptz,
  add column if not exists anonymized_by uuid references auth.users (id) on delete set null;

update public.customers
set phone_normalized = nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
where phone_normalized is distinct from nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '');

alter table public.customers
  drop constraint if exists customers_phone_normalized_matches_phone,
  add constraint customers_phone_normalized_matches_phone check (
    phone_normalized is not distinct from
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
  ) not valid;

alter table public.customers
  validate constraint customers_phone_normalized_matches_phone;

alter table public.customers
  drop constraint if exists customers_merged_customer_is_archived,
  add constraint customers_merged_customer_is_archived check (
    merged_into_customer_id is null
    or (
      archived_at is not null
      and merged_into_customer_id <> id
    )
  );

alter table public.customers
  drop constraint if exists customers_anonymized_customer_is_archived,
  add constraint customers_anonymized_customer_is_archived check (
    anonymized_at is null
    or (
      archived_at is not null
      and name = '삭제된 고객'
      and phone is null
      and phone_normalized is null
      and memo is null
    )
  );

alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;

alter table public.appointments
  add constraint appointments_customer_id_fkey
  foreign key (customer_id)
  references public.customers (id)
  on delete restrict;

create index if not exists customers_active_phone_normalized_idx
  on public.customers (phone_normalized)
  where archived_at is null and phone_normalized is not null;

create index if not exists customers_active_name_normalized_idx
  on public.customers (lower(btrim(name)))
  where archived_at is null;

create index if not exists customers_merged_into_idx
  on public.customers (merged_into_customer_id)
  where merged_into_customer_id is not null;

create or replace function public.sync_customer_phone_normalized()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.phone_normalized := nullif(
    regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'),
    ''
  );
  return new;
end;
$$;

revoke all on function public.sync_customer_phone_normalized() from public;
revoke all on function public.sync_customer_phone_normalized() from anon;
revoke all on function public.sync_customer_phone_normalized() from authenticated;

drop trigger if exists sync_customer_phone_normalized on public.customers;
create trigger sync_customer_phone_normalized
  before insert or update of phone
  on public.customers
  for each row execute function public.sync_customer_phone_normalized();

create or replace function public.set_customer_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Merge undo uses this timestamp as a stale-state guard, so transaction-start
  -- time (now()) is insufficient when multiple operations share a transaction.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.set_customer_updated_at() from public;
revoke all on function public.set_customer_updated_at() from anon;
revoke all on function public.set_customer_updated_at() from authenticated;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute function public.set_customer_updated_at();

-- 고객 lifecycle 컬럼은 RPC만 변경할 수 있다. 인증 사용자는 기본정보만 직접 생성/수정한다.
revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select on table public.customers to authenticated;
grant insert (name, phone, memo) on table public.customers to authenticated;
grant update (name, phone, memo) on table public.customers to authenticated;

-- 예약 이력도 status 전환으로 관리하며 직접 hard delete를 허용하지 않는다.
revoke delete on table public.appointments from authenticated;

drop policy if exists "Owner and staff can manage customers" on public.customers;
drop policy if exists "Owner and staff can read customers" on public.customers;
drop policy if exists "Owner and staff can create customers" on public.customers;
drop policy if exists "Owner and staff can update active customer profiles" on public.customers;

create policy "Owner and staff can read customers"
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owner and staff can create customers"
  on public.customers
  for insert
  to authenticated
  with check (
    archived_at is null
    and archived_by is null
    and archive_reason is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and anonymized_by is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owner and staff can update active customer profiles"
  on public.customers
  for update
  to authenticated
  using (
    archived_at is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  )
  with check (
    archived_at is null
    and merged_into_customer_id is null
    and anonymized_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create table if not exists public.customer_merge_events (
  id uuid primary key default gen_random_uuid(),
  source_customer_id uuid not null references public.customers (id) on delete restrict,
  target_customer_id uuid not null references public.customers (id) on delete restrict,
  merged_by uuid references auth.users (id) on delete set null,
  merged_at timestamptz not null default now(),
  source_updated_at_at_merge timestamptz not null,
  target_updated_at_at_merge timestamptz not null,
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  constraint customer_merge_events_distinct_customers check (source_customer_id <> target_customer_id),
  constraint customer_merge_events_undo_fields_match check (
    (undone_at is null and undone_by is null)
    or undone_at is not null
  )
);

create table if not exists public.customer_merge_appointment_moves (
  event_id uuid not null references public.customer_merge_events (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  from_customer_id uuid not null references public.customers (id) on delete restrict,
  to_customer_id uuid not null references public.customers (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_id, appointment_id),
  constraint customer_merge_appointment_moves_distinct_customers check (
    from_customer_id <> to_customer_id
  )
);

create unique index if not exists customer_merge_events_active_source_idx
  on public.customer_merge_events (source_customer_id)
  where undone_at is null;

create index if not exists customer_merge_events_active_target_idx
  on public.customer_merge_events (target_customer_id)
  where undone_at is null;

create index if not exists customer_merge_moves_appointment_idx
  on public.customer_merge_appointment_moves (appointment_id);

alter table public.customer_merge_events enable row level security;
alter table public.customer_merge_appointment_moves enable row level security;

revoke all on table public.customer_merge_events from anon;
revoke all on table public.customer_merge_events from authenticated;
grant select on table public.customer_merge_events to authenticated;

revoke all on table public.customer_merge_appointment_moves from anon;
revoke all on table public.customer_merge_appointment_moves from authenticated;
grant select on table public.customer_merge_appointment_moves to authenticated;

drop policy if exists "Owners can read customer merge events" on public.customer_merge_events;
create policy "Owners can read customer merge events"
  on public.customer_merge_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

drop policy if exists "Owners can read customer merge appointment moves"
  on public.customer_merge_appointment_moves;
create policy "Owners can read customer merge appointment moves"
  on public.customer_merge_appointment_moves
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create or replace function public.guard_appointment_customer_active()
returns trigger
language plpgsql
-- Archived rows are intentionally hidden from direct UPDATE RLS. This trigger
-- must still lock and inspect them to distinguish "inactive" from "missing".
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz;
  v_merged_into uuid;
  v_anonymized_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.customer_id is not distinct from old.customer_id then
    return new;
  end if;

  select c.archived_at, c.merged_into_customer_id, c.anonymized_at
  into v_archived_at, v_merged_into, v_anonymized_at
  from public.customers c
  where c.id = new.customer_id
  for share;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_archived_at is not null or v_merged_into is not null or v_anonymized_at is not null then
    raise exception '보관되었거나 병합된 고객에게 새 예약을 등록할 수 없습니다.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_appointment_customer_active() from public;
revoke all on function public.guard_appointment_customer_active() from anon;
revoke all on function public.guard_appointment_customer_active() from authenticated;

drop trigger if exists guard_appointment_customer_active on public.appointments;
create trigger guard_appointment_customer_active
  before insert or update of customer_id
  on public.appointments
  for each row execute function public.guard_appointment_customer_active();

create or replace function public.archive_customer(
  p_customer_id uuid,
  p_reason text default null
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 보관할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 병합 취소로만 복원할 수 있습니다.' using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    return v_customer;
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_customer_id
      and e.undone_at is null
  ) then
    raise exception '활성 병합의 대표 고객은 먼저 병합을 취소해야 보관할 수 있습니다.'
      using errcode = '55000';
  end if;

  if v_customer.archived_at is not null then
    return v_customer;
  end if;

  update public.customers c
  set
    archived_at = clock_timestamp(),
    archived_by = v_actor,
    archive_reason = nullif(btrim(p_reason), '')
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.restore_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 복원할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 병합 취소로만 복원할 수 있습니다.' using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    raise exception '비식별화된 고객은 복원할 수 없습니다.' using errcode = '55000';
  end if;

  if v_customer.archived_at is null then
    return v_customer;
  end if;

  update public.customers c
  set
    archived_at = null,
    archived_by = null,
    archive_reason = null
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.anonymize_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 비식별화할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_customer.merged_into_customer_id is not null then
    raise exception '병합된 고객은 먼저 병합을 취소해야 비식별화할 수 있습니다.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_customer_id
      and e.undone_at is null
  ) then
    raise exception '활성 병합의 대표 고객은 먼저 병합을 취소해야 비식별화할 수 있습니다.'
      using errcode = '55000';
  end if;

  if v_customer.anonymized_at is not null then
    return v_customer;
  end if;

  update public.customers c
  set
    name = '삭제된 고객',
    phone = null,
    memo = null,
    archived_at = coalesce(c.archived_at, clock_timestamp()),
    archived_by = v_actor,
    archive_reason = 'privacy_anonymized',
    anonymized_at = clock_timestamp(),
    anonymized_by = v_actor
  where c.id = p_customer_id
  returning c.* into v_customer;

  return v_customer;
end;
$$;

create or replace function public.find_customer_duplicates(
  p_name text default null,
  p_phone text default null,
  p_exclude_customer_id uuid default null
)
returns table (
  customer_id uuid,
  name text,
  phone text,
  memo text,
  phone_normalized text,
  appointment_count bigint,
  match_reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_name_normalized text := nullif(lower(btrim(coalesce(p_name, ''))), '');
  v_phone_normalized text := nullif(
    regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'),
    ''
  );
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '중복 고객 후보를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.phone,
    c.memo,
    c.phone_normalized,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = c.id
    )::bigint,
    case
      when v_phone_normalized is not null
        and c.phone_normalized = v_phone_normalized
        then 'phone_exact'
      when v_name_normalized is not null
        and lower(btrim(c.name)) = v_name_normalized
        then 'name_exact_advisory'
      when exists (
        select 1
        from public.customers phone_match
        where phone_match.id <> c.id
          and phone_match.archived_at is null
          and phone_match.phone_normalized is not null
          and phone_match.phone_normalized = c.phone_normalized
      ) then 'phone_exact'
      else 'name_exact_advisory'
    end
  from public.customers c
  where c.archived_at is null
    and c.merged_into_customer_id is null
    and c.anonymized_at is null
    and c.id is distinct from p_exclude_customer_id
    and (
      (
        v_phone_normalized is null
        and v_name_normalized is null
        and (
          exists (
            select 1
            from public.customers phone_match
            where phone_match.id <> c.id
              and phone_match.archived_at is null
              and phone_match.phone_normalized is not null
              and phone_match.phone_normalized = c.phone_normalized
          )
          or exists (
            select 1
            from public.customers name_match
            where name_match.id <> c.id
              and name_match.archived_at is null
              and lower(btrim(name_match.name)) = lower(btrim(c.name))
          )
        )
      )
      or (
        v_phone_normalized is not null
        and c.phone_normalized = v_phone_normalized
      )
      or (
        v_name_normalized is not null
        and lower(btrim(c.name)) = v_name_normalized
      )
    )
  order by
    case
      when c.phone_normalized = v_phone_normalized then 0
      when v_phone_normalized is null and exists (
        select 1
        from public.customers phone_match
        where phone_match.id <> c.id
          and phone_match.archived_at is null
          and phone_match.phone_normalized is not null
          and phone_match.phone_normalized = c.phone_normalized
      ) then 0
      else 1
    end,
    c.name,
    c.id;
end;
$$;

create or replace function public.list_customer_duplicate_candidates()
returns table (
  source_customer_id uuid,
  source_name text,
  source_phone text,
  source_appointment_count bigint,
  target_customer_id uuid,
  target_name text,
  target_phone text,
  target_appointment_count bigint,
  match_reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '중복 고객 후보를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    source.id,
    source.name,
    source.phone,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = source.id
    )::bigint,
    target.id,
    target.name,
    target.phone,
    (
      select count(*)
      from public.appointments a
      where a.customer_id = target.id
    )::bigint,
    case
      when source.phone_normalized is not null
        and source.phone_normalized = target.phone_normalized
        then 'phone_exact'
      else 'name_exact_advisory'
    end
  from public.customers source
  join public.customers target
    on source.id < target.id
   and (
     (
       source.phone_normalized is not null
       and source.phone_normalized = target.phone_normalized
     )
     or lower(btrim(source.name)) = lower(btrim(target.name))
   )
  where source.archived_at is null
    and source.merged_into_customer_id is null
    and source.anonymized_at is null
    and target.archived_at is null
    and target.merged_into_customer_id is null
    and target.anonymized_at is null
  order by
    case
      when source.phone_normalized is not null
        and source.phone_normalized = target.phone_normalized
        then 0
      else 1
    end,
    source.name,
    target.name,
    source.id,
    target.id;
end;
$$;

create or replace function public.merge_customers(
  p_source_customer_id uuid,
  p_target_customer_id uuid
)
returns table (
  event_id uuid,
  source_customer_id uuid,
  target_customer_id uuid,
  moved_appointment_count integer,
  merged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_source public.customers%rowtype;
  v_target public.customers%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_merged_at timestamptz := clock_timestamp();
  v_source_updated_at timestamptz;
  v_target_updated_at timestamptz;
  v_expected_count integer := 0;
  v_moved_count integer := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객을 병합할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_source_customer_id is null or p_target_customer_id is null then
    raise exception '원본 고객과 대표 고객 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_source_customer_id = p_target_customer_id then
    raise exception '동일한 고객끼리는 병합할 수 없습니다.' using errcode = '22023';
  end if;

  -- UUID 오름차순으로 잠가 동시 병합의 교착 위험을 낮춘다.
  perform 1
  from public.customers c
  where c.id in (p_source_customer_id, p_target_customer_id)
  order by c.id
  for update;

  select c.* into v_source
  from public.customers c
  where c.id = p_source_customer_id;

  if not found then
    raise exception '원본 고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select c.* into v_target
  from public.customers c
  where c.id = p_target_customer_id;

  if not found then
    raise exception '대표 고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_source.archived_at is not null
     or v_source.merged_into_customer_id is not null
     or v_source.anonymized_at is not null then
    raise exception '보관·병합·비식별화된 원본 고객은 병합할 수 없습니다.'
      using errcode = '55000';
  end if;

  if v_target.archived_at is not null
     or v_target.merged_into_customer_id is not null
     or v_target.anonymized_at is not null then
    raise exception '보관·병합·비식별화된 고객을 대표 고객으로 선택할 수 없습니다.'
      using errcode = '55000';
  end if;

  -- UI 후보 목록은 편의 계층일 뿐 보안 경계가 아니다. RPC 직접 호출도
  -- 서버에서 동일한 exact-phone 또는 exact-name 후보 관계를 재검증한다.
  if not (
    (
      v_source.phone_normalized is not null
      and v_source.phone_normalized = v_target.phone_normalized
    )
    or (
      nullif(lower(btrim(v_source.name)), '') is not null
      and lower(btrim(v_source.name)) = lower(btrim(v_target.name))
    )
  ) then
    raise exception '중복 후보 관계가 확인되지 않은 고객은 병합할 수 없습니다.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.customer_merge_events e
    where e.target_customer_id = p_source_customer_id
      and e.undone_at is null
  ) then
    raise exception '다른 병합의 대표 고객은 먼저 해당 병합을 취소해야 원본이 될 수 있습니다.'
      using errcode = '55000';
  end if;

  v_target_updated_at := v_target.updated_at;

  update public.customers c
  set
    archived_at = v_merged_at,
    archived_by = v_actor,
    archive_reason = 'merged',
    merged_into_customer_id = p_target_customer_id
  where c.id = p_source_customer_id
  returning c.updated_at into v_source_updated_at;

  insert into public.customer_merge_events (
    id,
    source_customer_id,
    target_customer_id,
    merged_by,
    merged_at,
    source_updated_at_at_merge,
    target_updated_at_at_merge
  ) values (
    v_event_id,
    p_source_customer_id,
    p_target_customer_id,
    v_actor,
    v_merged_at,
    v_source_updated_at,
    v_target_updated_at
  );

  insert into public.customer_merge_appointment_moves (
    event_id,
    appointment_id,
    from_customer_id,
    to_customer_id
  )
  select
    v_event_id,
    a.id,
    p_source_customer_id,
    p_target_customer_id
  from public.appointments a
  where a.customer_id = p_source_customer_id
  order by a.id;

  get diagnostics v_expected_count = row_count;

  update public.appointments a
  set customer_id = p_target_customer_id
  where a.customer_id = p_source_customer_id;

  get diagnostics v_moved_count = row_count;

  if v_moved_count <> v_expected_count then
    raise exception '병합 중 예약 이동 건수가 일치하지 않습니다. 변경 사항이 취소되었습니다.'
      using errcode = '55000';
  end if;

  return query
  select
    v_event_id,
    p_source_customer_id,
    p_target_customer_id,
    v_moved_count,
    v_merged_at;
end;
$$;

create or replace function public.undo_customer_merge(p_event_id uuid)
returns table (
  event_id uuid,
  source_customer_id uuid,
  target_customer_id uuid,
  restored_appointment_count integer,
  undone_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_event public.customer_merge_events%rowtype;
  v_source public.customers%rowtype;
  v_target public.customers%rowtype;
  v_expected_count integer := 0;
  v_current_count integer := 0;
  v_restored_count integer := 0;
  v_undone_at timestamptz := clock_timestamp();
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '고객 병합을 취소할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception '병합 이벤트 ID는 필수입니다.' using errcode = '22023';
  end if;

  select e.* into v_event
  from public.customer_merge_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception '병합 이벤트를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_event.undone_at is not null then
    raise exception '이미 취소된 병합입니다.' using errcode = '55000';
  end if;

  perform 1
  from public.customers c
  where c.id in (v_event.source_customer_id, v_event.target_customer_id)
  order by c.id
  for update;

  select c.* into v_source
  from public.customers c
  where c.id = v_event.source_customer_id;

  select c.* into v_target
  from public.customers c
  where c.id = v_event.target_customer_id;

  if v_source.id is null or v_target.id is null then
    raise exception '병합 고객 레코드가 없어 취소할 수 없습니다.' using errcode = '55000';
  end if;

  if v_source.merged_into_customer_id is distinct from v_event.target_customer_id
     or v_source.archived_at is distinct from v_event.merged_at
     or v_source.anonymized_at is not null
     or v_source.updated_at is distinct from v_event.source_updated_at_at_merge then
    raise exception '원본 고객 상태가 병합 이후 변경되어 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  if v_target.archived_at is not null
     or v_target.merged_into_customer_id is not null
     or v_target.anonymized_at is not null
     or v_target.updated_at is distinct from v_event.target_updated_at_at_merge then
    raise exception '대표 고객 상태가 병합 이후 변경되어 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.customer_merge_events later
    where later.id <> v_event.id
      and later.undone_at is null
      and later.merged_at > v_event.merged_at
      and (
        later.source_customer_id in (v_event.source_customer_id, v_event.target_customer_id)
        or later.target_customer_id in (v_event.source_customer_id, v_event.target_customer_id)
      )
  ) then
    raise exception '이후 병합 이력이 있어 먼저 최신 병합부터 취소해야 합니다.'
      using errcode = '55000';
  end if;

  select count(*)::integer into v_expected_count
  from public.customer_merge_appointment_moves m
  where m.event_id = v_event.id;

  select count(*)::integer into v_current_count
  from public.customer_merge_appointment_moves m
  join public.appointments a on a.id = m.appointment_id
  where m.event_id = v_event.id
    and a.customer_id = v_event.target_customer_id;

  if v_current_count <> v_expected_count then
    raise exception '병합된 예약의 현재 소유 고객이 달라 안전하게 취소할 수 없습니다.'
      using errcode = '55000';
  end if;

  -- 예약 guard가 원본 고객을 활성 상태로 확인하도록 고객을 먼저 복원한다.
  update public.customers c
  set
    archived_at = null,
    archived_by = null,
    archive_reason = null,
    merged_into_customer_id = null
  where c.id = v_event.source_customer_id;

  update public.appointments a
  set customer_id = v_event.source_customer_id
  where exists (
    select 1
    from public.customer_merge_appointment_moves m
    where m.event_id = v_event.id
      and m.appointment_id = a.id
  )
    and a.customer_id = v_event.target_customer_id;

  get diagnostics v_restored_count = row_count;

  if v_restored_count <> v_expected_count then
    raise exception '병합 취소 중 예약 복원 건수가 일치하지 않습니다. 변경 사항이 취소되었습니다.'
      using errcode = '55000';
  end if;

  update public.customer_merge_events e
  set
    undone_at = v_undone_at,
    undone_by = v_actor
  where e.id = v_event.id;

  return query
  select
    v_event.id,
    v_event.source_customer_id,
    v_event.target_customer_id,
    v_restored_count,
    v_undone_at;
end;
$$;

-- public schema 함수는 기본적으로 PUBLIC EXECUTE가 부여되므로 모두 회수한 뒤 최소 grant만 연다.
revoke all on function public.archive_customer(uuid, text) from public;
revoke all on function public.archive_customer(uuid, text) from anon;
revoke all on function public.archive_customer(uuid, text) from authenticated;
grant execute on function public.archive_customer(uuid, text) to authenticated;

revoke all on function public.restore_customer(uuid) from public;
revoke all on function public.restore_customer(uuid) from anon;
revoke all on function public.restore_customer(uuid) from authenticated;
grant execute on function public.restore_customer(uuid) to authenticated;

revoke all on function public.anonymize_customer(uuid) from public;
revoke all on function public.anonymize_customer(uuid) from anon;
revoke all on function public.anonymize_customer(uuid) from authenticated;
grant execute on function public.anonymize_customer(uuid) to authenticated;

revoke all on function public.find_customer_duplicates(text, text, uuid) from public;
revoke all on function public.find_customer_duplicates(text, text, uuid) from anon;
revoke all on function public.find_customer_duplicates(text, text, uuid) from authenticated;
grant execute on function public.find_customer_duplicates(text, text, uuid) to authenticated;

revoke all on function public.list_customer_duplicate_candidates() from public;
revoke all on function public.list_customer_duplicate_candidates() from anon;
revoke all on function public.list_customer_duplicate_candidates() from authenticated;
grant execute on function public.list_customer_duplicate_candidates() to authenticated;

revoke all on function public.merge_customers(uuid, uuid) from public;
revoke all on function public.merge_customers(uuid, uuid) from anon;
revoke all on function public.merge_customers(uuid, uuid) from authenticated;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

revoke all on function public.undo_customer_merge(uuid) from public;
revoke all on function public.undo_customer_merge(uuid) from anon;
revoke all on function public.undo_customer_merge(uuid) from authenticated;
grant execute on function public.undo_customer_merge(uuid) to authenticated;
