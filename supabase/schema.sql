create table if not exists public.factory_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('daily', 'hazira', 'payment', 'loading', 'debt', 'stock', 'monthly')),
  date date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists factory_records_user_date_idx
  on public.factory_records (user_id, date desc);

alter table public.factory_records enable row level security;

drop policy if exists "Owners can read their factory records" on public.factory_records;
create policy "Owners can read their factory records"
  on public.factory_records for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owners can create their factory records" on public.factory_records;
create policy "Owners can create their factory records"
  on public.factory_records for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update their factory records" on public.factory_records;
create policy "Owners can update their factory records"
  on public.factory_records for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete their factory records" on public.factory_records;
create policy "Owners can delete their factory records"
  on public.factory_records for delete to authenticated
  using (auth.uid() = user_id);