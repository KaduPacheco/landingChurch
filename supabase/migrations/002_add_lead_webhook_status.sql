alter table public.demo_leads
  add column if not exists webhook_status text not null default 'pending',
  add column if not exists webhook_sent_at timestamptz,
  add column if not exists webhook_error text;
create index if not exists demo_leads_webhook_status_idx
  on public.demo_leads (webhook_status)
  where webhook_status <> 'sent';
