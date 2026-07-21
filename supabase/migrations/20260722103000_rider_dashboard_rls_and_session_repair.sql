-- Repair rider dashboard access paths without exposing private rider/customer data.
-- This migration is intentionally additive/compatible: no tables or rows are removed.

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
      and coalesce(account_status, 'active') = 'active'
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
      and coalesce(account_status, 'active') = 'active'
  );
$$;

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
      and coalesce(account.account_status, 'active') = 'active'
      and profile.verification_status = 'verified'
      and profile.active_vehicle_type is not null
      and (
        profile.active_vehicle_type = p_vehicle_type
        or (profile.active_vehicle_type = 'car' and p_vehicle_type in ('hatchback', 'sedan', 'suv'))
      )
  );
$$;

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

alter policy "users riders admins update allowed rides"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or (status = 'ready' and public.can_view_vehicle_signal(vehicle_type))
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "rider locations visible to authenticated users" on public.rider_locations;
drop policy if exists "rider locations visible to permitted users" on public.rider_locations;
drop policy if exists "riders insert own location" on public.rider_locations;
drop policy if exists "riders update own location" on public.rider_locations;

create policy "rider locations visible to permitted users"
on public.rider_locations for select to authenticated
using (
  rider_id = auth.uid()
  or public.is_rider()
  or public.is_admin()
  or exists (
    select 1
    from public.ride_requests ride
    where ride.assigned_rider_id = rider_locations.rider_id
      and ride.user_id = auth.uid()
      and ride.status in ('assigned', 'started')
  )
);

create policy "riders insert own location"
on public.rider_locations for insert to authenticated
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());

create policy "riders update own location"
on public.rider_locations for update to authenticated
using ((rider_id = auth.uid() and public.is_rider()) or public.is_admin())
with check ((rider_id = auth.uid() and public.is_rider()) or public.is_admin());

drop policy if exists "riders view own vehicles and ride users view assigned vehicle" on public.rider_vehicles;
drop policy if exists "riders create own vehicles" on public.rider_vehicles;
drop policy if exists "riders update own vehicles" on public.rider_vehicles;

create policy "riders view own vehicles and ride users view assigned vehicle"
on public.rider_vehicles for select to authenticated
using (
  rider_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.ride_requests ride
    where ride.assigned_rider_id = rider_vehicles.rider_id
      and ride.user_id = auth.uid()
      and ride.vehicle_type = rider_vehicles.vehicle_type
      and ride.status in ('assigned', 'started', 'completed')
  )
);

create policy "riders create own vehicles"
on public.rider_vehicles for insert to authenticated
with check (rider_id = auth.uid() or public.is_admin());

create policy "riders update own vehicles"
on public.rider_vehicles for update to authenticated
using (rider_id = auth.uid() or public.is_admin())
with check (rider_id = auth.uid() or public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.rider_profiles to authenticated;
grant select, insert, update on public.rider_locations to authenticated;
grant select, insert, update, delete on public.rider_vehicles to authenticated;
grant select, insert, update on public.ride_requests to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_rider() to authenticated;
grant execute on function public.can_view_vehicle_signal(text) to authenticated;
grant execute on function public.expire_ready_signals() to authenticated;
grant execute on function public.set_active_rider_vehicle(text) to authenticated;

notify pgrst, 'reload schema';