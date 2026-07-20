-- Use an explicit rider acceptance step.
-- "I'm Ready" publishes the request; accept_ready_ride assigns it atomically.

create or replace function public.mark_ride_ready_and_assign(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  ready_ride public.ride_requests;
begin
  update public.ride_requests
  set status = 'ready',
      assigned_rider_id = null,
      accepted_at = null
  where id = p_ride_id
    and user_id = auth.uid()
    and status = 'scheduled'
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'Only the booking user can mark a scheduled ride ready';
  end if;

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'ready', 'User is ready for rider offers');

  return ready_ride;
end;
$$;
