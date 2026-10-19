# JK44 Cinema Night Madrid

RSVP page for the JK44 Studio premiere of **Monozukuri**, **Glacier Surfing** and **BEDI**
at Súper 8 Cinema, Madrid. Thursday 3 December 2026, 19:00. 150 seats.

Live at **https://cinemanight.jk44studio.com** (GitHub Pages). Guest list stored in Supabase.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `app.js` | RSVP logic: sign-up, ticket, guest list (refreshes every 30 s) |
| `config.js` | Supabase project URL and publishable key |
| `supabase/schema.sql` | Table and functions; run once in Supabase |
| `assets/` | Posters and the social-share preview image (`og.jpg`) |
| `CNAME` | Custom domain for GitHub Pages |

## Setup

1. **Supabase**: create a free project at supabase.com, open *SQL Editor*, paste `supabase/schema.sql`, run it.
   Copy the *Project URL* and the *publishable* (or legacy *anon*) key from *Project Settings → API* into `config.js`.
2. **GitHub Pages**: repo *Settings → Pages* → *Deploy from a branch* → `main` / root.
   Custom domain: `cinemanight.jk44studio.com`, then tick *Enforce HTTPS* once the certificate is issued.
3. **DNS** (wherever jk44studio.com is managed): add a `CNAME` record
   `cinemanight` → `jk44studio.github.io`.

## How it works

- Guests never write to the table directly. The page calls four database functions:
  `guest_list`, `rsvp`, `update_rsvp`, `cancel_rsvp`.
- `rsvp` takes a lock and refuses with `full` once 150 people are on the list.
- Photos are cropped in the browser to 240×240 JPEG and stored with the name (about 15 KB each).
- Each guest's browser keeps a private token so they can edit or cancel their own RSVP.

## Managing the list

Supabase → *Table Editor* → `rsvps`: delete rows to remove guests, or *Export → CSV* for the door list.
