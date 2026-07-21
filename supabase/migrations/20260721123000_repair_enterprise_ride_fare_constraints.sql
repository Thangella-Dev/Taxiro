-- Repair obsolete ride fare validation for backend-owned enterprise pricing.

alter table public.ride_requests
  drop constraint if exists ride_requests_vehicle_fare_valid;

alter table public.ride_requests
  drop constraint if exists ride_requests_fare_rate_per_km_check;

comment on column public.ride_requests.fare_rate_per_km is
  'Legacy display-only per-km rate. Enterprise fares are calculated by pricing_rule_id and stored in ride_fare_breakdowns.';

notify pgrst, 'reload schema';