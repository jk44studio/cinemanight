# JK44 Cinema Night Madrid

RSVP page for the JK44 Studio premiere of **Monozukuri**, **Glacier Surfing** and **BEDI**
at Súper 8 Cinema, Madrid. Thursday 3 December 2026, 19:00. 200 seats.

Live at **https://cinemanight.jk44films.com** (GitHub Pages). Guest list stored in Supabase.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `app.js` | RSVP logic: sign-up, ticket, guest list (refreshes every 30 s) |
| `config.js` | Supabase project URL and publishable key; Mailchimp signup form URL |
| `supabase/schema.sql` | Table and functions; run once in Supabase |
| `assets/` | Posters and the social-share preview image (`og.jpg`) |
| `CNAME` | Custom domain for GitHub Pages |

## Setup

1. **Supabase**: create a free project at supabase.com, open *SQL Editor*, paste `supabase/schema.sql`, run it.
   Copy the *Project URL* and the *publishable* (or legacy *anon*) key from *Project Settings → API* into `config.js`.
2. **GitHub Pages**: repo *Settings → Pages* → *Deploy from a branch* → `main` / root.
   Custom domain: `cinemanight.jk44films.com`, then tick *Enforce HTTPS* once the certificate is issued.
3. **Mailchimp**: *Audience → Signup forms → Embedded forms*. From the generated code copy the form `action` URL
   (`https://….list-manage.com/subscribe/post?u=…&id=…`) into `mailchimpForm` in `config.js`.
   To tag guests, create a tag (e.g. *Cinema Night Madrid 2026*), regenerate the embed code with it, and copy the
   hidden `tags` input value into `mailchimpTags`.
4. **DNS** (wherever jk44films.com is managed: Framer): add a `CNAME` record
   `cinemanight` → `jk44studio.github.io`.

## How it works

- Guests never write to the table directly. The page calls four database functions:
  `guest_list`, `rsvp`, `update_rsvp`, `cancel_rsvp`.
- `rsvp` takes a lock and refuses with `full` once 200 people are on the list.
- Emails are stored in Supabase (never returned to the page) and one email = one seat.
- After each sign-up, or an email change, the page adds the guest to the Mailchimp audience via the embedded-form
  endpoint (no secret key involved). If the audience uses double opt-in, guests get a confirmation email first.
  If a Mailchimp call ever fails, the full list is still in Supabase: export the CSV and import it into Mailchimp.
- Photos are cropped in the browser to 240×240 JPEG and stored with the name (about 15 KB each).
- Each guest's browser keeps a private token so they can edit or cancel their own RSVP.

## Managing the list

Supabase → *Table Editor* → `rsvps`: delete rows to remove guests, or *Export → CSV* for the door list.
