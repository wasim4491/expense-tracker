create table if not exists public.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null check (char_length(trim(person_name)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  direction text not null check (direction in ('receive', 'owe')),
  description text not null check (char_length(trim(description)) between 1 and 500),
  entry_date date not null default current_date,
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists money_entries_user_date_idx
  on public.money_entries (user_id, entry_date desc, created_at desc);

alter table public.money_entries enable row level security;

revoke all on table public.money_entries from anon;
grant select, insert, update, delete on table public.money_entries to authenticated;

drop policy if exists "Users can read their own money entries" on public.money_entries;
create policy "Users can read their own money entries"
  on public.money_entries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own money entries" on public.money_entries;
create policy "Users can add their own money entries"
  on public.money_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own money entries" on public.money_entries;
create policy "Users can update their own money entries"
  on public.money_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own money entries" on public.money_entries;
create policy "Users can delete their own money entries"
  on public.money_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_money_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_money_entries_updated_at on public.money_entries;
create trigger set_money_entries_updated_at
  before update on public.money_entries
  for each row execute function public.set_money_entries_updated_at();
