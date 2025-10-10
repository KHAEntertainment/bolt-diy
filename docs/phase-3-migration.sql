-- Phase 3 initial schema migration for Supabase
-- Run in Supabase SQL editor or via CLI

begin;

-- Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- users (app profile; mirrors auth.users.id)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'user',
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);
alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
for select using (id = auth.uid());
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
for insert with check (id = auth.uid());
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own" on public.users
for delete using (id = auth.uid());

-- user_preferences (one row per user)
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_provider text,
  selected_model text,
  is_debug_enabled boolean not null default false,
  default_prompt text,
  theme text,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;

drop policy if exists "prefs_select_own" on public.user_preferences;
create policy "prefs_select_own" on public.user_preferences
for select using (user_id = auth.uid());
drop policy if exists "prefs_insert_own" on public.user_preferences;
create policy "prefs_insert_own" on public.user_preferences
for insert with check (user_id = auth.uid());
drop policy if exists "prefs_update_own" on public.user_preferences;
create policy "prefs_update_own" on public.user_preferences
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "prefs_delete_own" on public.user_preferences;
create policy "prefs_delete_own" on public.user_preferences
for delete using (user_id = auth.uid());

drop trigger if exists user_prefs_set_updated_at on public.user_preferences;
create trigger user_prefs_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

-- provider_settings (per provider JSON settings)
create table if not exists public.provider_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.provider_settings enable row level security;

drop policy if exists "ps_select_own" on public.provider_settings;
create policy "ps_select_own" on public.provider_settings
for select using (user_id = auth.uid());
drop policy if exists "ps_insert_own" on public.provider_settings;
create policy "ps_insert_own" on public.provider_settings
for insert with check (user_id = auth.uid());
drop policy if exists "ps_update_own" on public.provider_settings;
create policy "ps_update_own" on public.provider_settings
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ps_delete_own" on public.provider_settings;
create policy "ps_delete_own" on public.provider_settings
for delete using (user_id = auth.uid());

drop trigger if exists provider_settings_set_updated_at on public.provider_settings;
create trigger provider_settings_set_updated_at
before update on public.provider_settings
for each row execute function public.set_updated_at();

-- provider_tokens (per provider secret tokens)
create table if not exists public.provider_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  token text not null,
  username text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.provider_tokens enable row level security;
create index if not exists provider_tokens_user_provider_idx on public.provider_tokens (user_id, provider);

drop policy if exists "pt_select_own" on public.provider_tokens;
create policy "pt_select_own" on public.provider_tokens
for select using (user_id = auth.uid());
drop policy if exists "pt_insert_own" on public.provider_tokens;
create policy "pt_insert_own" on public.provider_tokens
for insert with check (user_id = auth.uid());
drop policy if exists "pt_update_own" on public.provider_tokens;
create policy "pt_update_own" on public.provider_tokens
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pt_delete_own" on public.provider_tokens;
create policy "pt_delete_own" on public.provider_tokens
for delete using (user_id = auth.uid());

drop trigger if exists provider_tokens_set_updated_at on public.provider_tokens;
create trigger provider_tokens_set_updated_at
before update on public.provider_tokens
for each row execute function public.set_updated_at();

-- user_api_keys (per provider LLM/api keys)
create table if not exists public.user_api_keys (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.user_api_keys enable row level security;
create index if not exists user_api_keys_user_provider_idx on public.user_api_keys (user_id, provider);

drop policy if exists "uak_select_own" on public.user_api_keys;
create policy "uak_select_own" on public.user_api_keys
for select using (user_id = auth.uid());
drop policy if exists "uak_insert_own" on public.user_api_keys;
create policy "uak_insert_own" on public.user_api_keys
for insert with check (user_id = auth.uid());
drop policy if exists "uak_update_own" on public.user_api_keys;
create policy "uak_update_own" on public.user_api_keys
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "uak_delete_own" on public.user_api_keys;
create policy "uak_delete_own" on public.user_api_keys
for delete using (user_id = auth.uid());

drop trigger if exists user_api_keys_set_updated_at on public.user_api_keys;
create trigger user_api_keys_set_updated_at
before update on public.user_api_keys
for each row execute function public.set_updated_at();

-- optional: user_event_logs (durable logs)
create table if not exists public.user_event_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb
);
alter table public.user_event_logs enable row level security;
create index if not exists user_event_logs_user_ts_idx on public.user_event_logs (user_id, ts desc);

drop policy if exists "uel_select_own" on public.user_event_logs;
create policy "uel_select_own" on public.user_event_logs
for select using (user_id = auth.uid());
drop policy if exists "uel_insert_own" on public.user_event_logs;
create policy "uel_insert_own" on public.user_event_logs
for insert with check (user_id = auth.uid());
drop policy if exists "uel_delete_own" on public.user_event_logs;
create policy "uel_delete_own" on public.user_event_logs
for delete using (user_id = auth.uid());

commit;
