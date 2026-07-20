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
