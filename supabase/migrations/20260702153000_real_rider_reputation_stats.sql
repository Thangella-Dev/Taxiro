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
