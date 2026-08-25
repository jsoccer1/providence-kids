-- ============================================================
-- Providence Kids — Class Finder schema
-- ============================================================
-- This REPLACES the old roster-based schema. Children are no longer
-- stored anywhere — this is a pure "birthday -> classroom" lookup
-- tool. Staff pick a service (day + time), enter a birthday or age,
-- and the app finds the classroom whose date range covers it.
--
-- ⚠️ RUN THIS ONCE IN THE SUPABASE SQL EDITOR. It drops the old
-- `children` table and rebuilds `classrooms` with a new shape.
-- Any names/notes/guardian info previously stored in `children`
-- will be permanently deleted. Classroom age-band edits you made
-- in the old admin page will also be gone (replaced by the seed
-- data in seed_classes.sql, which you should run right after this).
-- ============================================================

drop table if exists children;
drop table if exists classrooms;

create table classrooms (
  id            text primary key,
  name          text not null,
  day           text not null default 'Sunday',      -- 'Saturday' | 'Sunday'
  time          text not null default '8:00 AM',      -- e.g. '8:00 AM', '9:30 AM', '11:10 AM'
  room          text not null default 'TBD',
  color         text not null default '#c9973a',
  min_birthdate date,                                  -- inclusive lower bound; null = no lower bound
  max_birthdate date,                                  -- inclusive upper bound; null = open-ended (newest babies)
  note          text not null default '',              -- e.g. 'younger', 'older'
  created_at    timestamptz not null default now()
);

create index classrooms_day_time_idx on classrooms (day, time);

alter table classrooms enable row level security;

-- Open policies: no personal/child data lives in this table, so it's
-- reasonable for the anon (public) key to read + write it without a
-- login. If you later want the admin page login-gated, add Supabase
-- Auth and swap these for `using (auth.role() = 'authenticated')`.
create policy "anon read classrooms"   on classrooms for select using (true);
create policy "anon write classrooms"  on classrooms for insert with check (true);
create policy "anon update classrooms" on classrooms for update using (true);
create policy "anon delete classrooms" on classrooms for delete using (true);
