create table if not exists beta_signups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null unique,
  rivers         text,
  current_method text,
  created_at     timestamptz not null default now(),
  status         text not null default 'pending'
);

alter table beta_signups enable row level security;

-- Public can insert (beta signup form is unauthenticated)
create policy "public_insert" on beta_signups
  for insert to anon with check (true);
