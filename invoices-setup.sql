-- Run once in Supabase > SQL Editor
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  txn_id uuid,
  customer_id uuid,
  invoice_date date,
  customer_name text,
  total numeric,
  balance numeric,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.invoices enable row level security;
drop policy if exists "owner full access" on public.invoices;
create policy "owner full access" on public.invoices for all to authenticated
  using ((auth.jwt() ->> 'email') = 'assuregoldsg1@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'assuregoldsg1@gmail.com');
