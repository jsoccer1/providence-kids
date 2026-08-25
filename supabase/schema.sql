-- Providence Kids — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

create table if not exists classrooms (
  id          text primary key,
  name        text not null,
  day         text not null default 'Sunday',
  room        text not null default 'TBD',
  color       text not null default '#c9973a',
  min_months  integer not null default 0,
  max_months  integer not null default 12,
  created_at  timestamptz not null default now()
);

create table if not exists children (
  id             text primary key,
  name           text not null,
  birthdate      date not null,
  guardian_name  text not null default '',
  guardian_email text not null default '',
  notes          text not null default '',
  classroom_id   text references classrooms(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists children_classroom_idx on children (classroom_id);

-- Row Level Security
alter table classrooms enable row level security;
alter table children enable row level security;

-- ⚠️ TEMPORARY OPEN POLICIES ⚠️
-- These allow anyone with the anon key (i.e. anyone visiting the site)
-- to read AND write both tables. That is fine while you are testing,
-- but before entering real children's information you should add
-- Supabase Auth and replace these with authenticated-only policies.

create policy "anon read classrooms"   on classrooms for select using (true);
create policy "anon write classrooms"  on classrooms for insert with check (true);
create policy "anon update classrooms" on classrooms for update using (true);
create policy "anon delete classrooms" on classrooms for delete using (true);

create policy "anon read children"   on children for select using (true);
create policy "anon write children"  on children for insert with check (true);
create policy "anon update children" on children for update using (true);
create policy "anon delete children" on children for delete using (true);

-- When you add auth later, drop the policies above and use e.g.:
--   create policy "authed all" on children for all
--     using (auth.role() = 'authenticated')
--     with check (auth.role() = 'authenticated');
