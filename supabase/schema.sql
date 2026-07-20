-- Taxiro core schema.
-- Safe to run on an existing Supabase project: creates missing objects only,
-- enables RLS, and does not drop existing tables.

create extension if not exists postgis;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'rider', 'admin')),
  full_name text,
  phone text,
  created_at timestamp with time zone default now()
);

create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_address text not null,
  drop_lat double precision not null,
  drop_lng double precision not null,
  drop_address text not null,
  scheduled_time timestamp with time zone not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'ready', 'assigned', 'started', 'completed', 'cancelled')
  ),
  assigned_rider_id uuid references public.profiles(id),
  distance_km double precision,
  estimated_duration_min integer,
  created_at timestamp with time zone default now()
);

create table if not exists public.rider_locations (
  rider_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  is_available boolean not null default false,
  updated_at timestamp with time zone default now()
);

create table if not exists public.rider_routes (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  from_lat double precision not null,
  from_lng double precision not null,
  from_address text not null,
  to_lat double precision not null,
  to_lng double precision not null,
  to_address text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text not null default 'active' check (status in ('active', 'expired', 'completed')),
  route_polyline text,
  created_at timestamp with time zone default now()
);

create table if not exists public.ride_status_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamp with time zone default now()
);

create index if not exists ride_requests_status_idx on public.ride_requests(status);
create index if not exists ride_requests_user_idx on public.ride_requests(user_id);
create index if not exists ride_requests_assigned_rider_idx on public.ride_requests(assigned_rider_id);
create index if not exists rider_locations_available_idx on public.rider_locations(is_available);
create index if not exists rider_routes_status_idx on public.rider_routes(status);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_rider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'rider'
  );
$$;

create or replace function public.find_nearest_available_rider(
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_radius_km double precision default 2
)
returns table (rider_id uuid, distance_km double precision)
language sql
stable
security definer
set search_path = public
as $$
  select
    rl.rider_id,
    st_distance(
      st_setsrid(st_makepoint(rl.lng, rl.lat), 4326)::geography,
      st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography
    ) / 1000 as distance_km
  from public.rider_locations rl
  join public.profiles p on p.id = rl.rider_id and p.role = 'rider'
  where rl.is_available = true
    and st_dwithin(
      st_setsrid(st_makepoint(rl.lng, rl.lat), 4326)::geography,
      st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography,
      p_radius_km * 1000
    )
  order by distance_km asc
  limit 1;
$$;

create or replace function public.mark_ride_ready_and_assign(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ride public.ride_requests;
  matched_rider uuid;
  updated_ride public.ride_requests;
begin
  select *
  into target_ride
  from public.ride_requests
  where id = p_ride_id
    and (user_id = auth.uid() or public.is_admin());

  if target_ride.id is null then
    raise exception 'Ride not found or not allowed';
  end if;

  update public.ride_requests
  set status = 'ready'
  where id = p_ride_id;

  select rider_id
  into matched_rider
  from public.find_nearest_available_rider(
    target_ride.pickup_lat,
    target_ride.pickup_lng,
    2
  );

  if matched_rider is not null then
    update public.ride_requests
    set assigned_rider_id = matched_rider,
        status = 'assigned'
    where id = p_ride_id
    returning * into updated_ride;

    update public.rider_locations
    set is_available = false,
        updated_at = now()
    where rider_id = matched_rider;
  else
    select * into updated_ride from public.ride_requests where id = p_ride_id;
  end if;

  insert into public.ride_status_events (ride_id, status, note)
  values (
    p_ride_id,
    updated_ride.status,
    case
      when matched_rider is null then 'No rider within 2 km'
      else 'Nearest rider assigned'
    end
  );

  return updated_ride;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'role' in ('user', 'rider')
        then new.raw_user_meta_data->>'role'
      else 'user'
    end,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update
  set role = excluded.role,
      full_name = excluded.full_name,
      phone = excluded.phone;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.ride_requests enable row level security;
alter table public.rider_locations enable row level security;
alter table public.rider_routes enable row level security;
alter table public.ride_status_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles select own or admin'
  ) then
    create policy "profiles select own or admin"
    on public.profiles for select
    using (id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles insert own'
  ) then
    create policy "profiles insert own"
    on public.profiles for insert
    with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles update own or admin'
  ) then
    create policy "profiles update own or admin"
    on public.profiles for update
    using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ride_requests' and policyname = 'users view own rides riders view assigned or ready admins all'
  ) then
    create policy "users view own rides riders view assigned or ready admins all"
    on public.ride_requests for select
    using (
      user_id = auth.uid()
      or assigned_rider_id = auth.uid()
      or (status in ('scheduled', 'ready') and public.is_rider())
      or public.is_admin()
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ride_requests' and policyname = 'users create own rides'
  ) then
    create policy "users create own rides"
    on public.ride_requests for insert
    with check (user_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ride_requests' and policyname = 'users riders admins update allowed rides'
  ) then
    create policy "users riders admins update allowed rides"
    on public.ride_requests for update
    using (
      user_id = auth.uid()
      or assigned_rider_id = auth.uid()
      or (status = 'ready' and public.is_rider())
      or public.is_admin()
    )
    with check (
      user_id = auth.uid()
      or assigned_rider_id = auth.uid()
      or public.is_admin()
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_locations' and policyname = 'rider locations visible to authenticated users'
  ) then
    create policy "rider locations visible to authenticated users"
    on public.rider_locations for select
    using (auth.role() = 'authenticated' and (public.is_rider() or public.is_admin()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_locations' and policyname = 'riders insert own location'
  ) then
    create policy "riders insert own location"
    on public.rider_locations for insert
    with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_locations' and policyname = 'riders update own location'
  ) then
    create policy "riders update own location"
    on public.rider_locations for update
    using ((rider_id = auth.uid() and public.is_rider()) or public.is_admin())
    with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_routes' and policyname = 'rider routes readable'
  ) then
    create policy "rider routes readable"
    on public.rider_routes for select
    using (auth.role() = 'authenticated' and (public.is_rider() or public.is_admin()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_routes' and policyname = 'riders create own routes'
  ) then
    create policy "riders create own routes"
    on public.rider_routes for insert
    with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rider_routes' and policyname = 'riders update own routes'
  ) then
    create policy "riders update own routes"
    on public.rider_routes for update
    using ((rider_id = auth.uid() and public.is_rider()) or public.is_admin())
    with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ride_status_events' and policyname = 'ride events visible to related parties'
  ) then
    create policy "ride events visible to related parties"
    on public.ride_status_events for select
    using (
      exists (
        select 1 from public.ride_requests rr
        where rr.id = ride_id
          and (
            rr.user_id = auth.uid()
            or rr.assigned_rider_id = auth.uid()
            or public.is_admin()
          )
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ride_status_events' and policyname = 'ride events insert related parties'
  ) then
    create policy "ride events insert related parties"
    on public.ride_status_events for insert
    with check (
      exists (
        select 1 from public.ride_requests rr
        where rr.id = ride_id
          and (
            rr.user_id = auth.uid()
            or rr.assigned_rider_id = auth.uid()
            or public.is_admin()
          )
      )
    );
  end if;
end $$;
-- Let riders see scheduled demand and ready rides.
-- This changes read visibility only; it does not delete tables or data.

alter policy "users view own rides riders view assigned or ready admins all"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or status in ('scheduled', 'ready')
  or public.is_admin()
);
-- Tighten rider-only operations.
-- No data is deleted; this only changes authorization rules.

create or replace function public.is_rider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'rider'
  );
$$;

alter policy "users view own rides riders view assigned or ready admins all"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or (status in ('scheduled', 'ready') and public.is_rider())
  or public.is_admin()
);

alter policy "users riders admins update allowed rides"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or (status = 'ready' and public.is_rider())
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or public.is_admin()
);

alter policy "rider locations visible to authenticated users"
on public.rider_locations
using (auth.role() = 'authenticated' and (public.is_rider() or public.is_admin()));

alter policy "riders insert own location"
on public.rider_locations
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());

alter policy "riders update own location"
on public.rider_locations
using ((rider_id = auth.uid() and public.is_rider()) or public.is_admin())
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());

alter policy "rider routes readable"
on public.rider_routes
using (auth.role() = 'authenticated' and (public.is_rider() or public.is_admin()));

alter policy "riders create own routes"
on public.rider_routes
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());

alter policy "riders update own routes"
on public.rider_routes
using ((rider_id = auth.uid() and public.is_rider()) or public.is_admin())
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());
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
-- Use an explicit rider acceptance step.
-- "I'm Ready" publishes the request; accept_ready_ride assigns it atomically.

create or replace function public.mark_ride_ready_and_assign(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  ready_ride public.ride_requests;
begin
  update public.ride_requests
  set status = 'ready',
      assigned_rider_id = null,
      accepted_at = null
  where id = p_ride_id
    and user_id = auth.uid()
    and status = 'scheduled'
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'Only the booking user can mark a scheduled ride ready';
  end if;

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'ready', 'User is ready for rider offers');

  return ready_ride;
end;
$$;
-- Enable Supabase Realtime for live ride, rider, code, and chat updates.
do $$
declare
  v_table_name text;
  table_names text[] := array[
    'profiles',
    'ride_requests',
    'rider_locations',
    'rider_routes',
    'ride_status_events',
    'ride_confirmation_codes',
    'ride_chat_messages',
    'rider_profiles',
    'ride_ratings'
  ];
begin
  foreach v_table_name in array table_names loop
    execute format('alter table public.%I replica identity full', v_table_name);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end $$;

-- Taxiro fare split, rider UPI QR, and payment confirmation flow.
-- Additive only; preserves existing ride and rider data.

alter table public.ride_requests
  add column if not exists company_commission numeric(10,2),
  add column if not exists rider_earning numeric(10,2),
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_payment_status_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_payment_status_check
      check (payment_status in ('pending', 'awaiting_payment', 'paid'));
  end if;
end
$$;

update public.ride_requests
set company_commission = round((fare_estimate * 0.07)::numeric, 2),
    rider_earning = round((fare_estimate - (fare_estimate * 0.07))::numeric, 2)
where fare_estimate is not null
  and (company_commission is null or rider_earning is null);

update public.ride_requests
set payment_status = case
  when status = 'completed' then 'paid'
  else payment_status
end,
payment_confirmed_at = case
  when status = 'completed' and payment_confirmed_at is null then completed_at
  else payment_confirmed_at
end
where status = 'completed';

alter table public.rider_profiles
  add column if not exists upi_id text,
  add column if not exists upi_qr_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rider-upi-qr',
  'rider-upi-qr',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rider upi qr public read'
  ) then
    create policy "rider upi qr public read"
    on storage.objects for select
    using (bucket_id = 'rider-upi-qr');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'riders upload own upi qr'
  ) then
    create policy "riders upload own upi qr"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'riders update own upi qr'
  ) then
    create policy "riders update own upi qr"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    )
    with check (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    );
  end if;
end
$$;

create or replace function public.mark_ride_reached_drop(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
begin
  update public.ride_requests
  set payment_status = 'awaiting_payment'
  where id = p_ride_id
    and assigned_rider_id = auth.uid()
    and status = 'started'
    and payment_status in ('pending', 'awaiting_payment')
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Only the assigned rider can mark a started ride as reached drop';
  end if;

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'awaiting_payment', 'Rider reached drop and is collecting payment');

  return v_ride;
end;
$$;

create or replace function public.confirm_ride_payment_and_complete(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
begin
  update public.ride_requests
  set payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_confirmed_by = auth.uid(),
      status = 'completed',
      completed_at = now()
  where id = p_ride_id
    and assigned_rider_id = auth.uid()
    and status = 'started'
    and payment_status = 'awaiting_payment'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Payment must be awaiting confirmation before completing the ride';
  end if;

  update public.rider_locations
  set is_available = true,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'completed', 'Payment confirmed by rider and ride completed');

  return v_ride;
end;
$$;

create or replace function public.complete_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.confirm_ride_payment_and_complete(p_ride_id);
end;
$$;

grant execute on function public.mark_ride_reached_drop(uuid) to authenticated;
grant execute on function public.confirm_ride_payment_and_complete(uuid) to authenticated;
grant execute on function public.complete_ride(uuid) to authenticated;
-- Taxiro accepted-ride user cancellation fine.
-- Additive only; preserves existing ride data.

alter table public.ride_requests
  add column if not exists cancellation_fee numeric(10,2),
  add column if not exists cancellation_fee_reason text,
  add column if not exists cancelled_by uuid references public.profiles(id);

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
  v_previous_user_cancellations integer := 0;
  v_cancellation_fee numeric(10,2) := null;
  v_cancellation_fee_reason text := null;
begin
  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_actor <> v_ride.user_id
     and v_actor <> v_ride.assigned_rider_id
     and not public.is_admin() then
    raise exception 'Not allowed to cancel this ride';
  end if;

  if v_ride.status not in ('scheduled', 'ready', 'assigned') then
    raise exception 'This ride can no longer be cancelled';
  end if;

  if v_actor = v_ride.user_id and v_ride.status = 'assigned' and v_ride.assigned_rider_id is not null then
    select count(*) into v_previous_user_cancellations
    from public.ride_requests rr
    where rr.user_id = v_ride.user_id
      and rr.id <> v_ride.id
      and rr.status = 'cancelled'
      and (rr.cancelled_by is null or rr.cancelled_by = v_ride.user_id);

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
      cancelled_by = v_actor
  where id = p_ride_id
  returning * into v_ride;

  if v_ride.assigned_rider_id is not null then
    update public.rider_locations
    set is_available = true, updated_at = now()
    where rider_id = v_ride.assigned_rider_id;
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (
    v_ride.id,
    'cancelled',
    v_actor,
    case
      when v_cancellation_fee is null then null
      else 'Cancellation fine applied: Rs ' || v_cancellation_fee::text
    end
  );

  return v_ride;
end;
$$;

grant execute on function public.cancel_ride(uuid, text) to authenticated;

-- Taxiro signal expiry and safety alerts.
-- Additive only; preserves all existing ride and profile data.

alter table public.ride_requests
  add column if not exists ready_at timestamptz,
  add column if not exists ready_expires_at timestamptz,
  add column if not exists ready_signal_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_ready_signal_minutes_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_ready_signal_minutes_check
      check (ready_signal_minutes in (15, 30, 60));
  end if;
end
$$;

create index if not exists ride_requests_ready_expiry_idx
  on public.ride_requests(status, ready_expires_at);

create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  triggered_by uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  alert_type text not null check (alert_type in ('sos', 'late_trip', 'route_changed')),
  message text not null,
  lat double precision,
  lng double precision,
  accuracy_m numeric,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  related_ride_id uuid references public.ride_requests(id) on delete cascade,
  safety_alert_id uuid references public.safety_alerts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists safety_alerts_ride_type_created_idx
  on public.safety_alerts(ride_id, alert_type, created_at desc);

create index if not exists safety_alerts_recipient_idx
  on public.safety_alerts(recipient_profile_id, status, created_at desc);

create index if not exists app_notifications_profile_idx
  on public.app_notifications(profile_id, read_at, created_at desc);

alter table public.safety_alerts enable row level security;
alter table public.app_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_alerts'
      and policyname = 'safety alerts visible to related users'
  ) then
    create policy "safety alerts visible to related users"
      on public.safety_alerts for select to authenticated
      using (
        triggered_by = auth.uid()
        or recipient_profile_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.ride_requests rr
          where rr.id = ride_id
            and (rr.user_id = auth.uid() or rr.assigned_rider_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_alerts'
      and policyname = 'safety alerts insert by ride user'
  ) then
    create policy "safety alerts insert by ride user"
      on public.safety_alerts for insert to authenticated
      with check (
        triggered_by = auth.uid()
        and exists (
          select 1 from public.ride_requests rr
          where rr.id = ride_id
            and rr.user_id = auth.uid()
            and rr.status in ('assigned', 'started')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'users view own notifications'
  ) then
    create policy "users view own notifications"
      on public.app_notifications for select to authenticated
      using (profile_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'users update own notifications'
  ) then
    create policy "users update own notifications"
      on public.app_notifications for update to authenticated
      using (profile_id = auth.uid() or public.is_admin())
      with check (profile_id = auth.uid() or public.is_admin());
  end if;
end
$$;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
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
      or (status = 'ready' and ready_expires_at is not null and ready_expires_at <= now())
    )
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'Only the booking user can mark a scheduled ride ready';
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'ready', auth.uid(), 'User signal visible for ' || v_minutes::text || ' minutes');

  return ready_ride;
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
    and coalesce(ready_expires_at, now() + interval '1 minute') > now()
  returning * into accepted_ride;

  if accepted_ride.id is null then
    raise exception 'Ride is no longer available';
  end if;

  update public.rider_locations
  set is_available = false,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'assigned', auth.uid(), 'Ride accepted by rider');

  return accepted_ride;
end;
$$;

create or replace function public.expire_ready_signals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  with expired as (
    update public.ride_requests
    set status = 'scheduled',
        assigned_rider_id = null,
        accepted_at = null,
        ready_at = null,
        ready_expires_at = null
    where status = 'ready'
      and ready_expires_at is not null
      and ready_expires_at <= now()
    returning id
  ),
  events as (
    insert into public.ride_status_events (ride_id, status, note)
    select id, 'scheduled', 'Ready signal expired before rider acceptance'
    from expired
    returning ride_id
  )
  select count(*) into expired_count from events;

  return expired_count;
end;
$$;

create or replace function public.create_safety_alert(
  p_ride_id uuid,
  p_alert_type text,
  p_message text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m numeric default null
)
returns public.safety_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_profile public.profiles;
  v_recipient uuid;
  v_alert public.safety_alerts;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if p_alert_type not in ('sos', 'late_trip', 'route_changed') then
    raise exception 'Unsupported safety alert type';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.user_id <> auth.uid() then
    raise exception 'Only the booking user can trigger a safety alert';
  end if;

  if v_ride.status not in ('assigned', 'started') then
    raise exception 'Safety alerts are available after rider assignment';
  end if;

  if exists (
    select 1
    from public.safety_alerts sa
    where sa.ride_id = p_ride_id
      and sa.alert_type = p_alert_type
      and sa.created_at > now() - interval '30 minutes'
  ) then
    select * into v_alert
    from public.safety_alerts sa
    where sa.ride_id = p_ride_id
      and sa.alert_type = p_alert_type
      and sa.created_at > now() - interval '30 minutes'
    order by sa.created_at desc
    limit 1;
    return v_alert;
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  select p.id into v_recipient
  from public.profiles p
  where public.normalize_phone(p.phone) = public.normalize_phone(v_profile.emergency_contact_phone)
    and p.id <> auth.uid()
  order by p.created_at desc
  limit 1;

  insert into public.safety_alerts (
    ride_id,
    triggered_by,
    recipient_profile_id,
    alert_type,
    message,
    lat,
    lng,
    accuracy_m
  )
  values (
    p_ride_id,
    auth.uid(),
    v_recipient,
    p_alert_type,
    coalesce(v_message, 'Taxiro safety alert triggered during ride'),
    p_lat,
    p_lng,
    p_accuracy_m
  )
  returning * into v_alert;

  if v_recipient is not null then
    insert into public.app_notifications (
      profile_id,
      title,
      body,
      related_ride_id,
      safety_alert_id
    )
    values (
      v_recipient,
      case
        when p_alert_type = 'sos' then 'Taxiro SOS alert'
        when p_alert_type = 'late_trip' then 'Taxiro trip delay alert'
        else 'Taxiro route change alert'
      end,
      coalesce(v_profile.full_name, 'Your emergency contact') || ' may need help during a Taxiro ride. ' || coalesce(v_message, ''),
      p_ride_id,
      v_alert.id
    );
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, v_ride.status, auth.uid(), 'Safety alert created: ' || p_alert_type);

  return v_alert;
end;
$$;

grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;
grant execute on function public.mark_ride_ready_and_assign(uuid) to authenticated;
grant execute on function public.accept_ready_ride(uuid) to authenticated;
grant execute on function public.expire_ready_signals() to authenticated;
grant execute on function public.create_safety_alert(uuid, text, text, double precision, double precision, numeric) to authenticated;

do $$
declare
  v_table_name text;
  table_names text[] := array['safety_alerts', 'app_notifications'];
begin
  foreach v_table_name in array table_names loop
    execute format('alter table public.%I replica identity full', v_table_name);
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end
$$;


-- Taxiro distance pricing and passenger booking details.
-- Additive only: existing rides and policies remain unchanged.

alter table public.ride_requests
  add column if not exists fare_rate_per_km numeric(6,2),
  add column if not exists fare_pricing_period text,
  add column if not exists booking_for text not null default 'self',
  add column if not exists passenger_name text,
  add column if not exists passenger_phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_fare_pricing_period_check'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_fare_pricing_period_check
      check (fare_pricing_period is null or fare_pricing_period in ('standard', 'morning_peak', 'evening_peak', 'night_peak'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_booking_for_check'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_booking_for_check
      check (booking_for in ('self', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ride_requests_fare_rate_per_km_check'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_fare_rate_per_km_check
      check (fare_rate_per_km is null or fare_rate_per_km in (7, 8));
  end if;
end
$$;

update public.ride_requests as ride
set passenger_name = profile.full_name,
    passenger_phone = profile.phone
from public.profiles as profile
where ride.user_id = profile.id
  and ride.booking_for = 'self'
  and (ride.passenger_name is null or ride.passenger_phone is null);

comment on column public.ride_requests.fare_rate_per_km is
  'Distance rate saved at booking: INR 7 standard or INR 8 during configured India peak windows.';
comment on column public.ride_requests.fare_pricing_period is
  'Pricing period saved at booking: standard, morning_peak, evening_peak, or night_peak.';
comment on column public.ride_requests.booking_for is
  'Whether the signed-in customer booked for self or another passenger.';
comment on column public.ride_requests.passenger_name is
  'Name of the person the rider should pick up.';
comment on column public.ride_requests.passenger_phone is
  'Passenger contact number supplied for this ride.';


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

-- Private rider live-photo capture and admin-gated identity/vehicle verification.

alter table public.rider_profiles
  add column if not exists live_selfie_path text,
  add column if not exists live_selfie_captured_at timestamptz,
  add column if not exists identity_rejection_reason text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rider-verification', 'rider-verification', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders and admins read verification images') then
    create policy "riders and admins read verification images" on storage.objects for select to authenticated
      using (bucket_id='rider-verification' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders upload own verification images') then
    create policy "riders upload own verification images" on storage.objects for insert to authenticated
      with check (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders update own verification images') then
    create policy "riders update own verification images" on storage.objects for update to authenticated
      using (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider())
      with check (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider());
  end if;
end $$;

create or replace function public.guard_rider_identity_verification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    if tg_op='INSERT' then
      new.verification_status := 'pending';
      new.identity_rejection_reason := null;
    elsif new.verification_status is distinct from old.verification_status
       or new.identity_rejection_reason is distinct from old.identity_rejection_reason then
      raise exception 'Identity verification can only be changed by an admin';
    elsif new.live_selfie_path is distinct from old.live_selfie_path then
      new.verification_status := 'pending';
      new.identity_rejection_reason := null;
      new.live_selfie_captured_at := coalesce(new.live_selfie_captured_at, now());
      new.active_vehicle_type := null;
      update public.rider_locations set is_available=false, updated_at=now() where rider_id=new.rider_id;
    end if;
  end if;
  if new.verification_status='verified' and new.live_selfie_path is null then
    raise exception 'A live rider photo is required before identity approval';
  end if;
  if new.verification_status<>'verified' then new.active_vehicle_type := null; end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='rider_identity_verification_guard' and tgrelid='public.rider_profiles'::regclass) then
    create trigger rider_identity_verification_guard before insert or update on public.rider_profiles
      for each row execute function public.guard_rider_identity_verification();
  end if;
end $$;

create or replace function public.require_identity_before_vehicle_verification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.verification_status='verified'
     and (tg_op='INSERT' or old.verification_status is distinct from 'verified')
     and not exists (
       select 1 from public.rider_profiles p where p.rider_id=new.rider_id
       and p.verification_status='verified' and p.live_selfie_path is not null
     ) then
    raise exception 'Approve the rider live identity photo before verifying a vehicle';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='vehicle_requires_verified_identity' and tgrelid='public.rider_vehicles'::regclass) then
    create trigger vehicle_requires_verified_identity before insert or update on public.rider_vehicles
      for each row execute function public.require_identity_before_vehicle_verification();
  end if;
end $$;

comment on column public.rider_profiles.live_selfie_path is 'Private rider live identity capture reviewed by admins.';
notify pgrst, 'reload schema';

-- One active browser/device per Taxiro account.
-- A new authenticated login replaces the previous device claim.

create table if not exists public.account_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 20 and 200),
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.account_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'account_sessions'
      and policyname = 'account owners read active device'
  ) then
    create policy "account owners read active device"
      on public.account_sessions for select to authenticated
      using (profile_id = auth.uid() or public.is_admin());
  end if;
end $$;

create or replace function public.claim_account_session(p_device_id text)
returns public.account_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.account_sessions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_device_id is null or char_length(trim(p_device_id)) not between 20 and 200 then
    raise exception 'Invalid device identifier';
  end if;

  insert into public.account_sessions (profile_id, device_id, claimed_at, last_seen_at)
  values (auth.uid(), trim(p_device_id), now(), now())
  on conflict (profile_id) do update
  set device_id = excluded.device_id,
      claimed_at = now(),
      last_seen_at = now()
  returning * into claimed;

  return claimed;
end $$;

create or replace function public.touch_account_session(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.account_sessions
  set last_seen_at = now()
  where profile_id = auth.uid() and device_id = trim(p_device_id);
  return found;
end $$;

grant select on public.account_sessions to authenticated;
grant execute on function public.claim_account_session(text) to authenticated;
grant execute on function public.touch_account_session(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'account_sessions'
  ) then
    alter publication supabase_realtime add table public.account_sessions;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Repair vehicle-specific ready and scheduled signal delivery.

create or replace function public.activate_first_verified_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'verified' then
    update public.rider_profiles profile
    set active_vehicle_type = new.vehicle_type,
        updated_at = now()
    where profile.rider_id = new.rider_id
      and profile.verification_status = 'verified'
      and profile.active_vehicle_type is null;
  end if;
  return new;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'activate_first_verified_vehicle'
      and tgrelid = 'public.rider_vehicles'::regclass
  ) then
    create trigger activate_first_verified_vehicle
      after insert or update of verification_status on public.rider_vehicles
      for each row execute function public.activate_first_verified_vehicle();
  end if;
end $$;

create or replace function public.activate_vehicle_after_identity_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_verified text;
begin
  if new.verification_status = 'verified' and new.active_vehicle_type is null then
    select vehicle_type into first_verified
    from public.rider_vehicles
    where rider_id = new.rider_id and verification_status = 'verified'
    order by case vehicle_type when 'bike' then 1 when 'auto' then 2 else 3 end
    limit 1;

    if first_verified is not null then
      update public.rider_profiles
      set active_vehicle_type = first_verified, updated_at = now()
      where rider_id = new.rider_id and active_vehicle_type is null;
    end if;
  end if;
  return new;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'activate_vehicle_after_identity_approval'
      and tgrelid = 'public.rider_profiles'::regclass
  ) then
    create trigger activate_vehicle_after_identity_approval
      after update of verification_status on public.rider_profiles
      for each row execute function public.activate_vehicle_after_identity_approval();
  end if;
end $$;

update public.rider_profiles profile
set active_vehicle_type = (
      select vehicle.vehicle_type
      from public.rider_vehicles vehicle
      where vehicle.rider_id = profile.rider_id
        and vehicle.verification_status = 'verified'
      order by case vehicle.vehicle_type when 'bike' then 1 when 'auto' then 2 else 3 end
      limit 1
    ),
    updated_at = now()
where profile.active_vehicle_type is null
  and profile.verification_status = 'verified'
  and exists (
    select 1 from public.rider_vehicles vehicle
    where vehicle.rider_id = profile.rider_id
      and vehicle.verification_status = 'verified'
  );

alter policy "users view own rides riders view assigned or ready admins all"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or public.is_admin()
  or (
    status in ('scheduled', 'ready')
    and public.is_rider()
    and exists (
      select 1
      from public.rider_profiles profile
      join public.rider_vehicles vehicle
        on vehicle.rider_id = profile.rider_id
       and vehicle.vehicle_type = profile.active_vehicle_type
       and vehicle.verification_status = 'verified'
      where profile.rider_id = auth.uid()
        and profile.verification_status = 'verified'
        and profile.active_vehicle_type = ride_requests.vehicle_type
    )
  )
);

notify pgrst, 'reload schema';

-- Keep vehicle-specific signal visibility without recursive RLS policy checks.

create or replace function public.can_view_vehicle_signal(p_vehicle_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles account
    join public.rider_profiles profile on profile.rider_id = account.id
    join public.rider_vehicles vehicle
      on vehicle.rider_id = profile.rider_id
     and vehicle.vehicle_type = profile.active_vehicle_type
     and vehicle.verification_status = 'verified'
    where account.id = auth.uid()
      and account.role = 'rider'
      and profile.verification_status = 'verified'
      and profile.active_vehicle_type = p_vehicle_type
  );
$$;

revoke all on function public.can_view_vehicle_signal(text) from public;
grant execute on function public.can_view_vehicle_signal(text) to authenticated;

alter policy "users view own rides riders view assigned or ready admins all"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or public.is_admin()
  or (
    status in ('scheduled', 'ready')
    and public.can_view_vehicle_signal(vehicle_type)
  )
);

notify pgrst, 'reload schema';

-- Secure assigned-rider identity display and explicit SOS delivery outcomes.

alter table public.safety_alerts
  add column if not exists recipient_phone text,
  add column if not exists delivery_status text not null default 'unlinked';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_alerts_delivery_status_check'
      and conrelid = 'public.safety_alerts'::regclass
  ) then
    alter table public.safety_alerts
      add constraint safety_alerts_delivery_status_check
      check (delivery_status in ('no_contact', 'unlinked', 'in_app'));
  end if;
end $$;

create or replace function public.can_view_assigned_rider_photo(p_rider_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ride_requests ride
    where ride.user_id = auth.uid()
      and ride.assigned_rider_id::text = p_rider_id
      and ride.status in ('assigned', 'started')
  );
$$;

revoke all on function public.can_view_assigned_rider_photo(text) from public;
grant execute on function public.can_view_assigned_rider_photo(text) to authenticated;

alter policy "riders and admins read verification images"
on storage.objects
using (
  bucket_id = 'rider-verification'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or public.can_view_assigned_rider_photo((storage.foldername(name))[1])
  )
);

create or replace function public.get_assigned_rider_details(p_ride_id uuid)
returns table (
  rider_id uuid,
  full_name text,
  phone text,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  registration_number text,
  rating numeric,
  completed_rides integer,
  photo_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ride.assigned_rider_id,
    account.full_name,
    account.phone,
    ride.vehicle_type,
    vehicle.make,
    vehicle.model,
    vehicle.registration_number,
    profile.rating,
    profile.completed_rides,
    profile.live_selfie_path
  from public.ride_requests ride
  join public.profiles account on account.id = ride.assigned_rider_id
  join public.rider_profiles profile on profile.rider_id = ride.assigned_rider_id
  join public.rider_vehicles vehicle
    on vehicle.rider_id = ride.assigned_rider_id
   and vehicle.vehicle_type = ride.vehicle_type
   and vehicle.verification_status = 'verified'
  where ride.id = p_ride_id
    and ride.assigned_rider_id is not null
    and (
      ride.user_id = auth.uid()
      or ride.assigned_rider_id = auth.uid()
      or public.is_admin()
    );
$$;

revoke all on function public.get_assigned_rider_details(uuid) from public;
grant execute on function public.get_assigned_rider_details(uuid) to authenticated;

create or replace function public.create_safety_alert(
  p_ride_id uuid,
  p_alert_type text,
  p_message text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m numeric default null
)
returns public.safety_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_profile public.profiles;
  v_recipient uuid;
  v_alert public.safety_alerts;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_phone text;
  v_delivery text;
begin
  if p_alert_type not in ('sos', 'late_trip', 'route_changed') then
    raise exception 'Unsupported safety alert type';
  end if;

  select * into v_ride from public.ride_requests where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'Ride not found'; end if;
  if v_ride.user_id <> auth.uid() then raise exception 'Only the booking user can trigger a safety alert'; end if;
  if v_ride.status not in ('assigned', 'started') then raise exception 'Safety alerts are available after rider assignment'; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  v_phone := public.normalize_phone(v_profile.emergency_contact_phone);

  select contact.id into v_recipient
  from public.profiles contact
  where public.normalize_phone(contact.phone) = v_phone and contact.id <> auth.uid()
  order by contact.created_at desc limit 1;

  v_delivery := case
    when v_phone is null or v_phone = '' then 'no_contact'
    when v_recipient is null then 'unlinked'
    else 'in_app'
  end;

  select * into v_alert
  from public.safety_alerts alert
  where alert.ride_id = p_ride_id and alert.alert_type = p_alert_type
    and alert.created_at > now() - interval '30 minutes'
  order by alert.created_at desc limit 1;

  if v_alert.id is null then
    insert into public.safety_alerts (
      ride_id, triggered_by, recipient_profile_id, recipient_phone,
      delivery_status, alert_type, message, lat, lng, accuracy_m
    ) values (
      p_ride_id, auth.uid(), v_recipient, nullif(v_phone, ''), v_delivery,
      p_alert_type, coalesce(v_message, 'Taxiro safety alert triggered during ride'),
      p_lat, p_lng, p_accuracy_m
    ) returning * into v_alert;
  else
    update public.safety_alerts
    set recipient_profile_id = coalesce(v_alert.recipient_profile_id, v_recipient),
        recipient_phone = nullif(v_phone, ''),
        delivery_status = case
          when coalesce(v_alert.recipient_profile_id, v_recipient) is not null then 'in_app'
          else v_delivery
        end
    where id = v_alert.id
    returning * into v_alert;
  end if;

  if v_alert.recipient_profile_id is not null and not exists (
    select 1 from public.app_notifications note where note.safety_alert_id = v_alert.id
  ) then
    insert into public.app_notifications (profile_id, title, body, related_ride_id, safety_alert_id)
    values (
      v_alert.recipient_profile_id,
      case when p_alert_type = 'sos' then 'Taxiro SOS alert'
           when p_alert_type = 'late_trip' then 'Taxiro trip delay alert'
           else 'Taxiro route change alert' end,
      coalesce(v_profile.full_name, 'Your emergency contact') || ' may need help during a Taxiro ride. ' || coalesce(v_message, ''),
      p_ride_id,
      v_alert.id
    );
  end if;

  if not exists (
    select 1 from public.ride_status_events event
    where event.ride_id = p_ride_id and event.note = 'Safety alert created: ' || p_alert_type
      and event.created_at > now() - interval '30 minutes'
  ) then
    insert into public.ride_status_events (ride_id, status, actor_id, note)
    values (p_ride_id, v_ride.status, auth.uid(), 'Safety alert created: ' || p_alert_type);
  end if;

  return v_alert;
end $$;

grant execute on function public.create_safety_alert(uuid, text, text, double precision, double precision, numeric) to authenticated;
notify pgrst, 'reload schema';

-- Notification platform, admin broadcasts, account controls, and ride lifecycle alerts.

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.app_notifications
  add column if not exists category text not null default 'system',
  add column if not exists created_by uuid references public.profiles(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_account_status_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname='app_notifications_category_check' and conrelid='public.app_notifications'::regclass) then
    alter table public.app_notifications add constraint app_notifications_category_check check (category in ('system','ride','safety','admin'));
  end if;
end $$;

create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 3 and 80),
  body text not null check (char_length(trim(body)) between 5 and 500),
  audience text not null check (audience in ('all','users','riders')),
  delivered_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.admin_broadcasts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_broadcasts' and policyname='admins manage broadcasts') then
    create policy "admins manage broadcasts" on public.admin_broadcasts for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create or replace function public.admin_send_notification(p_title text,p_body text,p_audience text default 'all')
returns public.admin_broadcasts
language plpgsql security definer set search_path=public as $$
declare
  broadcast public.admin_broadcasts;
  delivered integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_audience not in ('all','users','riders') then raise exception 'Invalid notification audience'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 80 then raise exception 'Title must be 3 to 80 characters'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 5 and 500 then raise exception 'Message must be 5 to 500 characters'; end if;

  insert into public.admin_broadcasts(created_by,title,body,audience)
  values(auth.uid(),trim(p_title),trim(p_body),p_audience) returning * into broadcast;

  insert into public.app_notifications(profile_id,title,body,category,created_by)
  select profile.id,broadcast.title,broadcast.body,'admin',auth.uid()
  from public.profiles profile
  where profile.account_status='active'
    and (p_audience='all' or (p_audience='users' and profile.role='user') or (p_audience='riders' and profile.role='rider'));
  get diagnostics delivered = row_count;

  update public.admin_broadcasts set delivered_count=delivered where id=broadcast.id returning * into broadcast;
  return broadcast;
end $$;

create or replace function public.admin_set_account_status(p_profile_id uuid,p_status text)
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare updated_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_profile_id=auth.uid() then raise exception 'Admins cannot suspend their own account'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid account status'; end if;
  update public.profiles set account_status=p_status where id=p_profile_id returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Profile not found'; end if;
  if p_status='suspended' then
    update public.rider_locations set is_available=false,updated_at=now() where rider_id=p_profile_id;
  end if;
  return updated_profile;
end $$;

create or replace function public.notify_ride_lifecycle()
returns trigger
language plpgsql security definer set search_path=public as $$
declare rider_name text;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.assigned_rider_id is not null then select full_name into rider_name from public.profiles where id=new.assigned_rider_id; end if;

  if new.status='assigned' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Rider assigned',coalesce(rider_name,'Your rider')||' accepted your '||initcap(new.vehicle_type)||' ride and is coming to pickup.',new.id,'ride');
  elsif new.status='started' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Trip started','Your ride code was verified. Live tracking now follows the destination route.',new.id,'ride');
  elsif new.status='completed' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Ride completed','Your Taxiro ride is complete. Thank you for riding with us.',new.id,'ride');
  elsif new.status='cancelled' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Ride cancelled','Ride '||left(new.id::text,8)||' was cancelled.',new.id,'ride');
    if new.assigned_rider_id is not null then
      insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
      values(new.assigned_rider_id,'Ride cancelled','Your assigned ride was cancelled and you can receive new requests.',new.id,'ride');
    end if;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='notify_ride_lifecycle' and tgrelid='public.ride_requests'::regclass) then
    create trigger notify_ride_lifecycle after update of status on public.ride_requests
      for each row execute function public.notify_ride_lifecycle();
  end if;
end $$;

create or replace function public.admin_update_safety_alert_status(p_alert_id uuid,p_status text)
returns public.safety_alerts
language plpgsql security definer set search_path=public as $$
declare updated_alert public.safety_alerts;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('open','acknowledged','resolved') then raise exception 'Invalid safety status'; end if;
  update public.safety_alerts
  set status=p_status,resolved_at=case when p_status='resolved' then now() else null end
  where id=p_alert_id returning * into updated_alert;
  if updated_alert.id is null then raise exception 'Safety alert not found'; end if;
  return updated_alert;
end $$;
create or replace function public.get_emergency_contact_link_status()
returns table(configured boolean,linked boolean)
language sql stable security definer set search_path=public as $$
  select
    profile.emergency_contact_phone is not null,
    exists (
      select 1 from public.profiles contact
      where contact.id<>profile.id
        and public.normalize_phone(contact.phone)=public.normalize_phone(profile.emergency_contact_phone)
        and contact.account_status='active'
    )
  from public.profiles profile where profile.id=auth.uid();
$$;
grant select on public.admin_broadcasts to authenticated;
grant execute on function public.admin_send_notification(text,text,text) to authenticated;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;
grant execute on function public.admin_update_safety_alert_status(uuid,text) to authenticated;
grant execute on function public.get_emergency_contact_link_status() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_broadcasts') then
    alter publication supabase_realtime add table public.admin_broadcasts;
  end if;
end $$;

notify pgrst, 'reload schema';

-- 20260701190000_emergency_contact_matching_and_notifications.sql
-- Improve emergency-contact matching and backfill SOS notification delivery.
-- Additive only: no table drops or destructive data changes.

create or replace function public.match_emergency_contact_profile(
  p_owner_id uuid,
  p_phone text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select public.normalize_phone(p_phone) as normalized_phone
  ), candidates as (
    select
      profile.id,
      public.normalize_phone(profile.phone) as normalized_profile_phone,
      profile.created_at
    from public.profiles profile, input
    where profile.id <> p_owner_id
      and profile.account_status = 'active'
      and public.normalize_phone(profile.phone) is not null
      and public.normalize_phone(profile.phone) <> ''
      and input.normalized_phone is not null
      and input.normalized_phone <> ''
  )
  select candidate.id
  from candidates candidate, input
  where candidate.normalized_profile_phone = input.normalized_phone
     or (
       length(candidate.normalized_profile_phone) >= 10
       and length(input.normalized_phone) >= 10
       and right(candidate.normalized_profile_phone, 10) = right(input.normalized_phone, 10)
     )
  order by
    case when candidate.normalized_profile_phone = input.normalized_phone then 0 else 1 end,
    candidate.created_at desc
  limit 1;
$$;

revoke all on function public.match_emergency_contact_profile(uuid, text) from public;
grant execute on function public.match_emergency_contact_profile(uuid, text) to authenticated;

create or replace function public.create_safety_alert(
  p_ride_id uuid,
  p_alert_type text,
  p_message text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m numeric default null
)
returns public.safety_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_profile public.profiles;
  v_recipient uuid;
  v_alert public.safety_alerts;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_phone text;
  v_delivery text;
begin
  if p_alert_type not in ('sos', 'late_trip', 'route_changed') then
    raise exception 'Unsupported safety alert type';
  end if;

  select * into v_ride from public.ride_requests where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'Ride not found'; end if;
  if v_ride.user_id <> auth.uid() then raise exception 'Only the booking user can trigger a safety alert'; end if;
  if v_ride.status not in ('assigned', 'started') then raise exception 'Safety alerts are available after rider assignment'; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  v_phone := public.normalize_phone(v_profile.emergency_contact_phone);
  v_recipient := public.match_emergency_contact_profile(auth.uid(), v_profile.emergency_contact_phone);

  v_delivery := case
    when v_phone is null or v_phone = '' then 'no_contact'
    when v_recipient is null then 'unlinked'
    else 'in_app'
  end;

  select * into v_alert
  from public.safety_alerts alert
  where alert.ride_id = p_ride_id and alert.alert_type = p_alert_type
    and alert.created_at > now() - interval '30 minutes'
  order by alert.created_at desc limit 1;

  if v_alert.id is null then
    insert into public.safety_alerts (
      ride_id, triggered_by, recipient_profile_id, recipient_phone,
      delivery_status, alert_type, message, lat, lng, accuracy_m
    ) values (
      p_ride_id, auth.uid(), v_recipient, nullif(v_phone, ''), v_delivery,
      p_alert_type, coalesce(v_message, 'Taxiro safety alert triggered during ride'),
      p_lat, p_lng, p_accuracy_m
    ) returning * into v_alert;
  else
    update public.safety_alerts
    set recipient_profile_id = coalesce(v_recipient, v_alert.recipient_profile_id),
        recipient_phone = nullif(v_phone, ''),
        delivery_status = case
          when coalesce(v_recipient, v_alert.recipient_profile_id) is not null then 'in_app'
          when v_phone is null or v_phone = '' then 'no_contact'
          else 'unlinked'
        end,
        lat = coalesce(p_lat, v_alert.lat),
        lng = coalesce(p_lng, v_alert.lng),
        accuracy_m = coalesce(p_accuracy_m, v_alert.accuracy_m)
    where id = v_alert.id
    returning * into v_alert;
  end if;

  if v_alert.recipient_profile_id is not null and not exists (
    select 1 from public.app_notifications note where note.safety_alert_id = v_alert.id
  ) then
    insert into public.app_notifications (profile_id, title, body, related_ride_id, safety_alert_id, category)
    values (
      v_alert.recipient_profile_id,
      case when p_alert_type = 'sos' then 'Taxiro SOS alert'
           when p_alert_type = 'late_trip' then 'Taxiro trip delay alert'
           else 'Taxiro route change alert' end,
      coalesce(v_profile.full_name, 'Your emergency contact') || ' may need help during Taxiro ride #' || left(p_ride_id::text, 8) || '. ' || coalesce(v_message, ''),
      p_ride_id,
      v_alert.id,
      'safety'
    );
  end if;

  if not exists (
    select 1 from public.ride_status_events event
    where event.ride_id = p_ride_id and event.note = 'Safety alert created: ' || p_alert_type
      and event.created_at > now() - interval '30 minutes'
  ) then
    insert into public.ride_status_events (ride_id, status, actor_id, note)
    values (p_ride_id, v_ride.status, auth.uid(), 'Safety alert created: ' || p_alert_type);
  end if;

  return v_alert;
end $$;

grant execute on function public.create_safety_alert(uuid, text, text, double precision, double precision, numeric) to authenticated;

create or replace function public.get_emergency_contact_link_status()
returns table(configured boolean, linked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.emergency_contact_phone is not null and public.normalize_phone(profile.emergency_contact_phone) <> '',
    public.match_emergency_contact_profile(profile.id, profile.emergency_contact_phone) is not null
  from public.profiles profile where profile.id = auth.uid();
$$;

grant execute on function public.get_emergency_contact_link_status() to authenticated;

with matched_alerts as (
  select
    alert.id,
    trigger_profile.emergency_contact_phone,
    public.normalize_phone(trigger_profile.emergency_contact_phone) as normalized_phone,
    public.match_emergency_contact_profile(alert.triggered_by, trigger_profile.emergency_contact_phone) as matched_profile_id
  from public.safety_alerts alert
  join public.profiles trigger_profile on trigger_profile.id = alert.triggered_by
  where alert.recipient_profile_id is null
)
update public.safety_alerts alert
set recipient_profile_id = matched_alerts.matched_profile_id,
    recipient_phone = nullif(matched_alerts.normalized_phone, ''),
    delivery_status = case
      when matched_alerts.matched_profile_id is not null then 'in_app'
      when matched_alerts.normalized_phone is null or matched_alerts.normalized_phone = '' then 'no_contact'
      else 'unlinked'
    end
from matched_alerts
where alert.id = matched_alerts.id;

insert into public.app_notifications (profile_id, title, body, related_ride_id, safety_alert_id, category)
select
  alert.recipient_profile_id,
  case when alert.alert_type = 'sos' then 'Taxiro SOS alert'
       when alert.alert_type = 'late_trip' then 'Taxiro trip delay alert'
       else 'Taxiro route change alert' end,
  coalesce(trigger_profile.full_name, 'Your emergency contact') || ' may need help during Taxiro ride #' || left(alert.ride_id::text, 8) || '. ' || alert.message,
  alert.ride_id,
  alert.id,
  'safety'
from public.safety_alerts alert
join public.profiles trigger_profile on trigger_profile.id = alert.triggered_by
where alert.recipient_profile_id is not null
  and not exists (select 1 from public.app_notifications note where note.safety_alert_id = alert.id);

notify pgrst, 'reload schema';

-- Privacy-safe nearby supply preview for customer maps.
-- Returns approximate positions only; rider identity is never exposed.

create or replace function public.get_nearby_available_riders(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 8
)
returns table (
  rider_id text,
  lat double precision,
  lng double precision,
  is_available boolean,
  accuracy_m numeric,
  heading numeric,
  speed numeric,
  last_seen_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'nearby-' || left(md5(location.rider_id::text || current_date::text), 12),
    round(location.lat::numeric, 3)::double precision,
    round(location.lng::numeric, 3)::double precision,
    true,
    greatest(coalesce(location.accuracy_m, 0), 120),
    location.heading,
    null::numeric,
    location.last_seen_at,
    location.updated_at
  from public.rider_locations location
  join public.profiles profile on profile.id = location.rider_id
  join public.rider_profiles rider on rider.rider_id = location.rider_id
  where auth.uid() is not null
    and profile.account_status = 'active'
    and location.is_available = true
    and rider.verification_status = 'verified'
    and rider.active_vehicle_type is not null
    and coalesce(location.last_seen_at, location.updated_at) > now() - interval '5 minutes'
    and st_dwithin(
      st_setsrid(st_makepoint(location.lng, location.lat), 4326)::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      least(greatest(coalesce(p_radius_km, 8), 1), 20) * 1000
    )
  order by st_distance(
    st_setsrid(st_makepoint(location.lng, location.lat), 4326)::geography,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit 40;
$$;

revoke all on function public.get_nearby_available_riders(double precision, double precision, numeric) from public;
grant execute on function public.get_nearby_available_riders(double precision, double precision, numeric) to authenticated;

notify pgrst, 'reload schema';

-- Repair SOS delivery when an emergency contact phone exists in Auth metadata
-- but is missing or formatted differently in public.profiles.
-- Additive only: no tables or user data are deleted.

update public.profiles profile
set phone = public.normalize_phone(
      coalesce(
        nullif(auth_user.phone, ''),
        nullif(auth_user.raw_user_meta_data ->> 'phone', '')
      )
    )
from auth.users auth_user
where auth_user.id = profile.id
  and (profile.phone is null or public.normalize_phone(profile.phone) = '')
  and public.normalize_phone(
        coalesce(
          nullif(auth_user.phone, ''),
          nullif(auth_user.raw_user_meta_data ->> 'phone', '')
        )
      ) <> '';

create or replace function public.match_emergency_contact_profile(
  p_owner_id uuid,
  p_phone text
)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  with input as (
    select public.normalize_phone(p_phone) as normalized_phone
  ),
  candidates as (
    select
      profile.id,
      nullif(public.normalize_phone(profile.phone), '') as profile_phone,
      nullif(public.normalize_phone(auth_user.phone), '') as auth_phone,
      nullif(public.normalize_phone(auth_user.raw_user_meta_data ->> 'phone'), '') as metadata_phone,
      profile.created_at
    from public.profiles profile
    left join auth.users auth_user on auth_user.id = profile.id
    where profile.id <> p_owner_id
      and profile.account_status = 'active'
  )
  select candidate.id
  from candidates candidate
  cross join input
  where input.normalized_phone is not null
    and input.normalized_phone <> ''
    and (
      candidate.profile_phone = input.normalized_phone
      or candidate.auth_phone = input.normalized_phone
      or candidate.metadata_phone = input.normalized_phone
      or (length(input.normalized_phone) >= 10 and right(candidate.profile_phone, 10) = right(input.normalized_phone, 10))
      or (length(input.normalized_phone) >= 10 and right(candidate.auth_phone, 10) = right(input.normalized_phone, 10))
      or (length(input.normalized_phone) >= 10 and right(candidate.metadata_phone, 10) = right(input.normalized_phone, 10))
    )
  order by
    case
      when candidate.profile_phone = input.normalized_phone
        or candidate.auth_phone = input.normalized_phone
        or candidate.metadata_phone = input.normalized_phone then 0
      else 1
    end,
    candidate.created_at desc
  limit 1;
$$;

revoke all on function public.match_emergency_contact_profile(uuid, text) from public;
grant execute on function public.match_emergency_contact_profile(uuid, text) to authenticated;

with repaired as (
  select
    alert.id,
    public.match_emergency_contact_profile(
      alert.triggered_by,
      owner_profile.emergency_contact_phone
    ) as recipient_profile_id,
    public.normalize_phone(owner_profile.emergency_contact_phone) as recipient_phone
  from public.safety_alerts alert
  join public.profiles owner_profile on owner_profile.id = alert.triggered_by
  where alert.recipient_profile_id is null
)
update public.safety_alerts alert
set recipient_profile_id = repaired.recipient_profile_id,
    recipient_phone = nullif(repaired.recipient_phone, ''),
    delivery_status = case
      when repaired.recipient_profile_id is not null then 'in_app'
      when repaired.recipient_phone is null or repaired.recipient_phone = '' then 'no_contact'
      else 'unlinked'
    end
from repaired
where repaired.id = alert.id;

insert into public.app_notifications (
  profile_id,
  title,
  body,
  related_ride_id,
  safety_alert_id,
  category
)
select
  alert.recipient_profile_id,
  case
    when alert.alert_type = 'sos' then 'Taxiro SOS alert'
    when alert.alert_type = 'late_trip' then 'Taxiro trip delay alert'
    else 'Taxiro route change alert'
  end,
  coalesce(owner_profile.full_name, 'Your emergency contact')
    || ' may need help during Taxiro ride #'
    || left(alert.ride_id::text, 8)
    || '. '
    || alert.message,
  alert.ride_id,
  alert.id,
  'safety'
from public.safety_alerts alert
join public.profiles owner_profile on owner_profile.id = alert.triggered_by
where alert.recipient_profile_id is not null
  and not exists (
    select 1
    from public.app_notifications notification
    where notification.safety_alert_id = alert.id
      and notification.profile_id = alert.recipient_profile_id
  );

notify pgrst, 'reload schema';

-- Keep rider reputation statistics derived from real completed rides and ratings.
-- Additive and idempotent: no ride, rating, or profile data is deleted.

alter table public.rider_profiles
  alter column rating set default 0.00;

create or replace function public.refresh_rider_stats(p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rider_id is null then
    return;
  end if;

  update public.rider_profiles profile
  set
    rating = coalesce(
      (
        select round(avg(rating.rating)::numeric, 2)
        from public.ride_ratings rating
        where rating.reviewee_id = p_rider_id
      ),
      0.00
    ),
    completed_rides = (
      select count(*)::integer
      from public.ride_requests ride
      where ride.assigned_rider_id = p_rider_id
        and ride.status = 'completed'
    ),
    updated_at = now()
  where profile.rider_id = p_rider_id;
end;
$$;

revoke all on function public.refresh_rider_stats(uuid) from public;

create or replace function public.sync_rider_stats_from_ride()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_rider_stats(old.assigned_rider_id);
  end if;

  if tg_op <> 'DELETE' then
    if tg_op = 'INSERT' or new.assigned_rider_id is distinct from old.assigned_rider_id or new.status is distinct from old.status then
      perform public.refresh_rider_stats(new.assigned_rider_id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.sync_rider_stats_from_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_rider_stats(old.reviewee_id);
  end if;

  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.reviewee_id is distinct from old.reviewee_id or new.rating is distinct from old.rating) then
    perform public.refresh_rider_stats(new.reviewee_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'sync_rider_stats_after_ride_change'
      and tgrelid = 'public.ride_requests'::regclass
      and not tgisinternal
  ) then
    create trigger sync_rider_stats_after_ride_change
      after insert or update or delete on public.ride_requests
      for each row execute function public.sync_rider_stats_from_ride();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'sync_rider_stats_after_rating_change'
      and tgrelid = 'public.ride_ratings'::regclass
      and not tgisinternal
  ) then
    create trigger sync_rider_stats_after_rating_change
      after insert or update or delete on public.ride_ratings
      for each row execute function public.sync_rider_stats_from_rating();
  end if;
end
$$;

update public.rider_profiles profile
set
  rating = coalesce(
    (
      select round(avg(rating.rating)::numeric, 2)
      from public.ride_ratings rating
      where rating.reviewee_id = profile.rider_id
    ),
    0.00
  ),
  completed_rides = (
    select count(*)::integer
    from public.ride_requests ride
    where ride.assigned_rider_id = profile.rider_id
      and ride.status = 'completed'
  ),
  updated_at = now();

comment on column public.rider_profiles.rating is
  'Average of real ride_ratings received by this rider; 0 means no ratings yet.';
comment on column public.rider_profiles.completed_rides is
  'Count of real completed ride_requests assigned to this rider.';

notify pgrst, 'reload schema';

-- 20260703110000_operational_and_product_foundation.sql
-- Additive production operations and product-expansion foundation for Taxiro.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  related_ride_id uuid references public.ride_requests(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('account','ride','payment','safety','rider','technical','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_user','resolved','closed')),
  subject text not null check (char_length(subject) between 4 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles(id),
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 60),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  center_lat numeric not null check (center_lat between -90 and 90),
  center_lng numeric not null check (center_lng between -180 and 180),
  radius_km numeric not null check (radius_km > 0 and radius_km <= 250),
  supported_vehicle_types text[] not null default array['bike','auto','car']::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike','auto','car')),
  base_fare numeric not null default 0 check (base_fare >= 0),
  per_km_rate numeric not null check (per_km_rate > 0),
  per_minute_rate numeric not null default 0 check (per_minute_rate >= 0),
  minimum_fare numeric not null default 0 check (minimum_fare >= 0),
  company_commission_rate numeric not null default 0.07 check (company_commission_rate between 0 and 1),
  peak_windows jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  ride_id uuid references public.ride_requests(id) on delete set null,
  signal_type text not null check (signal_type in ('impossible_speed','location_jump','mock_location','repeat_cancellation','payment_dispute','account_abuse','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewing','dismissed','confirmed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  address text not null check (char_length(address) between 3 and 300),
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique(profile_id, label)
);

create table if not exists public.ride_stops (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  stop_order smallint not null check (stop_order between 1 and 5),
  address text not null,
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  reached_at timestamptz,
  created_at timestamptz not null default now(),
  unique(ride_id, stop_order)
);

create table if not exists public.recurring_ride_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike','auto','car')),
  pickup_address text not null,
  pickup_lat numeric not null,
  pickup_lng numeric not null,
  drop_address text not null,
  drop_lat numeric not null,
  drop_lng numeric not null,
  local_time time not null,
  weekdays smallint[] not null,
  next_run_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  recipient_name text,
  recipient_phone text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 24),
  discount_type text not null check (discount_type in ('flat','percent')),
  discount_value numeric not null check (discount_value > 0),
  max_discount numeric,
  minimum_fare numeric not null default 0,
  usage_limit integer,
  per_profile_limit integer not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes(id),
  profile_id uuid not null references public.profiles(id),
  ride_id uuid not null references public.ride_requests(id),
  discount_amount numeric not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique(promo_id, ride_id)
);

create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid references public.ride_requests(id) on delete set null,
  amount numeric not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('credit','ride_debit','refund','promo','adjustment')),
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.rider_incentives (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_rides integer not null check (target_rides > 0),
  reward_amount numeric not null check (reward_amount > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  completed_rides integer not null default 0,
  status text not null default 'active' check (status in ('active','earned','expired','paid')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_email text not null,
  owner_profile_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.business_account_members (
  business_account_id uuid not null references public.business_accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','manager','member')),
  created_at timestamptz not null default now(),
  primary key (business_account_id, profile_id)
);

create index if not exists support_tickets_owner_status_idx on public.support_tickets(created_by, status, created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists fraud_signals_status_idx on public.fraud_signals(status, severity, created_at desc);
create index if not exists saved_places_profile_idx on public.saved_places(profile_id, created_at desc);
create index if not exists trip_shares_token_idx on public.trip_shares(share_token) where revoked_at is null;
create index if not exists wallet_transactions_profile_idx on public.wallet_transactions(profile_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.service_areas enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.fraud_signals enable row level security;
alter table public.saved_places enable row level security;
alter table public.ride_stops enable row level security;
alter table public.recurring_ride_templates enable row level security;
alter table public.trip_shares enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.rider_incentives enable row level security;
alter table public.business_accounts enable row level security;
alter table public.business_account_members enable row level security;

drop policy if exists "owners and admins read support tickets" on public.support_tickets;
drop policy if exists "users create support tickets" on public.support_tickets;
drop policy if exists "admins update support tickets" on public.support_tickets;

create policy "owners and admins read support tickets" on public.support_tickets for select to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "users create support tickets" on public.support_tickets for insert to authenticated with check (created_by = auth.uid());
create policy "admins update support tickets" on public.support_tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated using (public.is_admin());
create policy "admins write audit logs" on public.admin_audit_logs for insert to authenticated with check (admin_id = auth.uid() and public.is_admin());
create policy "authenticated read active service areas" on public.service_areas for select to authenticated using (is_active or public.is_admin());
create policy "admins manage service areas" on public.service_areas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active pricing" on public.pricing_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage pricing" on public.pricing_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage fraud signals" on public.fraud_signals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles manage saved places" on public.saved_places for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "ride participants read stops" on public.ride_stops for select to authenticated using (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or ride.assigned_rider_id = auth.uid() or public.is_admin())));
create policy "ride owners manage stops" on public.ride_stops for all to authenticated using (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or public.is_admin())));
create policy "profiles manage recurring rides" on public.recurring_ride_templates for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "owners manage trip shares" on public.trip_shares for all to authenticated using (shared_by = auth.uid() or public.is_admin()) with check (shared_by = auth.uid() or public.is_admin());
create policy "authenticated read active promos" on public.promo_codes for select to authenticated using ((is_active and starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_admin());
create policy "admins manage promos" on public.promo_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles read promo redemptions" on public.promo_redemptions for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "profiles read wallets" on public.wallets for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "profiles read wallet transactions" on public.wallet_transactions for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "riders read own incentives" on public.rider_incentives for select to authenticated using (rider_id = auth.uid() or public.is_admin());
create policy "admins manage incentives" on public.rider_incentives for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "business owners read account" on public.business_accounts for select to authenticated using (owner_profile_id = auth.uid() or public.is_admin());
create policy "business owners manage account" on public.business_accounts for all to authenticated using (owner_profile_id = auth.uid() or public.is_admin()) with check (owner_profile_id = auth.uid() or public.is_admin());
create policy "business members read membership" on public.business_account_members for select to authenticated using (profile_id = auth.uid() or public.is_admin() or exists (select 1 from public.business_accounts account where account.id = business_account_members.business_account_id and account.owner_profile_id = auth.uid()));

create or replace function public.create_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'other',
  p_related_ride_id uuid default null
) returns public.support_tickets
language plpgsql security invoker set search_path = public as $$
declare created public.support_tickets;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.support_tickets(created_by, related_ride_id, category, subject, description)
  values (auth.uid(), p_related_ride_id, p_category, trim(p_subject), trim(p_description)) returning * into created;
  return created;
end;
$$;

create or replace function public.create_trip_share(p_ride_id uuid, p_recipient_name text default null, p_recipient_phone text default null)
returns public.trip_shares language plpgsql security invoker set search_path = public as $$
declare created public.trip_shares;
begin
  if not exists (select 1 from public.ride_requests where id = p_ride_id and user_id = auth.uid()) then
    raise exception 'Ride not found or access denied';
  end if;
  insert into public.trip_shares(ride_id, shared_by, recipient_name, recipient_phone)
  values (p_ride_id, auth.uid(), nullif(trim(p_recipient_name), ''), nullif(trim(p_recipient_phone), '')) returning * into created;
  return created;
end;
$$;

grant execute on function public.create_support_ticket(text,text,text,uuid) to authenticated;
grant execute on function public.create_trip_share(uuid,text,text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;

-- Snapshot addition: 20260706100000_operational_enforcement_and_fraud.sql
-- Enforce operational configuration references and safely record location anomalies.

alter table public.ride_requests
  add column if not exists service_area_id uuid references public.service_areas(id) on delete set null,
  add column if not exists pricing_rule_id uuid references public.pricing_rules(id) on delete set null;

create index if not exists ride_requests_service_area_idx
  on public.ride_requests(service_area_id, created_at desc);

create or replace function public.record_location_anomaly(
  p_signal_type text,
  p_evidence jsonb default '{}'::jsonb,
  p_ride_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_signal_id uuid;
begin
  if auth.uid() is null or not public.is_rider() then
    raise exception 'Rider authentication required';
  end if;
  if p_signal_type not in ('impossible_speed', 'location_jump', 'mock_location') then
    raise exception 'Unsupported location signal type';
  end if;
  if p_ride_id is not null and not exists (
    select 1 from public.ride_requests
    where id = p_ride_id and assigned_rider_id = auth.uid()
  ) then
    raise exception 'Ride not assigned to this rider';
  end if;

  select id into v_existing
  from public.fraud_signals
  where profile_id = auth.uid()
    and signal_type = p_signal_type
    and status in ('open', 'reviewing')
    and created_at > now() - interval '15 minutes'
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.fraud_signals(
    profile_id,
    ride_id,
    signal_type,
    severity,
    evidence
  )
  values (
    auth.uid(),
    p_ride_id,
    p_signal_type,
    case when p_signal_type = 'mock_location' then 'high' else 'medium' end,
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning id into v_signal_id;

  return v_signal_id;
end;
$$;

create or replace function public.admin_review_fraud_signal(
  p_signal_id uuid,
  p_status text
) returns public.fraud_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.fraud_signals;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('reviewing', 'dismissed', 'confirmed') then
    raise exception 'Invalid fraud review status';
  end if;

  update public.fraud_signals
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_signal_id
  returning * into v_signal;
  if v_signal.id is null then
    raise exception 'Fraud signal not found';
  end if;

  insert into public.admin_audit_logs(admin_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'fraud_signal_' || p_status,
    'fraud_signal',
    p_signal_id::text,
    jsonb_build_object('signal_type', v_signal.signal_type, 'profile_id', v_signal.profile_id)
  );
  return v_signal;
end;
$$;

grant execute on function public.record_location_anomaly(text,jsonb,uuid) to authenticated;
grant execute on function public.admin_review_fraud_signal(uuid,text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['service_areas', 'pricing_rules', 'fraud_signals']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

