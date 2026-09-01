create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_trips (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  city text not null,
  start_time text not null default '',
  end_time text not null default '',
  preferences jsonb not null default '[]'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, name)
);

create index saved_trips_user_updated_idx
  on public.saved_trips(user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.saved_trips enable row level security;

revoke all on public.profiles from anon;
revoke all on public.saved_trips from anon;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_trips to authenticated;

create policy "users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "users update own display name"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users read own trips"
  on public.saved_trips for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own trips"
  on public.saved_trips for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own trips"
  on public.saved_trips for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own trips"
  on public.saved_trips for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
