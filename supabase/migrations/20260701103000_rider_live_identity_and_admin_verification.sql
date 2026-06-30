-- Private rider live-photo capture and admin-gated identity/vehicle verification.

alter table public.rider_profiles
  add column if not exists live_selfie_path text,
  add column if not exists live_selfie_captured_at timestamptz,
  add column if not exists identity_rejection_reason text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rider-verification', 'rider-verification', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders and admins read verification images') then
    create policy "riders and admins read verification images" on storage.objects for select to authenticated
      using (bucket_id='rider-verification' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders upload own verification images') then
    create policy "riders upload own verification images" on storage.objects for insert to authenticated
      with check (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='riders update own verification images') then
    create policy "riders update own verification images" on storage.objects for update to authenticated
      using (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider())
      with check (bucket_id='rider-verification' and (storage.foldername(name))[1]=auth.uid()::text and public.is_rider());
  end if;
end $$;

create or replace function public.guard_rider_identity_verification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    if tg_op='INSERT' then
      new.verification_status := 'pending';
      new.identity_rejection_reason := null;
    elsif new.verification_status is distinct from old.verification_status
       or new.identity_rejection_reason is distinct from old.identity_rejection_reason then
      raise exception 'Identity verification can only be changed by an admin';
    elsif new.live_selfie_path is distinct from old.live_selfie_path then
      new.verification_status := 'pending';
      new.identity_rejection_reason := null;
      new.live_selfie_captured_at := coalesce(new.live_selfie_captured_at, now());
      new.active_vehicle_type := null;
      update public.rider_locations set is_available=false, updated_at=now() where rider_id=new.rider_id;
    end if;
  end if;
  if new.verification_status='verified' and new.live_selfie_path is null then
    raise exception 'A live rider photo is required before identity approval';
  end if;
  if new.verification_status<>'verified' then new.active_vehicle_type := null; end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='rider_identity_verification_guard' and tgrelid='public.rider_profiles'::regclass) then
    create trigger rider_identity_verification_guard before insert or update on public.rider_profiles
      for each row execute function public.guard_rider_identity_verification();
  end if;
end $$;

create or replace function public.require_identity_before_vehicle_verification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.verification_status='verified'
     and (tg_op='INSERT' or old.verification_status is distinct from 'verified')
     and not exists (
       select 1 from public.rider_profiles p where p.rider_id=new.rider_id
       and p.verification_status='verified' and p.live_selfie_path is not null
     ) then
    raise exception 'Approve the rider live identity photo before verifying a vehicle';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='vehicle_requires_verified_identity' and tgrelid='public.rider_vehicles'::regclass) then
    create trigger vehicle_requires_verified_identity before insert or update on public.rider_vehicles
      for each row execute function public.require_identity_before_vehicle_verification();
  end if;
end $$;

comment on column public.rider_profiles.live_selfie_path is 'Private rider live identity capture reviewed by admins.';
notify pgrst, 'reload schema';
