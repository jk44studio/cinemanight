-- JK44 Cinema Night RSVP: run once in Supabase → SQL Editor (safe to run again).
-- Guests never touch the table directly; the page calls the functions below.

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  email      text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  photo      text not null check (char_length(photo) < 120000 and photo like 'data:image/jpeg;base64,%'),
  token      uuid not null default gen_random_uuid(),  -- lets the guest's own device edit or cancel
  created_at timestamptz not null default now()
);
create unique index if not exists rsvps_email_key on public.rsvps (lower(email));

alter table public.rsvps enable row level security;  -- no policies: no direct access from the page
revoke all on public.rsvps from anon, authenticated;

-- Earlier versions without email
drop function if exists public.rsvp(text, text);
drop function if exists public.update_rsvp(uuid, uuid, text, text);

-- Public guest list: names and photos only (never emails or tokens)
create or replace function public.guest_list()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'name', r.name, 'photo', r.photo, 'created_at', r.created_at)
                           order by r.created_at, r.id), '[]'::json)
  from rsvps r;
$$;

-- Save a seat. Serialised with a lock so the list can never pass 200.
create or replace function public.rsvp(p_name text, p_email text, p_photo text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token uuid;
begin
  perform pg_advisory_xact_lock(4444150);
  if exists (select 1 from rsvps where lower(email) = lower(btrim(p_email))) then
    raise exception 'duplicate';
  end if;
  if (select count(*) from rsvps) >= 200 then
    raise exception 'full';
  end if;
  insert into rsvps (name, email, photo) values (btrim(p_name), lower(btrim(p_email)), p_photo)
  returning rsvps.id, rsvps.token into v_id, v_token;
  return json_build_object('id', v_id, 'token', v_token);
end;
$$;

create or replace function public.update_rsvp(p_id uuid, p_token uuid, p_name text, p_email text, p_photo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from rsvps where lower(email) = lower(btrim(p_email)) and rsvps.id <> p_id) then
    raise exception 'duplicate';
  end if;
  update rsvps set name = btrim(p_name), email = lower(btrim(p_email)), photo = p_photo
  where rsvps.id = p_id and rsvps.token = p_token;
  return found;
end;
$$;

create or replace function public.cancel_rsvp(p_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from rsvps where rsvps.id = p_id and rsvps.token = p_token;
  return found;
end;
$$;

revoke execute on function public.guest_list(), public.rsvp(text, text, text),
  public.update_rsvp(uuid, uuid, text, text, text), public.cancel_rsvp(uuid, uuid) from public;
grant execute on function public.guest_list(), public.rsvp(text, text, text),
  public.update_rsvp(uuid, uuid, text, text, text), public.cancel_rsvp(uuid, uuid) to anon, authenticated;
