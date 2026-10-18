-- Run once in Supabase > SQL Editor
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "owner full access" on public.push_subscriptions;
create policy "owner full access" on public.push_subscriptions for all to authenticated
  using ((auth.jwt() ->> 'email') = 'assuregoldsg1@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'assuregoldsg1@gmail.com');

create or replace function public.notify_new_customer() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://hphrrbvznveziaawwnom.supabase.co/functions/v1/notify-customer',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaHJyYnZ6bnZlemlhYXd3bm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzOTc5MDMsImV4cCI6MjA5Njk3MzkwM30.CcgOf6VDirOsNwBNIsthaJl6d265pPb5RVi-vw59fAw'),
      body := jsonb_build_object('customer_id', new.id)
    );
  exception when others then null;  -- a notification problem must never block a customer's submission
  end;
  return new;
end $$;

drop trigger if exists trg_notify_new_customer on public.customers;
create trigger trg_notify_new_customer after insert on public.customers
  for each row execute function public.notify_new_customer();
