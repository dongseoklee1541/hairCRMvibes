-- ==========================================
-- R-03 MVP: 휴무일/충돌 방지/취소 감사
-- ==========================================

alter table public.appointments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id),
  add column if not exists cancelled_reason text;

create table if not exists public.salon_closed_dates (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  note text,
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salon_closed_dates enable row level security;

drop policy if exists "Authenticated users can read closed dates" on public.salon_closed_dates;
create policy "Authenticated users can read closed dates"
  on public.salon_closed_dates
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owners can manage closed dates" on public.salon_closed_dates;
create policy "Owners can manage closed dates"
  on public.salon_closed_dates
  for all
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists set_closed_dates_updated_at on public.salon_closed_dates;
create trigger set_closed_dates_updated_at
  before update on public.salon_closed_dates
  for each row execute function public.set_updated_at();

create or replace function public.fill_cancel_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status is distinct from 'cancelled') then
    new.cancelled_at = coalesce(new.cancelled_at, now());
    new.cancelled_by = coalesce(new.cancelled_by, auth.uid());
    new.cancelled_reason = coalesce(nullif(new.cancelled_reason, ''), 'manual');
  elsif new.status is distinct from 'cancelled' then
    new.cancelled_at = null;
    new.cancelled_by = null;
    new.cancelled_reason = null;
  end if;

  return new;
end;
$$;

drop trigger if exists fill_appointments_cancel_audit on public.appointments;
create trigger fill_appointments_cancel_audit
  before insert or update on public.appointments
  for each row execute function public.fill_cancel_audit_fields();

create or replace function public.guard_closed_day_appointment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmed'
     and exists (
       select 1
       from public.salon_closed_dates scd
       where scd.closed_date = new.date
     ) then
    raise exception '해당 날짜는 휴무일로 설정되어 예약할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_closed_day_appointment on public.appointments;
create trigger guard_closed_day_appointment
  before insert or update of date, status on public.appointments
  for each row execute function public.guard_closed_day_appointment();

create or replace function public.apply_closed_day_with_cancellations(
  p_closed_date date,
  p_cancel_ids uuid[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_remaining integer;
  v_applied integer := 0;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is distinct from 'owner' then
    raise exception '휴무일 설정 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_closed_date is null then
    raise exception '휴무일 날짜는 필수입니다.';
  end if;

  if coalesce(array_length(p_cancel_ids, 1), 0) > 0 then
    update public.appointments
    set
      status = 'cancelled',
      cancelled_reason = 'closed_day',
      cancelled_by = v_actor,
      cancelled_at = now(),
      updated_at = now()
    where id = any (p_cancel_ids)
      and date = p_closed_date
      and status = 'confirmed';

    get diagnostics v_applied = row_count;
  end if;

  select count(*)
  into v_remaining
  from public.appointments a
  where a.date = p_closed_date
    and a.status = 'confirmed';

  if v_remaining > 0 then
    raise exception '해당 날짜에 confirmed 예약이 남아 있어 휴무일로 저장할 수 없습니다.' using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (
    closed_date,
    note,
    created_by,
    updated_by
  )
  values (
    p_closed_date,
    p_note,
    v_actor,
    v_actor
  )
  on conflict (closed_date) do update
  set
    note = excluded.note,
    updated_by = v_actor,
    updated_at = now();

  return jsonb_build_object(
    'closed_date', p_closed_date,
    'cancelled_count', v_applied,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from public;
grant execute on function public.apply_closed_day_with_cancellations(date, uuid[], text) to authenticated;
