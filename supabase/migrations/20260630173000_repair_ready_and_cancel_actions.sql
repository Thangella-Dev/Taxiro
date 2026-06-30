-- Repair Taxiro ride actions deployed before timed ready signals.
-- Additive only: no tables or ride records are removed.

alter table public.ride_requests
  add column if not exists ready_at timestamptz,
  add column if not exists ready_expires_at timestamptz,
  add column if not exists ready_signal_minutes integer default 30;

update public.ride_requests
set ready_at = coalesce(ready_at, now()),
    ready_signal_minutes = coalesce(ready_signal_minutes, 30),
    ready_expires_at = coalesce(ready_expires_at, now() + interval '30 minutes')
where status = 'ready';

create index if not exists ride_requests_ready_expiry_idx
  on public.ride_requests(status, ready_expires_at);

create or replace function public.mark_ride_ready_and_assign(
  p_ride_id uuid,
  p_signal_minutes integer default 30
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  ready_ride public.ride_requests;
  v_minutes integer := coalesce(p_signal_minutes, 30);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_minutes not in (15, 30, 60) then
    v_minutes := 30;
  end if;

  update public.ride_requests
  set status = 'ready',
      assigned_rider_id = null,
      accepted_at = null,
      ready_at = now(),
      ready_signal_minutes = v_minutes,
      ready_expires_at = now() + make_interval(mins => v_minutes)
  where id = p_ride_id
    and user_id = auth.uid()
    and (
      status = 'scheduled'
      or (status = 'ready' and coalesce(ready_expires_at, now()) <= now())
    )
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'This ride cannot be published. Refresh and check its current status.';
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (
    p_ride_id,
    'ready',
    auth.uid(),
    'User ready signal published for ' || v_minutes::text || ' minutes'
  );

  return ready_ride;
end;
$$;

create or replace function public.expire_ready_signals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  with expired as (
    update public.ride_requests
    set status = 'scheduled',
        assigned_rider_id = null,
        accepted_at = null
    where status = 'ready'
      and ready_expires_at is not null
      and ready_expires_at <= now()
    returning id
  ), logged as (
    insert into public.ride_status_events (ride_id, status, note)
    select id, 'scheduled', 'Ready signal expired; user can publish it again'
    from expired
    returning 1
  )
  select count(*) into expired_count from logged;

  return expired_count;
end;
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
  v_actor uuid := auth.uid();
  v_actor_kind text;
  v_previous_user_cancellations integer := 0;
  v_cancellation_fee numeric(10,2) := null;
  v_cancellation_fee_reason text := null;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_actor = v_ride.user_id then
    v_actor_kind := 'User';
  elsif v_actor = v_ride.assigned_rider_id and v_ride.status = 'assigned' then
    v_actor_kind := 'Rider';
  elsif public.is_admin() then
    v_actor_kind := 'Admin';
  else
    raise exception 'You are not allowed to cancel this ride';
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
      cancelled_by = v_actor,
      ready_expires_at = null
  where id = p_ride_id
  returning * into v_ride;

  if v_ride.assigned_rider_id is not null then
    update public.rider_locations
    set is_available = true,
        updated_at = now()
    where rider_id = v_ride.assigned_rider_id;
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (
    v_ride.id,
    'cancelled',
    v_actor,
    v_actor_kind || ' cancelled: ' || coalesce(nullif(trim(p_reason), ''), 'No reason provided') ||
      case
        when v_cancellation_fee is null then ''
        else '. Cancellation fine applied: Rs ' || v_cancellation_fee::text
      end
  );

  return v_ride;
end;
$$;

grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;
grant execute on function public.expire_ready_signals() to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;

notify pgrst, 'reload schema';