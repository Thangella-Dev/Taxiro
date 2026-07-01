-- Improve emergency-contact matching and backfill SOS notification delivery.
-- Additive only: no table drops or destructive data changes.

create or replace function public.match_emergency_contact_profile(
  p_owner_id uuid,
  p_phone text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select public.normalize_phone(p_phone) as normalized_phone
  ), candidates as (
    select
      profile.id,
      public.normalize_phone(profile.phone) as normalized_profile_phone,
      profile.created_at
    from public.profiles profile, input
    where profile.id <> p_owner_id
      and profile.account_status = 'active'
      and public.normalize_phone(profile.phone) is not null
      and public.normalize_phone(profile.phone) <> ''
      and input.normalized_phone is not null
      and input.normalized_phone <> ''
  )
  select candidate.id
  from candidates candidate, input
  where candidate.normalized_profile_phone = input.normalized_phone
     or (
       length(candidate.normalized_profile_phone) >= 10
       and length(input.normalized_phone) >= 10
       and right(candidate.normalized_profile_phone, 10) = right(input.normalized_phone, 10)
     )
  order by
    case when candidate.normalized_profile_phone = input.normalized_phone then 0 else 1 end,
    candidate.created_at desc
  limit 1;
$$;

revoke all on function public.match_emergency_contact_profile(uuid, text) from public;
grant execute on function public.match_emergency_contact_profile(uuid, text) to authenticated;

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
  v_phone text;
  v_delivery text;
begin
  if p_alert_type not in ('sos', 'late_trip', 'route_changed') then
    raise exception 'Unsupported safety alert type';
  end if;

  select * into v_ride from public.ride_requests where id = p_ride_id for update;
  if v_ride.id is null then raise exception 'Ride not found'; end if;
  if v_ride.user_id <> auth.uid() then raise exception 'Only the booking user can trigger a safety alert'; end if;
  if v_ride.status not in ('assigned', 'started') then raise exception 'Safety alerts are available after rider assignment'; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  v_phone := public.normalize_phone(v_profile.emergency_contact_phone);
  v_recipient := public.match_emergency_contact_profile(auth.uid(), v_profile.emergency_contact_phone);

  v_delivery := case
    when v_phone is null or v_phone = '' then 'no_contact'
    when v_recipient is null then 'unlinked'
    else 'in_app'
  end;

  select * into v_alert
  from public.safety_alerts alert
  where alert.ride_id = p_ride_id and alert.alert_type = p_alert_type
    and alert.created_at > now() - interval '30 minutes'
  order by alert.created_at desc limit 1;

  if v_alert.id is null then
    insert into public.safety_alerts (
      ride_id, triggered_by, recipient_profile_id, recipient_phone,
      delivery_status, alert_type, message, lat, lng, accuracy_m
    ) values (
      p_ride_id, auth.uid(), v_recipient, nullif(v_phone, ''), v_delivery,
      p_alert_type, coalesce(v_message, 'Taxiro safety alert triggered during ride'),
      p_lat, p_lng, p_accuracy_m
    ) returning * into v_alert;
  else
    update public.safety_alerts
    set recipient_profile_id = coalesce(v_recipient, v_alert.recipient_profile_id),
        recipient_phone = nullif(v_phone, ''),
        delivery_status = case
          when coalesce(v_recipient, v_alert.recipient_profile_id) is not null then 'in_app'
          when v_phone is null or v_phone = '' then 'no_contact'
          else 'unlinked'
        end,
        lat = coalesce(p_lat, v_alert.lat),
        lng = coalesce(p_lng, v_alert.lng),
        accuracy_m = coalesce(p_accuracy_m, v_alert.accuracy_m)
    where id = v_alert.id
    returning * into v_alert;
  end if;

  if v_alert.recipient_profile_id is not null and not exists (
    select 1 from public.app_notifications note where note.safety_alert_id = v_alert.id
  ) then
    insert into public.app_notifications (profile_id, title, body, related_ride_id, safety_alert_id, category)
    values (
      v_alert.recipient_profile_id,
      case when p_alert_type = 'sos' then 'Taxiro SOS alert'
           when p_alert_type = 'late_trip' then 'Taxiro trip delay alert'
           else 'Taxiro route change alert' end,
      coalesce(v_profile.full_name, 'Your emergency contact') || ' may need help during Taxiro ride #' || left(p_ride_id::text, 8) || '. ' || coalesce(v_message, ''),
      p_ride_id,
      v_alert.id,
      'safety'
    );
  end if;

  if not exists (
    select 1 from public.ride_status_events event
    where event.ride_id = p_ride_id and event.note = 'Safety alert created: ' || p_alert_type
      and event.created_at > now() - interval '30 minutes'
  ) then
    insert into public.ride_status_events (ride_id, status, actor_id, note)
    values (p_ride_id, v_ride.status, auth.uid(), 'Safety alert created: ' || p_alert_type);
  end if;

  return v_alert;
end $$;

grant execute on function public.create_safety_alert(uuid, text, text, double precision, double precision, numeric) to authenticated;

create or replace function public.get_emergency_contact_link_status()
returns table(configured boolean, linked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.emergency_contact_phone is not null and public.normalize_phone(profile.emergency_contact_phone) <> '',
    public.match_emergency_contact_profile(profile.id, profile.emergency_contact_phone) is not null
  from public.profiles profile where profile.id = auth.uid();
$$;

grant execute on function public.get_emergency_contact_link_status() to authenticated;

with matched_alerts as (
  select
    alert.id,
    trigger_profile.emergency_contact_phone,
    public.normalize_phone(trigger_profile.emergency_contact_phone) as normalized_phone,
    public.match_emergency_contact_profile(alert.triggered_by, trigger_profile.emergency_contact_phone) as matched_profile_id
  from public.safety_alerts alert
  join public.profiles trigger_profile on trigger_profile.id = alert.triggered_by
  where alert.recipient_profile_id is null
)
update public.safety_alerts alert
set recipient_profile_id = matched_alerts.matched_profile_id,
    recipient_phone = nullif(matched_alerts.normalized_phone, ''),
    delivery_status = case
      when matched_alerts.matched_profile_id is not null then 'in_app'
      when matched_alerts.normalized_phone is null or matched_alerts.normalized_phone = '' then 'no_contact'
      else 'unlinked'
    end
from matched_alerts
where alert.id = matched_alerts.id;

insert into public.app_notifications (profile_id, title, body, related_ride_id, safety_alert_id, category)
select
  alert.recipient_profile_id,
  case when alert.alert_type = 'sos' then 'Taxiro SOS alert'
       when alert.alert_type = 'late_trip' then 'Taxiro trip delay alert'
       else 'Taxiro route change alert' end,
  coalesce(trigger_profile.full_name, 'Your emergency contact') || ' may need help during Taxiro ride #' || left(alert.ride_id::text, 8) || '. ' || alert.message,
  alert.ride_id,
  alert.id,
  'safety'
from public.safety_alerts alert
join public.profiles trigger_profile on trigger_profile.id = alert.triggered_by
where alert.recipient_profile_id is not null
  and not exists (select 1 from public.app_notifications note where note.safety_alert_id = alert.id);

notify pgrst, 'reload schema';
