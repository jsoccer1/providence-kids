# Providence Kids — Class Finder

A lookup tool for Providence Church: staff enter a child's birthday (or age
in months) plus which service they're attending, and the app shows the
matching classroom. No child records are stored — this is a calculator, not
a roster. Plain HTML/CSS/JS frontend, Supabase database, hosted on GitHub
Pages.

## Pages

- **index.html** — Class Finder. Enter a birthday (calendar picker) or age
  in months, pick the Day and Service Time sliders (auto-detected from the
  current date/time, defaulting to Sunday 8:00 AM if it's neither Saturday
  nor Sunday), and see the matching classroom. All classes for the selected
  day/time are listed below, with the match highlighted.
- **admin.html** — manage the classroom definitions: name, day, service
  time, room, birthdate range, color, and an optional note (e.g.
  "younger"/"older"). This is what you'll update each year on Move Up
  Sunday when the age bands shift.

## Modes

- **With Supabase configured** — classroom definitions live in your
  Supabase project. Every add/edit/delete writes through immediately.
- **Without Supabase** — the app falls back to the current browser's
  localStorage, seeded with the real 2026–2027 Sunday class assignments.

## Deploy to GitHub Pages

1. Push this folder to your repo (or upload the changed files via the
   GitHub web UI: `index.html`, `admin.html`, `app.js`, `styles.css`,
   `supabase/schema.sql`, `supabase/seed_classes.sql`, this `README.md`).
2. **Settings → Pages → Source: GitHub Actions** (already set up if this
   is an existing repo).
3. Every push to `main` deploys via `.github/workflows/deploy.yml`.

## Connect / migrate Supabase

⚠️ This redesign changes the database shape. If you already have Supabase
connected from the old roster-based version:

1. Open your Supabase project → **SQL Editor → New query**.
2. Paste and run `supabase/schema.sql`. This **drops the old `children`
   table and rebuilds `classrooms`** with the new day/time/date-range
   columns. Any names/notes previously saved in `children` will be
   deleted — that data is no longer used by the app.
3. Paste and run `supabase/seed_classes.sql`. This inserts all the real
   Sunday classes (8:00 AM, 9:30 AM, 11:10 AM) from the class assignment
   sheets. Safe to re-run — it upserts by id.
4. No Saturday sheet was provided yet, so no Saturday classes are seeded.
   Add them from the admin page, or extend `seed_classes.sql`, once that
   schedule is available.

If you're starting fresh (no existing Supabase project):

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` then `supabase/seed_classes.sql` in the SQL
   Editor.
3. Add repository secrets (**Settings → Secrets and variables → Actions**):
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Re-run the deploy (push a commit, or **Actions → Run workflow**).

For local development, copy `config.example.js` to `config.js`, fill in
the same two values, then serve the folder (`python3 -m http.server`).

> The anon key is designed to be public — access control comes from Row
> Level Security, not from hiding the key. Since no personal/child data
> is stored anymore (just class definitions), open read/write policies
> are low-risk. Add Supabase Auth later if you want the admin page
> login-gated.

## Structure

```
index.html                  Class Finder (birthday/age lookup + day/time sliders)
admin.html                  Classroom definitions admin
styles.css                  all styles
app.js                      UI + Store data layer (Supabase or localStorage)
config.example.js           template for Supabase credentials
supabase/schema.sql         database schema + RLS policies (drops old roster tables)
supabase/seed_classes.sql   real 2026–2027 Sunday class assignments
.github/workflows/          GitHub Pages deployment
```
