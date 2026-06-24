-- Let riders see scheduled demand and ready rides.
-- This changes read visibility only; it does not delete tables or data.

alter policy "users view own rides riders view assigned or ready admins all"
on public.ride_requests
using (
  user_id = auth.uid()
  or assigned_rider_id = auth.uid()
  or status in ('scheduled', 'ready')
  or public.is_admin()
);
