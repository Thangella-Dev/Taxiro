-- Complete ride execution flow with private user confirmation codes.
-- Additive migration only; no tables or rows are deleted.

alter table public.ride_requests
  add column if not exists accepted_at timestamp with time zone,
  add column if not exists started_at timestamp with time zone,
  add column if not exists completed_at timestamp with time zone;

create table if not exists public.ride_confirmation_codes (
  ride_id uuid primary key references public.ride_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  used_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.ride_confirmation_codes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ride_confirmation_codes'
      and policyname = 'users view own ride codes'
  ) then
    create policy "users view own ride codes"
    on public.ride_confirmation_codes for select
    using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;

create or replace function public.create_ride_confirmation_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ride_confirmation_codes (ride_id, user_id, code)
  values (
    new.id,
    new.user_id,
    lpad(floor(random() * 10000)::integer::text, 4, '0')
  )
  on conflict (ride_id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_ride_created_confirmation_code'
  ) then
    create trigger on_ride_created_confirmation_code
    after insert on public.ride_requests
    for each row execute function public.create_ride_confirmation_code();
  end if;
end $$;

insert into public.ride_confirmation_codes (ride_id, user_id, code)
select
  rr.id,
  rr.user_id,
  lpad(floor(random() * 10000)::integer::text, 4, '0')
from public.ride_requests rr
left join public.ride_confirmation_codes rc on rc.ride_id = rr.id
where rc.ride_id is null
on conflict (ride_id) do nothing;

create or replace function public.accept_ready_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_ride public.ride_requests;
begin
  if not public.is_rider() then
    raise exception 'Rider account required';
  end if;

  update public.ride_requests
  set assigned_rider_id = auth.uid(),
      status = 'assigned',
      accepted_at = now()
  where id = p_ride_id
    and status = 'ready'
    and assigned_rider_id is null
  returning * into accepted_ride;

  if accepted_ride.id is null then
    raise exception 'Ride is no longer available';
  end if;

  update public.rider_locations
  set is_available = false,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'assigned', 'Ride accepted by rider');

  return accepted_ride;
end;
$$;

create or replace function public.verify_ride_code(
  p_ride_id uuid,
  p_code text
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  verified_ride public.ride_requests;
begin
  if not public.is_rider() then
    raise exception 'Rider account required';
  end if;

  if not exists (
    select 1
    from public.ride_confirmation_codes rc
    join public.ride_requests rr on rr.id = rc.ride_id
    where rc.ride_id = p_ride_id
      and rc.code = p_code
      and rc.used_at is null
      and rr.assigned_rider_id = auth.uid()
      and rr.status = 'assigned'
  ) then
    raise exception 'Invalid or already used confirmation code';
  end if;

  update public.ride_confirmation_codes
  set used_at = now()
  where ride_id = p_ride_id;

  update public.ride_requests
  set status = 'started',
      started_at = now()
  where id = p_ride_id
  returning * into verified_ride;

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'started', 'User confirmation code verified');

  return verified_ride;
end;
$$;

create or replace function public.complete_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  finished_ride public.ride_requests;
begin
  update public.ride_requests
  set status = 'completed',
      completed_at = now()
  where id = p_ride_id
    and assigned_rider_id = auth.uid()
    and status = 'started'
  returning * into finished_ride;

  if finished_ride.id is null then
    raise exception 'Only the assigned rider can complete a started ride';
  end if;

  update public.rider_locations
  set is_available = true,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'completed', 'Ride completed');

  return finished_ride;
end;
$$;

alter policy "rider locations visible to authenticated users"
on public.rider_locations
using (
  public.is_rider()
  or public.is_admin()
  or exists (
    select 1
    from public.ride_requests rr
    where rr.user_id = auth.uid()
      and rr.assigned_rider_id = rider_locations.rider_id
      and rr.status in ('assigned', 'started')
  )
);
