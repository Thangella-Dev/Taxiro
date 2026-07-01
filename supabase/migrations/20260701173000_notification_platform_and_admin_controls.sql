-- Notification platform, admin broadcasts, account controls, and ride lifecycle alerts.

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.app_notifications
  add column if not exists category text not null default 'system',
  add column if not exists created_by uuid references public.profiles(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_account_status_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname='app_notifications_category_check' and conrelid='public.app_notifications'::regclass) then
    alter table public.app_notifications add constraint app_notifications_category_check check (category in ('system','ride','safety','admin'));
  end if;
end $$;

create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 3 and 80),
  body text not null check (char_length(trim(body)) between 5 and 500),
  audience text not null check (audience in ('all','users','riders')),
  delivered_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.admin_broadcasts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_broadcasts' and policyname='admins manage broadcasts') then
    create policy "admins manage broadcasts" on public.admin_broadcasts for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create or replace function public.admin_send_notification(p_title text,p_body text,p_audience text default 'all')
returns public.admin_broadcasts
language plpgsql security definer set search_path=public as $$
declare
  broadcast public.admin_broadcasts;
  delivered integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_audience not in ('all','users','riders') then raise exception 'Invalid notification audience'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 80 then raise exception 'Title must be 3 to 80 characters'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 5 and 500 then raise exception 'Message must be 5 to 500 characters'; end if;

  insert into public.admin_broadcasts(created_by,title,body,audience)
  values(auth.uid(),trim(p_title),trim(p_body),p_audience) returning * into broadcast;

  insert into public.app_notifications(profile_id,title,body,category,created_by)
  select profile.id,broadcast.title,broadcast.body,'admin',auth.uid()
  from public.profiles profile
  where profile.account_status='active'
    and (p_audience='all' or (p_audience='users' and profile.role='user') or (p_audience='riders' and profile.role='rider'));
  get diagnostics delivered = row_count;

  update public.admin_broadcasts set delivered_count=delivered where id=broadcast.id returning * into broadcast;
  return broadcast;
end $$;

create or replace function public.admin_set_account_status(p_profile_id uuid,p_status text)
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare updated_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_profile_id=auth.uid() then raise exception 'Admins cannot suspend their own account'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid account status'; end if;
  update public.profiles set account_status=p_status where id=p_profile_id returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Profile not found'; end if;
  if p_status='suspended' then
    update public.rider_locations set is_available=false,updated_at=now() where rider_id=p_profile_id;
  end if;
  return updated_profile;
end $$;

create or replace function public.notify_ride_lifecycle()
returns trigger
language plpgsql security definer set search_path=public as $$
declare rider_name text;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.assigned_rider_id is not null then select full_name into rider_name from public.profiles where id=new.assigned_rider_id; end if;

  if new.status='assigned' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Rider assigned',coalesce(rider_name,'Your rider')||' accepted your '||initcap(new.vehicle_type)||' ride and is coming to pickup.',new.id,'ride');
  elsif new.status='started' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Trip started','Your ride code was verified. Live tracking now follows the destination route.',new.id,'ride');
  elsif new.status='completed' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Ride completed','Your Taxiro ride is complete. Thank you for riding with us.',new.id,'ride');
  elsif new.status='cancelled' then
    insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
    values(new.user_id,'Ride cancelled','Ride '||left(new.id::text,8)||' was cancelled.',new.id,'ride');
    if new.assigned_rider_id is not null then
      insert into public.app_notifications(profile_id,title,body,related_ride_id,category)
      values(new.assigned_rider_id,'Ride cancelled','Your assigned ride was cancelled and you can receive new requests.',new.id,'ride');
    end if;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='notify_ride_lifecycle' and tgrelid='public.ride_requests'::regclass) then
    create trigger notify_ride_lifecycle after update of status on public.ride_requests
      for each row execute function public.notify_ride_lifecycle();
  end if;
end $$;

create or replace function public.admin_update_safety_alert_status(p_alert_id uuid,p_status text)
returns public.safety_alerts
language plpgsql security definer set search_path=public as $$
declare updated_alert public.safety_alerts;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('open','acknowledged','resolved') then raise exception 'Invalid safety status'; end if;
  update public.safety_alerts
  set status=p_status,resolved_at=case when p_status='resolved' then now() else null end
  where id=p_alert_id returning * into updated_alert;
  if updated_alert.id is null then raise exception 'Safety alert not found'; end if;
  return updated_alert;
end $$;
create or replace function public.get_emergency_contact_link_status()
returns table(configured boolean,linked boolean)
language sql stable security definer set search_path=public as $$
  select
    profile.emergency_contact_phone is not null,
    exists (
      select 1 from public.profiles contact
      where contact.id<>profile.id
        and public.normalize_phone(contact.phone)=public.normalize_phone(profile.emergency_contact_phone)
        and contact.account_status='active'
    )
  from public.profiles profile where profile.id=auth.uid();
$$;
grant select on public.admin_broadcasts to authenticated;
grant execute on function public.admin_send_notification(text,text,text) to authenticated;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;
grant execute on function public.admin_update_safety_alert_status(uuid,text) to authenticated;
grant execute on function public.get_emergency_contact_link_status() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_broadcasts') then
    alter publication supabase_realtime add table public.admin_broadcasts;
  end if;
end $$;

notify pgrst, 'reload schema';
