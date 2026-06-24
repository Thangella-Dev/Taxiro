-- Daily-use mobility hardening. Additive only; preserves all existing data.

alter table public.profiles
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists preferred_language text not null default 'en';

alter table public.ride_requests
  add column if not exists fare_estimate numeric(10,2),
  add column if not exists payment_method text not null default 'cash',
  add column if not exists rider_note text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists passenger_count smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_payment_method_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_payment_method_check
      check (payment_method in ('cash', 'upi'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_passenger_count_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_passenger_count_check
      check (passenger_count between 1 and 2);
  end if;
end
$$;

create table if not exists public.rider_profiles (
  rider_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_make text,
  vehicle_model text,
  vehicle_number text,
  license_number text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  rating numeric(3,2) not null default 5.00,
  completed_rides integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, reviewer_id)
);

create index if not exists ride_ratings_reviewee_idx
  on public.ride_ratings(reviewee_id);

alter table public.rider_profiles enable row level security;
alter table public.ride_ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rider_profiles'
      and policyname = 'rider profiles visible to authenticated users'
  ) then
    create policy "rider profiles visible to authenticated users"
      on public.rider_profiles for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rider_profiles'
      and policyname = 'riders manage own rider profile'
  ) then
    create policy "riders manage own rider profile"
      on public.rider_profiles for all to authenticated
      using (rider_id = auth.uid() or public.is_admin())
      with check (rider_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ride_ratings'
      and policyname = 'ride parties and admins view ratings'
  ) then
    create policy "ride parties and admins view ratings"
      on public.ride_ratings for select to authenticated
      using (
        reviewer_id = auth.uid()
        or reviewee_id = auth.uid()
        or public.is_admin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ride_ratings'
      and policyname = 'ride parties create ratings'
  ) then
    create policy "ride parties create ratings"
      on public.ride_ratings for insert to authenticated
      with check (
        reviewer_id = auth.uid()
        and exists (
          select 1 from public.ride_requests rr
          where rr.id = ride_id
            and rr.status = 'completed'
            and (
              (rr.user_id = auth.uid() and rr.assigned_rider_id = reviewee_id)
              or
              (rr.assigned_rider_id = auth.uid() and rr.user_id = reviewee_id)
            )
        )
      );
  end if;
end
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
begin
  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if auth.uid() <> v_ride.user_id
     and auth.uid() <> v_ride.assigned_rider_id
     and not public.is_admin() then
    raise exception 'Not allowed to cancel this ride';
  end if;

  if v_ride.status not in ('scheduled', 'ready', 'assigned') then
    raise exception 'This ride can no longer be cancelled';
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancellation_reason = nullif(trim(p_reason), ''),
      cancelled_at = now()
  where id = p_ride_id
  returning * into v_ride;

  if v_ride.assigned_rider_id is not null then
    update public.rider_locations
    set is_available = true, updated_at = now()
    where rider_id = v_ride.assigned_rider_id;
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id)
  values (v_ride.id, 'cancelled', auth.uid());

  return v_ride;
end;
$$;

grant execute on function public.cancel_ride(uuid, text) to authenticated;
