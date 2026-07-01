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
