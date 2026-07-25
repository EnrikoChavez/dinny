create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  age smallint check (age between 1 and 120),
  gender text,
  location text,
  dietary_restrictions text[] not null default '{}',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists age smallint check (age between 1 and 120),
  add column if not exists gender text,
  add column if not exists location text,
  add column if not exists dietary_restrictions text[] not null default '{}',
  add column if not exists onboarding_complete boolean not null default false;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  gluten_free boolean not null default false,
  lactose_free boolean not null default false,
  high_protein boolean not null default false,
  max_cook_minutes integer,
  spice_level smallint check (spice_level between 0 and 5),
  calorie_goal integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.cuisine_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  cuisine text not null,
  score smallint not null default 5 check (score between 0 and 10),
  primary key (user_id, cuisine)
);

create table if not exists public.recipe_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  recipe jsonb not null,
  used_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.cuisine_preferences enable row level security;
alter table public.recipe_history enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can read their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

create policy "Users can manage their own cuisine preferences"
  on public.cuisine_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their own recipe history"
  on public.recipe_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recipe history"
  on public.recipe_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recipe history"
  on public.recipe_history for update
  using (auth.uid() = user_id);

create policy "Users can delete their own recipe history"
  on public.recipe_history for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
