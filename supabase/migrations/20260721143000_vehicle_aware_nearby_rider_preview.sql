drop function if exists public.get_nearby_available_riders(double precision, double precision, numeric);

create or replace function public.get_nearby_available_riders(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 8,
  p_vehicle_type text default null
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
  updated_at timestamptz,
  vehicle_type text,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select case
      when lower(trim(coalesce(p_vehicle_type, ''))) in ('bike','auto','car','hatchback','sedan','suv')
        then lower(trim(p_vehicle_type))
      else null
    end as vehicle_type
  )
  select
    'nearby-' || left(md5(location.rider_id::text || current_date::text), 12),
    round(location.lat::numeric, 3)::double precision,
    round(location.lng::numeric, 3)::double precision,
    true,
    greatest(coalesce(location.accuracy_m, 0), 120),
    location.heading,
    location.speed,
    location.last_seen_at,
    location.updated_at,
    case
      when rider.active_vehicle_type = 'car'
        and requested.vehicle_type in ('hatchback','sedan','suv')
        then requested.vehicle_type
      else rider.active_vehicle_type
    end,
    round((
      st_distance(
        st_setsrid(st_makepoint(location.lng, location.lat), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      ) / 1000
    )::numeric, 2)
  from public.rider_locations location
  join public.profiles profile on profile.id = location.rider_id
  join public.rider_profiles rider on rider.rider_id = location.rider_id
  cross join requested
  where auth.uid() is not null
    and profile.account_status = 'active'
    and location.is_available = true
    and rider.verification_status = 'verified'
    and rider.active_vehicle_type is not null
    and (
      requested.vehicle_type is null
      or rider.active_vehicle_type = requested.vehicle_type
      or (
        requested.vehicle_type in ('hatchback','sedan','suv')
        and rider.active_vehicle_type = 'car'
      )
    )
    and exists (
      select 1
      from public.rider_vehicles vehicle
      where vehicle.rider_id = location.rider_id
        and vehicle.verification_status = 'verified'
        and (
          vehicle.vehicle_type = rider.active_vehicle_type
          or (
            requested.vehicle_type in ('hatchback','sedan','suv')
            and rider.active_vehicle_type = 'car'
            and vehicle.vehicle_type = 'car'
          )
        )
    )
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

revoke all on function public.get_nearby_available_riders(double precision, double precision, numeric, text) from public;
grant execute on function public.get_nearby_available_riders(double precision, double precision, numeric, text) to authenticated;

notify pgrst, 'reload schema';
