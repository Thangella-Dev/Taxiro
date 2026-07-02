-- Repair SOS delivery when an emergency contact phone exists in Auth metadata
-- but is missing or formatted differently in public.profiles.
-- Additive only: no tables or user data are deleted.

update public.profiles profile
set phone = public.normalize_phone(
      coalesce(
        nullif(auth_user.phone, ''),
        nullif(auth_user.raw_user_meta_data ->> 'phone', '')
      )
    )
from auth.users auth_user
where auth_user.id = profile.id
  and (profile.phone is null or public.normalize_phone(profile.phone) = '')
  and public.normalize_phone(
        coalesce(
          nullif(auth_user.phone, ''),
          nullif(auth_user.raw_user_meta_data ->> 'phone', '')
        )
      ) <> '';

create or replace function public.match_emergency_contact_profile(
  p_owner_id uuid,
  p_phone text
)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  with input as (
    select public.normalize_phone(p_phone) as normalized_phone
  ),
  candidates as (
    select
      profile.id,
      nullif(public.normalize_phone(profile.phone), '') as profile_phone,
      nullif(public.normalize_phone(auth_user.phone), '') as auth_phone,
      nullif(public.normalize_phone(auth_user.raw_user_meta_data ->> 'phone'), '') as metadata_phone,
      profile.created_at
    from public.profiles profile
    left join auth.users auth_user on auth_user.id = profile.id
    where profile.id <> p_owner_id
      and profile.account_status = 'active'
  )
  select candidate.id
  from candidates candidate
  cross join input
  where input.normalized_phone is not null
    and input.normalized_phone <> ''
    and (
      candidate.profile_phone = input.normalized_phone
      or candidate.auth_phone = input.normalized_phone
      or candidate.metadata_phone = input.normalized_phone
      or (length(input.normalized_phone) >= 10 and right(candidate.profile_phone, 10) = right(input.normalized_phone, 10))
      or (length(input.normalized_phone) >= 10 and right(candidate.auth_phone, 10) = right(input.normalized_phone, 10))
      or (length(input.normalized_phone) >= 10 and right(candidate.metadata_phone, 10) = right(input.normalized_phone, 10))
    )
  order by
    case
      when candidate.profile_phone = input.normalized_phone
        or candidate.auth_phone = input.normalized_phone
        or candidate.metadata_phone = input.normalized_phone then 0
      else 1
    end,
    candidate.created_at desc
  limit 1;
$$;

revoke all on function public.match_emergency_contact_profile(uuid, text) from public;
grant execute on function public.match_emergency_contact_profile(uuid, text) to authenticated;

with repaired as (
  select
    alert.id,
    public.match_emergency_contact_profile(
      alert.triggered_by,
      owner_profile.emergency_contact_phone
    ) as recipient_profile_id,
    public.normalize_phone(owner_profile.emergency_contact_phone) as recipient_phone
  from public.safety_alerts alert
  join public.profiles owner_profile on owner_profile.id = alert.triggered_by
  where alert.recipient_profile_id is null
)
update public.safety_alerts alert
set recipient_profile_id = repaired.recipient_profile_id,
    recipient_phone = nullif(repaired.recipient_phone, ''),
    delivery_status = case
      when repaired.recipient_profile_id is not null then 'in_app'
      when repaired.recipient_phone is null or repaired.recipient_phone = '' then 'no_contact'
      else 'unlinked'
    end
from repaired
where repaired.id = alert.id;

insert into public.app_notifications (
  profile_id,
  title,
  body,
  related_ride_id,
  safety_alert_id,
  category
)
select
  alert.recipient_profile_id,
  case
    when alert.alert_type = 'sos' then 'Taxiro SOS alert'
    when alert.alert_type = 'late_trip' then 'Taxiro trip delay alert'
    else 'Taxiro route change alert'
  end,
  coalesce(owner_profile.full_name, 'Your emergency contact')
    || ' may need help during Taxiro ride #'
    || left(alert.ride_id::text, 8)
    || '. '
    || alert.message,
  alert.ride_id,
  alert.id,
  'safety'
from public.safety_alerts alert
join public.profiles owner_profile on owner_profile.id = alert.triggered_by
where alert.recipient_profile_id is not null
  and not exists (
    select 1
    from public.app_notifications notification
    where notification.safety_alert_id = alert.id
      and notification.profile_id = alert.recipient_profile_id
  );

notify pgrst, 'reload schema';
