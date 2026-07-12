-- ==========================================
-- R-08: 서비스 마스터 가격과 예약 snapshot
-- 기존 서비스/예약은 추정 backfill하지 않는다.
-- ==========================================

alter table public.salon_service_defaults
  add column if not exists price_krw integer;

alter table public.salon_operation_settings
  add column if not exists default_service_id uuid;

alter table public.appointments
  add column if not exists service_id uuid,
  add column if not exists price_snapshot_krw integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_service_defaults_price_krw_check'
      and conrelid = 'public.salon_service_defaults'::regclass
  ) then
    alter table public.salon_service_defaults
      add constraint salon_service_defaults_price_krw_check check (
        price_krw is null or price_krw >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_operation_settings_default_service_id_fkey'
      and conrelid = 'public.salon_operation_settings'::regclass
  ) then
    alter table public.salon_operation_settings
      add constraint salon_operation_settings_default_service_id_fkey
      foreign key (default_service_id)
      references public.salon_service_defaults (id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_service_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_service_id_fkey
      foreign key (service_id)
      references public.salon_service_defaults (id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_price_snapshot_krw_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_price_snapshot_krw_check check (
        price_snapshot_krw is null or price_snapshot_krw >= 0
      );
  end if;
end
$$;

create index if not exists appointments_service_id_idx
  on public.appointments (service_id);

-- Data API grant와 RLS는 별도 경계다. 앱 역할은 hard delete 권한을 갖지 않는다.
revoke all on table public.salon_service_defaults from anon;
revoke all on table public.salon_service_defaults from authenticated;
grant select, insert, update on table public.salon_service_defaults to authenticated;

drop policy if exists "Owners can manage service defaults" on public.salon_service_defaults;
drop policy if exists "Owners can create service defaults" on public.salon_service_defaults;
drop policy if exists "Owners can update service defaults" on public.salon_service_defaults;

create policy "Owners can create service defaults"
  on public.salon_service_defaults
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create policy "Owners can update service defaults"
  on public.salon_service_defaults
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

create or replace function public.guard_active_default_service()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- default 지정과 service 비활성화의 cross-table write skew를 직렬화한다.
  perform pg_catalog.pg_advisory_xact_lock(20260712, 8);

  if new.default_service_id is not null
     and not exists (
       select 1
       from public.salon_service_defaults s
       where s.id = new.default_service_id
         and s.is_active is true
     ) then
    raise exception '기본 서비스는 활성 서비스만 선택할 수 있습니다.' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_active_default_service() from public;
revoke all on function public.guard_active_default_service() from anon;
revoke all on function public.guard_active_default_service() from authenticated;

drop trigger if exists guard_active_default_service on public.salon_operation_settings;
create trigger guard_active_default_service
  before insert or update of default_service_id
  on public.salon_operation_settings
  for each row execute function public.guard_active_default_service();

create or replace function public.guard_default_service_deactivation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- guard_active_default_service()와 동일한 transaction lock을 사용한다.
  perform pg_catalog.pg_advisory_xact_lock(20260712, 8);

  if old.is_active is true
     and new.is_active is false
     and exists (
       select 1
       from public.salon_operation_settings s
       where s.id = true
         and s.default_service_id = old.id
     ) then
    raise exception '현재 기본 서비스는 비활성화할 수 없습니다. 다른 기본 서비스를 먼저 선택하세요.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_default_service_deactivation() from public;
revoke all on function public.guard_default_service_deactivation() from anon;
revoke all on function public.guard_default_service_deactivation() from authenticated;

drop trigger if exists guard_default_service_deactivation on public.salon_service_defaults;
create trigger guard_default_service_deactivation
  before update of is_active
  on public.salon_service_defaults
  for each row execute function public.guard_default_service_deactivation();

create or replace function public.apply_appointment_service_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_price_krw integer;
  v_default_duration_minutes integer;
  v_is_active boolean;
  v_refresh_snapshot boolean;
  v_requires_active_check boolean;
begin
  if tg_op = 'INSERT' then
    v_refresh_snapshot := true;
    v_requires_active_check := true;
  else
    v_refresh_snapshot := new.service_id is distinct from old.service_id;
    v_requires_active_check :=
      v_refresh_snapshot
      or (
        old.status is distinct from 'confirmed'
        and new.status = 'confirmed'
      );
  end if;

  if tg_op = 'INSERT'
     and new.service_id is null
     and new.status is distinct from 'completed' then
    raise exception '서비스 없는 신규 자유입력 예약은 완료 이력만 허용됩니다.' using errcode = '22023';
  end if;

  -- 한 번 master snapshot이 생성된 예약은 연결과 가격 근거를 함께 보존한다.
  -- nullable service_id는 legacy 행과 신규 completed 자유입력 이력에만 사용한다.
  if tg_op = 'UPDATE'
     and old.service_id is not null
     and new.service_id is null then
    raise exception '서비스가 연결된 예약은 서비스 연결을 해제할 수 없습니다.' using errcode = '22023';
  end if;

  -- 기존 confirmed + NULL service_id 행의 무관한 수정은 계속 허용한다.
  -- 신규 confirmed와 completed/cancelled -> confirmed 전환만 활성 FK를 요구한다.
  if new.status = 'confirmed'
     and new.service_id is null
     and v_requires_active_check then
    raise exception '확정 예약에는 활성 서비스가 필요합니다.' using errcode = '22023';
  end if;

  if new.service_id is null then
    -- master가 없는 과거 completed 이력은 자유입력 시술명/시간을 유지하되
    -- 가격을 임의로 받을 수 없다.
    new.price_snapshot_krw := null;
    return new;
  end if;

  if v_requires_active_check then
    select
      s.name,
      s.price_krw,
      s.default_duration_minutes,
      s.is_active
    into
      v_name,
      v_price_krw,
      v_default_duration_minutes,
      v_is_active
    from public.salon_service_defaults s
    where s.id = new.service_id;

    if not found then
      raise exception '선택한 서비스를 찾을 수 없습니다.' using errcode = '23503';
    end if;

    if v_is_active is distinct from true then
      raise exception '비활성 서비스는 예약에 새로 선택할 수 없습니다.' using errcode = '55000';
    end if;
  end if;

  if v_refresh_snapshot then
    new.service := btrim(v_name);
    new.price_snapshot_krw := v_price_krw;

    -- INSERT/서비스 변경 모두 NULL만 "master 기본시간 사용"을 뜻한다.
    -- UPDATE row에 남아 있는 값과 명시적 same-as-old override를 구별할 수
    -- 없으므로 모든 non-NULL 값은 예약 snapshot으로 그대로 보존한다.
    new.duration_minutes := coalesce(
      new.duration_minutes,
      v_default_duration_minutes
    );
  else
    -- 같은 service_id에 대한 client-side 이름/가격 변조와 현재가 재평가를 막는다.
    new.service := old.service;
    new.price_snapshot_krw := old.price_snapshot_krw;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_appointment_service_snapshot() from public;
revoke all on function public.apply_appointment_service_snapshot() from anon;
revoke all on function public.apply_appointment_service_snapshot() from authenticated;

drop trigger if exists apply_appointment_service_snapshot on public.appointments;
create trigger apply_appointment_service_snapshot
  before insert or update of service_id, service, price_snapshot_krw, duration_minutes, status
  on public.appointments
  for each row execute function public.apply_appointment_service_snapshot();

-- PostgreSQL은 같은 timing/event trigger를 이름순으로 실행한다.
-- apply_*가 먼저 duration snapshot을 채운 뒤 R-03 guard가 충돌을 검사한다.
drop trigger if exists guard_appointment_conflict_and_business_hours on public.appointments;
create trigger guard_appointment_conflict_and_business_hours
  before insert or update of date, time, duration, duration_minutes, service_id, status
  on public.appointments
  for each row execute function public.guard_appointment_conflict_and_business_hours();
