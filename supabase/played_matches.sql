create extension if not exists pgcrypto;

create table if not exists public.played_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  match_saved_at timestamptz not null,
  status text not null check (status in ('finished', 'abandoned')),
  match_kind text not null check (match_kind in ('human-human', 'human-ai')),
  winner_player_id integer null check (winner_player_id in (1, 2)),
  winner_name text null,
  summary text not null default '',
  deck_mode text not null check (deck_mode in ('shared', 'separate')),
  player_controllers jsonb not null,
  human_aliases jsonb not null,
  app_version text not null,
  action_count integer not null default 0 check (action_count >= 0),
  record jsonb not null
);

alter table public.played_matches enable row level security;

drop policy if exists "public read played_matches" on public.played_matches;
create policy "public read played_matches"
on public.played_matches
for select
using (true);

drop policy if exists "public insert played_matches" on public.played_matches;
create policy "public insert played_matches"
on public.played_matches
for insert
with check (
  status in ('finished', 'abandoned')
  and match_kind in ('human-human', 'human-ai')
  and deck_mode in ('shared', 'separate')
  and action_count >= 0
  and jsonb_typeof(player_controllers) = 'array'
  and jsonb_array_length(player_controllers) = 2
  and jsonb_typeof(human_aliases) = 'array'
  and jsonb_array_length(human_aliases) = 2
  and jsonb_typeof(record) = 'object'
  and length(app_version) > 0
);
