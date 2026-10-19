-- JK44 Cinema Night RSVP: run once in Supabase → SQL Editor.
-- Guests never touch the table directly; the page calls the functions below.

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  photo      text not null check (char_length(photo) < 120000 and photo like 'data:image/jpeg;base64,%'),
  token      uuid not null default gen_random_uuid(),  -- lets the guest's own device edit or cancel
  created_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;  -- no policies: no direct access from the page
revoke all on public.rsvps from anon, authenticated;

-- Public guest list (never exposes tokens)
create or replace function public.guest_list()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'name', r.name, 'photo', r.photo, 'created_at', r.created_at)
                           order by r.created_at, r.id), '[]'::json)
  from rsvps r;
$$;

-- Save a seat. Serialised with a lock so the list can never pass 150.
create or replace function public.rsvp(p_name text, p_photo text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token uuid;
begin
  perform pg_advisory_xact_lock(4444150);
  if (select count(*) from rsvps) >= 150 then
    raise exception 'full';
  end if;
  insert into rsvps (name, photo) values (btrim(p_name), p_photo)
  returning rsvps.id, rsvps.token into v_id, v_token;
  return json_build_object('id', v_id, 'token', v_token);
end;
$$;

create or replace function public.update_rsvp(p_id uuid, p_token uuid, p_name text, p_photo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update rsvps set name = btrim(p_name), photo = p_photo where rsvps.id = p_id and rsvps.token = p_token;
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

grant execute on function public.guest_list(), public.rsvp(text, text),
  public.update_rsvp(uuid, uuid, text, text), public.cancel_rsvp(uuid, uuid) to anon;
