-- Taxiro ride-action repair and verified multi-vehicle support.
-- Additive only: preserves existing users, rides, and legacy rider profile fields.

alter table public.ride_status_events
  add column if not exists actor_id uuid references public.profiles(id) on delete set null;

create index if not exists ride_status_events_actor_idx
  on public.ride_status_events(actor_id);

alter table public.ride_requests
  add column if not exists vehicle_type text not null default 'bike',
  add column if not exists vehicle_surcharge_per_km numeric(6,2) not null default 0;

alter table public.rider_profiles
  add column if not exists active_vehicle_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_vehicle_type_check'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_vehicle_type_check
      check (vehicle_type in ('bike', 'auto', 'car'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_vehicle_surcharge_check'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_vehicle_surcharge_check
      check (vehicle_surcharge_per_km in (0, 1, 2));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rider_profiles_active_vehicle_type_check'
      and conrelid = 'public.rider_profiles'::regclass
  ) then
    alter table public.rider_profiles
      add constraint rider_profiles_active_vehicle_type_check
      check (active_vehicle_type is null or active_vehicle_type in ('bike', 'auto', 'car'));
  end if;
end
$$;

create table if not exists public.rider_vehicles (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike', 'auto', 'car')),
  make text not null,
  model text not null,
  registration_number text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rider_id, vehicle_type),
  unique (registration_number)
);

create index if not exists rider_vehicles_rider_status_idx
  on public.rider_vehicles(rider_id, verification_status);

insert into public.rider_vehicles (
  rider_id,
  vehicle_type,
  make,
  model,
  registration_number,
  verification_status,
  updated_at
)
select
  rider_id,
  'bike',
  coalesce(nullif(trim(vehicle_make), ''), 'Existing vehicle'),
  coalesce(nullif(trim(vehicle_model), ''), 'Existing model'),
  coalesce(nullif(upper(regexp_replace(vehicle_number, '\s+', '', 'g')), ''), 'LEGACY' || left(replace(rider_id::text, '-', ''), 10)),
  verification_status,
  updated_at
from public.rider_profiles
where vehicle_make is not null
   or vehicle_model is not null
   or vehicle_number is not null
   or verification_status = 'verified'
on conflict (rider_id, vehicle_type) do nothing;

update public.rider_profiles as profile
set active_vehicle_type = 'bike'
where active_vehicle_type is null
  and exists (
    select 1 from public.rider_vehicles vehicle
    where vehicle.rider_id = profile.rider_id
      and vehicle.vehicle_type = 'bike'
      and vehicle.verification_status = 'verified'
  );

alter table public.rider_vehicles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rider_vehicles'
      and policyname = 'riders view own vehicles and ride users view assigned vehicle'
  ) then
    create policy "riders view own vehicles and ride users view assigned vehicle"
      on public.rider_vehicles for select to authenticated
      using (
        rider_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.ride_requests ride
          where ride.assigned_rider_id = rider_vehicles.rider_id
            and ride.user_id = auth.uid()
            and ride.vehicle_type = rider_vehicles.vehicle_type
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rider_vehicles'
      and policyname = 'riders create own vehicles'
  ) then
    create policy "riders create own vehicles"
      on public.rider_vehicles for insert to authenticated
      with check (rider_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rider_vehicles'
      and policyname = 'riders update own vehicles'
  ) then
    create policy "riders update own vehicles"
      on public.rider_vehicles for update to authenticated
      using (rider_id = auth.uid() or public.is_admin())
      with check (rider_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rider_vehicles'
      and policyname = 'admins delete rider vehicles'
  ) then
    create policy "admins delete rider vehicles"
      on public.rider_vehicles for delete to authenticated
      using (public.is_admin());
  end if;
end
$$;

create or replace function public.guard_rider_vehicle_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.registration_number := upper(regexp_replace(trim(new.registration_number), '\s+', '', 'g'));
  new.make := trim(new.make);
  new.model := trim(new.model);
  new.updated_at := now();

  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.rejection_reason := null;
    elsif new.verification_status is distinct from old.verification_status then
      raise exception 'Vehicle verification can only be changed by an admin';
    elsif new.make is distinct from old.make
       or new.model is distinct from old.model
       or new.registration_number is distinct from old.registration_number then
      new.verification_status := 'pending';
      new.rejection_reason := null;
      update public.rider_profiles
      set active_vehicle_type = null,
          updated_at = now()
      where rider_id = new.rider_id
        and active_vehicle_type = new.vehicle_type;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.verification_status = 'verified'
     and new.verification_status <> 'verified' then
    update public.rider_profiles
    set active_vehicle_type = null,
        updated_at = now()
    where rider_id = new.rider_id
      and active_vehicle_type = new.vehicle_type;

    update public.rider_locations
    set is_available = false,
        updated_at = now()
    where rider_id = new.rider_id;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'rider_vehicle_verification_guard'
      and tgrelid = 'public.rider_vehicles'::regclass
      and not tgisinternal
  ) then
    create trigger rider_vehicle_verification_guard
    before insert or update on public.rider_vehicles
    for each row execute function public.guard_rider_vehicle_verification();
  end if;
end
$$;

create or replace function public.require_verified_active_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_available and not exists (
    select 1
    from public.rider_profiles profile
    join public.rider_vehicles vehicle
      on vehicle.rider_id = profile.rider_id
     and vehicle.vehicle_type = profile.active_vehicle_type
     and vehicle.verification_status = 'verified'
    where profile.rider_id = new.rider_id
  ) then
    raise exception 'Select a verified vehicle before going online';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'rider_location_verified_vehicle_guard'
      and tgrelid = 'public.rider_locations'::regclass
      and not tgisinternal
  ) then
    create trigger rider_location_verified_vehicle_guard
    before insert or update of is_available on public.rider_locations
    for each row execute function public.require_verified_active_vehicle();
  end if;
end
$$;

create or replace function public.set_active_rider_vehicle(p_vehicle_type text)
returns public.rider_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.rider_profiles;
  normalized_type text := lower(trim(coalesce(p_vehicle_type, '')));
begin
  if not public.is_rider() then
    raise exception 'Rider account required';
  end if;

  if normalized_type not in ('bike', 'auto', 'car') then
    raise exception 'Choose Bike, Auto, or Car';
  end if;

  if exists (
    select 1 from public.ride_requests
    where assigned_rider_id = auth.uid()
      and status in ('assigned', 'started')
  ) then
    raise exception 'Vehicle cannot be switched during an active ride';
  end if;

  if not exists (
    select 1 from public.rider_vehicles
    where rider_id = auth.uid()
      and vehicle_type = normalized_type
      and verification_status = 'verified'
  ) then
    raise exception 'This vehicle is not verified for your rider account';
  end if;

  insert into public.rider_profiles (rider_id, active_vehicle_type, updated_at)
  values (auth.uid(), normalized_type, now())
  on conflict (rider_id) do update
    set active_vehicle_type = excluded.active_vehicle_type,
        updated_at = excluded.updated_at
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.accept_ready_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_ride public.ride_requests;
  active_type text;
begin
  if not public.is_rider() then
    raise exception 'Rider account required';
  end if;

  select active_vehicle_type into active_type
  from public.rider_profiles
  where rider_id = auth.uid();

  if active_type is null or not exists (
    select 1 from public.rider_vehicles
    where rider_id = auth.uid()
      and vehicle_type = active_type
      and verification_status = 'verified'
  ) then
    raise exception 'Select a verified vehicle before accepting rides';
  end if;

  if not exists (
    select 1 from public.rider_locations
    where rider_id = auth.uid()
      and is_available = true
  ) then
    raise exception 'Go online before accepting a ride';
  end if;

  update public.ride_requests
  set assigned_rider_id = auth.uid(),
      status = 'assigned',
      accepted_at = now()
  where id = p_ride_id
    and status = 'ready'
    and assigned_rider_id is null
    and vehicle_type = active_type
    and coalesce(ready_expires_at, now() + interval '1 minute') > now()
  returning * into accepted_ride;

  if accepted_ride.id is null then
    raise exception 'Ride is no longer available for your active vehicle';
  end if;

  update public.rider_locations
  set is_available = false,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'assigned', auth.uid(), 'Ride accepted with verified ' || active_type);

  return accepted_ride;
end;
$$;

create or replace function public.mark_ride_ready_and_assign(
  p_ride_id uuid,
  p_signal_minutes integer default 30
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  ready_ride public.ride_requests;
  v_minutes integer := coalesce(p_signal_minutes, 30);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_minutes not in (15, 30, 60) then
    v_minutes := 30;
  end if;

  update public.ride_requests
  set status = 'ready',
      assigned_rider_id = null,
      accepted_at = null,
      ready_at = now(),
      ready_signal_minutes = v_minutes,
      ready_expires_at = now() + make_interval(mins => v_minutes)
  where id = p_ride_id
    and user_id = auth.uid()
    and (
      status = 'scheduled'
      or (status = 'ready' and coalesce(ready_expires_at, now()) <= now())
    )
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'This ride cannot be published. Refresh and check its current status.';
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'ready', auth.uid(), 'User ready signal published for ' || v_minutes::text || ' minutes');

  return ready_ride;
end;
$$;

create or replace function public.mark_ride_ready_and_assign(p_ride_id uuid)
returns public.ride_requests
language sql
security definer
set search_path = public
as $$
  select public.mark_ride_ready_and_assign(p_ride_id, 30);
$$;

create or replace function public.cancel_ride(
  p_ride_id uuid,
  p_reason text
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_actor uuid := auth.uid();
  v_actor_kind text;
  v_previous_user_cancellations integer := 0;
  v_cancellation_fee numeric(10,2) := null;
  v_cancellation_fee_reason text := null;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_actor = v_ride.user_id then
    v_actor_kind := 'User';
  elsif v_actor = v_ride.assigned_rider_id and v_ride.status = 'assigned' then
    v_actor_kind := 'Rider';
  elsif public.is_admin() then
    v_actor_kind := 'Admin';
  else
    raise exception 'You are not allowed to cancel this ride';
  end if;

  if v_ride.status not in ('scheduled', 'ready', 'assigned') then
    raise exception 'This ride can no longer be cancelled';
  end if;

  if v_actor = v_ride.user_id and v_ride.status = 'assigned' and v_ride.assigned_rider_id is not null then
    select count(*) into v_previous_user_cancellations
    from public.ride_requests previous
    where previous.user_id = v_ride.user_id
      and previous.id <> v_ride.id
      and previous.status = 'cancelled'
      and (previous.cancelled_by is null or previous.cancelled_by = v_ride.user_id);

    if v_previous_user_cancellations >= 2 then
      v_cancellation_fee := 50.00;
      v_cancellation_fee_reason := 'User cancelled an accepted ride after 2 previous cancellations';
    end if;
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancellation_reason = nullif(trim(p_reason), ''),
      cancellation_fee = v_cancellation_fee,
      cancellation_fee_reason = v_cancellation_fee_reason,
      cancelled_at = now(),
      cancelled_by = v_actor,
      ready_expires_at = null
  where id = p_ride_id
  returning * into v_ride;

  if v_ride.assigned_rider_id is not null then
    update public.rider_locations
    set is_available = true,
        updated_at = now()
    where rider_id = v_ride.assigned_rider_id;
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (
    v_ride.id,
    'cancelled',
    v_actor,
    v_actor_kind || ' cancelled: ' || coalesce(nullif(trim(p_reason), ''), 'No reason provided') ||
      case when v_cancellation_fee is null then '' else '. Cancellation fine applied: Rs ' || v_cancellation_fee::text end
  );

  return v_ride;
end;
$$;

-- New writes and updates must satisfy these validation constraints. Existing rows are preserved.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_vehicle_surcharge_matches_type'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_vehicle_surcharge_matches_type
      check (
        (vehicle_type = 'bike' and vehicle_surcharge_per_km = 0)
        or (vehicle_type = 'auto' and vehicle_surcharge_per_km = 1)
        or (vehicle_type = 'car' and vehicle_surcharge_per_km = 2)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_vehicle_fare_valid'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_vehicle_fare_valid
      check (
        fare_estimate is null
        or distance_km is null
        or fare_rate_per_km is null
        or fare_estimate = round((distance_km::numeric) * (fare_rate_per_km + vehicle_surcharge_per_km))
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_full_name_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_valid
      check (full_name is null or (char_length(trim(full_name)) between 2 and 80 and full_name !~ '[0-9<>]')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_valid
      check (phone is null or phone ~ '^\+?[0-9]{10,15}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_emergency_phone_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_emergency_phone_valid
      check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+?[0-9]{10,15}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rider_vehicles_details_valid'
      and conrelid = 'public.rider_vehicles'::regclass
  ) then
    alter table public.rider_vehicles
      add constraint rider_vehicles_details_valid
      check (
        char_length(trim(make)) between 2 and 40
        and char_length(trim(model)) between 1 and 40
        and registration_number ~ '^[A-Z0-9-]{6,15}$'
      ) not valid;
  end if;
end
$$;

grant select, insert, update, delete on public.rider_vehicles to authenticated;
grant execute on function public.set_active_rider_vehicle(text) to authenticated;
grant execute on function public.accept_ready_ride(uuid) to authenticated;
grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;
grant execute on function public.mark_ride_ready_and_assign(uuid) to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;

comment on column public.ride_requests.vehicle_type is 'Requested vehicle category: bike, auto, or car.';
comment on column public.ride_requests.vehicle_surcharge_per_km is 'Per-kilometre surcharge above the saved standard/peak base rate: Bike 0, Auto 1, Car 2 INR.';
comment on column public.rider_profiles.active_vehicle_type is 'Rider-selected verified vehicle category currently used for matching.';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rider_vehicles'
  ) then
    alter publication supabase_realtime add table public.rider_vehicles;
  end if;
end
$$;

notify pgrst, 'reload schema';