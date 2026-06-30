-- Taxiro signal expiry and safety alerts.
-- Additive only; preserves all existing ride and profile data.

alter table public.ride_requests
  add column if not exists ready_at timestamptz,
  add column if not exists ready_expires_at timestamptz,
  add column if not exists ready_signal_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_ready_signal_minutes_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_ready_signal_minutes_check
      check (ready_signal_minutes in (15, 30, 60));
  end if;
end
$$;

create index if not exists ride_requests_ready_expiry_idx
  on public.ride_requests(status, ready_expires_at);

create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  triggered_by uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  alert_type text not null check (alert_type in ('sos', 'late_trip', 'route_changed')),
  message text not null,
  lat double precision,
  lng double precision,
  accuracy_m numeric,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  related_ride_id uuid references public.ride_requests(id) on delete cascade,
  safety_alert_id uuid references public.safety_alerts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists safety_alerts_ride_type_created_idx
  on public.safety_alerts(ride_id, alert_type, created_at desc);

create index if not exists safety_alerts_recipient_idx
  on public.safety_alerts(recipient_profile_id, status, created_at desc);

create index if not exists app_notifications_profile_idx
  on public.app_notifications(profile_id, read_at, created_at desc);

alter table public.safety_alerts enable row level security;
alter table public.app_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_alerts'
      and policyname = 'safety alerts visible to related users'
  ) then
    create policy "safety alerts visible to related users"
      on public.safety_alerts for select to authenticated
      using (
        triggered_by = auth.uid()
        or recipient_profile_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.ride_requests rr
          where rr.id = ride_id
            and (rr.user_id = auth.uid() or rr.assigned_rider_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_alerts'
      and policyname = 'safety alerts insert by ride user'
  ) then
    create policy "safety alerts insert by ride user"
      on public.safety_alerts for insert to authenticated
      with check (
        triggered_by = auth.uid()
        and exists (
          select 1 from public.ride_requests rr
          where rr.id = ride_id
            and rr.user_id = auth.uid()
            and rr.status in ('assigned', 'started')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'users view own notifications'
  ) then
    create policy "users view own notifications"
      on public.app_notifications for select to authenticated
      using (profile_id = auth.uid() or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'users update own notifications'
  ) then
    create policy "users update own notifications"
      on public.app_notifications for update to authenticated
      using (profile_id = auth.uid() or public.is_admin())
      with check (profile_id = auth.uid() or public.is_admin());
  end if;
end
$$;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

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
      or (status = 'ready' and ready_expires_at is not null and ready_expires_at <= now())
    )
  returning * into ready_ride;

  if ready_ride.id is null then
    raise exception 'Only the booking user can mark a scheduled ride ready';
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'ready', auth.uid(), 'User signal visible for ' || v_minutes::text || ' minutes');

  return ready_ride;
end;
$$;

create or replace function public.accept_ready_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_ride public.ride_requests;
begin
  if not public.is_rider() then
    raise exception 'Rider account required';
  end if;

  update public.ride_requests
  set assigned_rider_id = auth.uid(),
      status = 'assigned',
      accepted_at = now()
  where id = p_ride_id
    and status = 'ready'
    and assigned_rider_id is null
    and coalesce(ready_expires_at, now() + interval '1 minute') > now()
  returning * into accepted_ride;

  if accepted_ride.id is null then
    raise exception 'Ride is no longer available';
  end if;

  update public.rider_locations
  set is_available = false,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'assigned', auth.uid(), 'Ride accepted by rider');

  return accepted_ride;
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
        accepted_at = null,
        ready_at = null,
        ready_expires_at = null
    where status = 'ready'
      and ready_expires_at is not null
      and ready_expires_at <= now()
    returning id
  ),
  events as (
    insert into public.ride_status_events (ride_id, status, note)
    select id, 'scheduled', 'Ready signal expired before rider acceptance'
    from expired
    returning ride_id
  )
  select count(*) into expired_count from events;

  return expired_count;
end;
$$;

create or replace function public.create_safety_alert(
  p_ride_id uuid,
  p_alert_type text,
  p_message text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m numeric default null
)
returns public.safety_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_profile public.profiles;
  v_recipient uuid;
  v_alert public.safety_alerts;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if p_alert_type not in ('sos', 'late_trip', 'route_changed') then
    raise exception 'Unsupported safety alert type';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.user_id <> auth.uid() then
    raise exception 'Only the booking user can trigger a safety alert';
  end if;

  if v_ride.status not in ('assigned', 'started') then
    raise exception 'Safety alerts are available after rider assignment';
  end if;

  if exists (
    select 1
    from public.safety_alerts sa
    where sa.ride_id = p_ride_id
      and sa.alert_type = p_alert_type
      and sa.created_at > now() - interval '30 minutes'
  ) then
    select * into v_alert
    from public.safety_alerts sa
    where sa.ride_id = p_ride_id
      and sa.alert_type = p_alert_type
      and sa.created_at > now() - interval '30 minutes'
    order by sa.created_at desc
    limit 1;
    return v_alert;
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  select p.id into v_recipient
  from public.profiles p
  where public.normalize_phone(p.phone) = public.normalize_phone(v_profile.emergency_contact_phone)
    and p.id <> auth.uid()
  order by p.created_at desc
  limit 1;

  insert into public.safety_alerts (
    ride_id,
    triggered_by,
    recipient_profile_id,
    alert_type,
    message,
    lat,
    lng,
    accuracy_m
  )
  values (
    p_ride_id,
    auth.uid(),
    v_recipient,
    p_alert_type,
    coalesce(v_message, 'Taxiro safety alert triggered during ride'),
    p_lat,
    p_lng,
    p_accuracy_m
  )
  returning * into v_alert;

  if v_recipient is not null then
    insert into public.app_notifications (
      profile_id,
      title,
      body,
      related_ride_id,
      safety_alert_id
    )
    values (
      v_recipient,
      case
        when p_alert_type = 'sos' then 'Taxiro SOS alert'
        when p_alert_type = 'late_trip' then 'Taxiro trip delay alert'
        else 'Taxiro route change alert'
      end,
      coalesce(v_profile.full_name, 'Your emergency contact') || ' may need help during a Taxiro ride. ' || coalesce(v_message, ''),
      p_ride_id,
      v_alert.id
    );
  end if;

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, v_ride.status, auth.uid(), 'Safety alert created: ' || p_alert_type);

  return v_alert;
end;
$$;

grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;
grant execute on function public.accept_ready_ride(uuid) to authenticated;
grant execute on function public.expire_ready_signals() to authenticated;
grant execute on function public.create_safety_alert(uuid, text, text, double precision, double precision, numeric) to authenticated;

do $$
declare
  v_table_name text;
  table_names text[] := array['safety_alerts', 'app_notifications'];
begin
  foreach v_table_name in array table_names loop
    execute format('alter table public.%I replica identity full', v_table_name);
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end
$$;
