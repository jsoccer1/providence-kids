-- ============================================================
-- Providence Kids — 2026–2027 Class Assignments seed data
-- Run this AFTER schema.sql. Safe to re-run (upserts by id).
--
-- Source: "Nursery and Preschool Class Assignments 2026-2027"
-- sheets for the 8:00 AM, 9:30 AM, and 11:10 AM Sunday services.
-- Twos/Threes/Fours are placed on Promotion (Move Up) Sunday and
-- don't move again until the following year's Move Up Sunday —
-- class age must be reached by August 31, 2026.
--
-- No Saturday schedule was provided yet — add those rows here (or
-- via the admin page) once that sheet is available.
-- ============================================================

insert into classrooms (id, name, day, time, room, color, min_birthdate, max_birthdate, note) values

-- ---------- Sunday · 8:00 AM ----------
('s8_107',  'Nursery', 'Sunday', '8:00 AM',  '107', '#d96c5f', '2025-10-02', null,         ''),
('s8_111',  'Nursery', 'Sunday', '8:00 AM',  '111', '#dfa03c', '2025-06-01', '2025-09-30', ''),
('s8_117',  'Nursery', 'Sunday', '8:00 AM',  '117', '#6ba368', '2025-01-01', '2025-05-31', ''),
('s8_120',  'Nursery', 'Sunday', '8:00 AM',  '120', '#4e9bb0', '2024-09-01', '2024-12-31', ''),
('s8_125',  'Twos',    'Sunday', '8:00 AM',  '125', '#5b76c4', '2023-09-01', '2024-08-31', ''),
('s8_149',  'Threes',  'Sunday', '8:00 AM',  '149', '#9b6bc4', '2022-09-01', '2023-08-31', ''),
('s8_154',  'Fours',   'Sunday', '8:00 AM',  '154', '#c05f8f', '2021-09-01', '2022-08-31', ''),

-- ---------- Sunday · 9:30 AM ----------
('s93_103', 'Nursery', 'Sunday', '9:30 AM',  '103', '#d96c5f', '2026-01-02', null,         ''),
('s93_107', 'Nursery', 'Sunday', '9:30 AM',  '107', '#dfa03c', '2025-08-01', '2025-12-31', ''),
('s93_110', 'Nursery', 'Sunday', '9:30 AM',  '110', '#6ba368', '2025-04-01', '2025-07-31', ''),
('s93_111', 'Nursery', 'Sunday', '9:30 AM',  '111', '#4e9bb0', '2025-01-01', '2025-03-31', ''),
('s93_117', 'Nursery', 'Sunday', '9:30 AM',  '117', '#5b76c4', '2024-11-01', '2024-12-31', ''),
('s93_120', 'Nursery', 'Sunday', '9:30 AM',  '120', '#9b6bc4', '2024-09-01', '2024-10-31', ''),
('s93_143', 'Twos',    'Sunday', '9:30 AM',  '143', '#c05f8f', '2024-03-01', '2024-08-31', 'younger'),
('s93_147', 'Twos',    'Sunday', '9:30 AM',  '147', '#7a8a5a', '2023-09-01', '2024-02-28', 'older'),
('s93_152', 'Threes',  'Sunday', '9:30 AM',  '152', '#d96c5f', '2023-03-01', '2023-08-31', 'younger'),
('s93_154', 'Threes',  'Sunday', '9:30 AM',  '154', '#dfa03c', '2022-09-01', '2023-02-28', 'older'),
('s93_164', 'Fours',   'Sunday', '9:30 AM',  '164', '#6ba368', '2022-03-01', '2022-08-31', 'younger'),
('s93_166', 'Fours',   'Sunday', '9:30 AM',  '166', '#4e9bb0', '2021-09-01', '2022-02-28', 'older'),

-- ---------- Sunday · 11:10 AM ----------
('s1110_103', 'Nursery', 'Sunday', '11:10 AM', '103', '#d96c5f', '2025-11-02', null,         ''),
('s1110_110', 'Nursery', 'Sunday', '11:10 AM', '110', '#dfa03c', '2025-05-01', '2025-10-31', ''),
('s1110_120', 'Nursery', 'Sunday', '11:10 AM', '120', '#6ba368', '2024-09-01', '2025-04-30', ''),
('s1110_147', 'Twos',    'Sunday', '11:10 AM', '147', '#4e9bb0', '2023-09-01', '2024-08-31', ''),
('s1110_154', 'Threes',  'Sunday', '11:10 AM', '154', '#5b76c4', '2022-09-01', '2023-08-31', ''),
('s1110_164', 'Fours',   'Sunday', '11:10 AM', '164', '#9b6bc4', '2021-09-01', '2022-08-31', '')

on conflict (id) do update set
  name = excluded.name,
  day = excluded.day,
  time = excluded.time,
  room = excluded.room,
  color = excluded.color,
  min_birthdate = excluded.min_birthdate,
  max_birthdate = excluded.max_birthdate,
  note = excluded.note;
