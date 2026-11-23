-- Each person's binder: one row per card (the card's details live in `data`).
create table if not exists public.binder_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null,          -- milliseconds, set by the app; newest change wins
  deleted boolean not null default false
);
create index if not exists binder_items_user on public.binder_items (user_id);

alter table public.binder_items enable row level security;
drop policy if exists "own binder" on public.binder_items;
create policy "own binder" on public.binder_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- One row per Claude call, used for the daily scan limit.
create table if not exists public.scan_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null,
  created_at timestamptz not null default now()
);
create index if not exists scan_log_user_time on public.scan_log (user_id, created_at);

alter table public.scan_log enable row level security;
drop policy if exists "own scans read" on public.scan_log;
create policy "own scans read" on public.scan_log for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own scans insert" on public.scan_log;
create policy "own scans insert" on public.scan_log for insert to authenticated with check (user_id = (select auth.uid()));
