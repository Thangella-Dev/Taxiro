-- Repair single-device account session claiming so stale/invalid browser sessions do not cause RPC loops.
-- Additive/compatible: recreates functions and policies, keeps existing account_sessions rows.

create table if not exists public.account_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 20 and 200),
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.account_sessions enable row level security;

drop policy if exists "account owners read active device" on public.account_sessions;

create policy "account owners read active device"
on public.account_sessions for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create or replace function public.claim_account_session(p_device_id text)
returns public.account_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.account_sessions;
  clean_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if clean_device_id is null or char_length(clean_device_id) not between 20 and 200 then
    raise exception 'Invalid device identifier' using errcode = '22023';
  end if;

  insert into public.account_sessions (profile_id, device_id, claimed_at, last_seen_at)
  values (auth.uid(), clean_device_id, now(), now())
  on conflict (profile_id) do update
  set device_id = excluded.device_id,
      claimed_at = now(),
      last_seen_at = now()
  returning * into claimed;

  return claimed;
end;
$$;

create or replace function public.touch_account_session(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if clean_device_id is null then
    return false;
  end if;

  update public.account_sessions
  set last_seen_at = now()
  where profile_id = auth.uid()
    and device_id = clean_device_id;

  return found;
end;
$$;

grant usage on schema public to authenticated;
grant select on public.account_sessions to authenticated;
grant execute on function public.claim_account_session(text) to authenticated;
grant execute on function public.touch_account_session(text) to authenticated;

notify pgrst, 'reload schema';