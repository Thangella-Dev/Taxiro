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
