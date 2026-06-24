-- Live foreground tracking metadata for rider locations.
-- Additive migration only; no tables or rows are deleted.

alter table public.rider_locations
  add column if not exists accuracy_m numeric,
  add column if not exists heading numeric,
  add column if not exists speed numeric,
  add column if not exists last_seen_at timestamp with time zone;

update public.rider_locations
set last_seen_at = coalesce(last_seen_at, updated_at, now())
where last_seen_at is null;
