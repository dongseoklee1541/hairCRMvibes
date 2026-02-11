-- ==========================================
-- 미용실 CRM 데이터베이스 스키마
-- ==========================================

-- 1. Customers 테이블
create table public.customers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_pkey primary key (id)
);

-- 2. Appointments 테이블
create table public.appointments (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  date date not null,
  time time not null,
  service text not null,
  duration text, -- 예상 소요시간 (예: "1시간 30분")
  memo text,
  status text not null default 'confirmed', -- confirmed, completed, cancelled
  created_at timestamptz not null default now(),
  constraint appointments_pkey primary key (id),
  constraint appointments_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete cascade
);

-- 3. RLS (Row Level Security) 설정
-- 개인 사용 앱이므로 anon 키로 모든 권한을 허용합니다 (추후 인증 도입 시 수정 필요)

alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create policy "Allow all access to customers"
  on public.customers
  for all
  using (true)
  with check (true);

create policy "Allow all access to appointments"
  on public.appointments
  for all
  using (true)
  with check (true);

-- 4. 실시간 구독 설정 (선택 사항)
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.appointments;
