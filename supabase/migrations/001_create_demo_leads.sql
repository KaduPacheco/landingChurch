create extension if not exists pgcrypto;

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  church text not null,
  phone text not null,
  email text not null,
  church_size text not null,
  source text not null default 'landing_simplechurch',
  page text,
  submitted_at timestamptz,
  tracking jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  webhook_status text not null default 'pending',
  webhook_sent_at timestamptz,
  webhook_error text,
  created_at timestamptz not null default now()
);

create index if not exists demo_leads_created_at_idx on public.demo_leads (created_at desc);
create index if not exists demo_leads_email_idx on public.demo_leads (email);

alter table public.demo_leads enable row level security;

comment on table public.demo_leads is 'Leads submitted from the SimpleChurch landing page demo form.';
