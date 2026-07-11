-- ==========================================
-- Phase 1 genesis baseline
-- Must run before the 20260220 R-03 MVP migration on a fresh Supabase database.
-- Existing live databases with equivalent objects must verify schema parity and
-- repair migration history instead of executing this backdated migration.
-- ==========================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  date date not null,
  time time not null,
  service text not null,
  duration text,
  memo text,
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.profiles enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end
$$;
