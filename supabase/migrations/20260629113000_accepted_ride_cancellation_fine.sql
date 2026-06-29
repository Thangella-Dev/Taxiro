-- Taxiro accepted-ride user cancellation fine.
-- Additive only; preserves existing ride data.

alter table public.ride_requests
  add column if not exists cancellation_fee numeric(10,2),
  add column if not exists cancellation_fee_reason text,
  add column if not exists cancelled_by uuid references public.profiles(id);

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
  v_actor uuid := auth.uid();
  v_previous_user_cancellations integer := 0;
  v_cancellation_fee numeric(10,2) := null;
  v_cancellation_fee_reason text := null;
begin
  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_actor <> v_ride.user_id
     and v_actor <> v_ride.assigned_rider_id
     and not public.is_admin() then
    raise exception 'Not allowed to cancel this ride';
  end if;

  if v_ride.status not in ('scheduled', 'ready', 'assigned') then
    raise exception 'This ride can no longer be cancelled';
  end if;

  if v_actor = v_ride.user_id and v_ride.status = 'assigned' and v_ride.assigned_rider_id is not null then
    select count(*) into v_previous_user_cancellations
    from public.ride_requests rr
    where rr.user_id = v_ride.user_id
      and rr.id <> v_ride.id
      and rr.status = 'cancelled'
      and (rr.cancelled_by is null or rr.cancelled_by = v_ride.user_id);

    if v_previous_user_cancellations >= 2 then
      v_cancellation_fee := 50.00;
      v_cancellation_fee_reason := 'User cancelled an accepted ride after 2 previous cancellations';
    end if;
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancellation_reason = nullif(trim(p_reason), ''),
      cancellation_fee = v_cancellation_fee,
      cancellation_fee_reason = v_cancellation_fee_reason,
      cancelled_at = now(),
      cancelled_by = v_actor
  where id = p_ride_id
  returning * into v_ride;

  if v_ride.assigned_rider_id is not null then
    update public.rider_locations
    set is_available = true, updated_at = now()
    where rider_id = v_ride.assigned_rider_id;
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (
    v_ride.id,
    'cancelled',
    v_actor,
    case
      when v_cancellation_fee is null then null
      else 'Cancellation fine applied: Rs ' || v_cancellation_fee::text
    end
  );

  return v_ride;
end;
$$;

grant execute on function public.cancel_ride(uuid, text) to authenticated;