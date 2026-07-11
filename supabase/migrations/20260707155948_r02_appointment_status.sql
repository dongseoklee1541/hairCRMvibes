-- ==========================================
-- R-02: 예약 상태변경/취소 기반
-- ==========================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_status_check check (status in ('confirmed', 'completed', 'cancelled'));
  end if;
end $$;

create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_cancel_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_row public.appointments;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '예약 상태를 변경할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_appointment_id is null then
    raise exception '예약 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_status not in ('confirmed', 'completed', 'cancelled') then
    raise exception '지원하지 않는 예약 상태입니다.' using errcode = '22023';
  end if;

  update public.appointments
  set
    status = p_status,
    cancelled_reason = case
      when p_status = 'cancelled' then coalesce(nullif(btrim(p_cancel_reason), ''), 'manual')
      else null
    end,
    cancelled_by = case
      when p_status = 'cancelled' then v_actor
      else null
    end,
    cancelled_at = case
      when p_status = 'cancelled' then now()
      else null
    end,
    updated_at = now()
  where id = p_appointment_id
  returning * into v_row;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.set_appointment_status(uuid, text, text) from public;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;
