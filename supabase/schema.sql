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