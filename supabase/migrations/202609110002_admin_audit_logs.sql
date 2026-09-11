create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('block_user', 'unblock_user')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all on public.admin_audit_logs from anon, authenticated;

create policy "block signed-in reads of saved trips"
  on public.saved_trips as restrictive for all to authenticated
  using (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked))
  with check (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked));

create policy "block signed-in reads of favorite origins"
  on public.favorite_origins as restrictive for all to authenticated
  using (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked))
  with check (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked));
