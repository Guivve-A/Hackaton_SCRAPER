-- HackFinder: source monitoring + user suggestion channel
-- Run this in Supabase SQL Editor.

create table if not exists public.scrape_source_metrics (
  id bigint generated always as identity primary key,
  run_id text not null,
  source text not null,
  platform text not null,
  status text not null check (status in ('success', 'failed')),
  fetched_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scrape_source_metrics_source_created_at
  on public.scrape_source_metrics (source, created_at desc);

create index if not exists idx_scrape_source_metrics_created_at
  on public.scrape_source_metrics (created_at desc);

create table if not exists public.event_suggestions (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null,
  description text not null,
  is_online boolean not null default true,
  source text,
  contact_email text,
  status text not null default 'pending_review',
  submitted_from_ip text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  unique (url, title)
);

create index if not exists idx_event_suggestions_status_submitted_at
  on public.event_suggestions (status, submitted_at desc);

alter table public.scrape_source_metrics enable row level security;
alter table public.event_suggestions enable row level security;

drop policy if exists scrape_source_metrics_public_read on public.scrape_source_metrics;
create policy scrape_source_metrics_public_read
  on public.scrape_source_metrics
  for select
  using (true);
