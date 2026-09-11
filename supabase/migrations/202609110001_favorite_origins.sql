create table public.favorite_origins (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  place_name text not null,
  address text not null default '',
  x double precision not null,
  y double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, label)
);

create index favorite_origins_user_updated_idx
  on public.favorite_origins(user_id, updated_at desc);

alter table public.saved_trips add column origin jsonb;

alter table public.favorite_origins enable row level security;

revoke all on public.favorite_origins from anon;
grant select, insert, update, delete on public.favorite_origins to authenticated;

create policy "users read own favorite origins"
  on public.favorite_origins for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own favorite origins"
  on public.favorite_origins for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own favorite origins"
  on public.favorite_origins for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own favorite origins"
  on public.favorite_origins for delete to authenticated
  using (user_id = auth.uid());
