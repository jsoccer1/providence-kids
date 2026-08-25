# Providence Kids — Classroom Management

Children's classroom management for Providence Church. Plain HTML/CSS/JS frontend, Supabase database, hosted on GitHub Pages.

## Pages

- **index.html** — public page. Parents search their child's name and see the assigned class, day, and room.
- **admin.html** — admin dashboard. Saturday (Rooms 110/120) and Sunday (Rooms 110–140) classrooms with 12 slots each, drag-and-drop assignment, add/edit children with guardian info and notes, classroom settings (name, day, room, color, age range), and an Unassigned Children table with search.

## Modes

- **With Supabase configured** — all data lives in your Supabase project. Every change (drag, edit, add, delete) writes through immediately. The database starts empty; add classrooms and children from the admin dashboard.
- **Without Supabase** — the app falls back to saving in the current browser only (localStorage), with a note in the admin header.

## Deploy to GitHub Pages

1. Create a new repo on GitHub, then push this folder:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/providence-kids.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` deploys via `.github/workflows/deploy.yml`.

## Connect Supabase

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Add repository secrets (**Settings → Secrets and variables → Actions**):
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_ANON_KEY` — your anon public key
4. Re-run the deploy (push any commit or use *Run workflow*). The workflow writes `config.js` from the secrets at build time.

For local development, copy `config.example.js` to `config.js` and fill in the same two values, then serve the folder (`python3 -m http.server`).

> The anon key is designed to be public — access control comes from Row Level Security, not from hiding the key. A `.env` file can't work here because GitHub Pages is static hosting with no server; the Actions secrets play that role instead.

## ⚠️ Before entering real children's data

`supabase/schema.sql` currently ships **open RLS policies** so the app works without login, meaning anyone who visits the site can read and edit the data — including children's names, birthdates, and guardian contact info on the public internet. Before real use, add Supabase Auth to the admin page and replace the open policies with authenticated-only ones (a starting point is commented at the bottom of the schema file).

## Structure

```
index.html            public lookup page
admin.html            admin dashboard
styles.css            all styles
app.js                UI + Store data layer (Supabase or localStorage)
config.example.js     template for Supabase credentials
supabase/schema.sql   database schema + RLS policies
.github/workflows/    GitHub Pages deployment
```
