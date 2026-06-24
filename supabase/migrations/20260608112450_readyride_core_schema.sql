-- Taxidi core schema.
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
