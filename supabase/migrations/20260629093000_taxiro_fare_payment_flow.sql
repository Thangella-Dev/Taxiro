-- Taxiro fare split, rider UPI QR, and payment confirmation flow.
-- Additive only; preserves existing ride and rider data.

alter table public.ride_requests
  add column if not exists company_commission numeric(10,2),
  add column if not exists rider_earning numeric(10,2),
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ride_requests_payment_status_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_payment_status_check
      check (payment_status in ('pending', 'awaiting_payment', 'paid'));
  end if;
end
$$;

update public.ride_requests
set company_commission = round((fare_estimate * 0.07)::numeric, 2),
    rider_earning = round((fare_estimate - (fare_estimate * 0.07))::numeric, 2)
where fare_estimate is not null
  and (company_commission is null or rider_earning is null);

update public.ride_requests
set payment_status = case
  when status = 'completed' then 'paid'
  else payment_status
end,
payment_confirmed_at = case
  when status = 'completed' and payment_confirmed_at is null then completed_at
  else payment_confirmed_at
end
where status = 'completed';

alter table public.rider_profiles
  add column if not exists upi_id text,
  add column if not exists upi_qr_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rider-upi-qr',
  'rider-upi-qr',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rider upi qr public read'
  ) then
    create policy "rider upi qr public read"
    on storage.objects for select
    using (bucket_id = 'rider-upi-qr');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'riders upload own upi qr'
  ) then
    create policy "riders upload own upi qr"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'riders update own upi qr'
  ) then
    create policy "riders update own upi qr"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    )
    with check (
      bucket_id = 'rider-upi-qr'
      and (storage.foldername(name))[1] = auth.uid()::text
      and public.is_rider()
    );
  end if;
end
$$;

create or replace function public.mark_ride_reached_drop(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
begin
  update public.ride_requests
  set payment_status = 'awaiting_payment'
  where id = p_ride_id
    and assigned_rider_id = auth.uid()
    and status = 'started'
    and payment_status in ('pending', 'awaiting_payment')
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Only the assigned rider can mark a started ride as reached drop';
  end if;

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'awaiting_payment', 'Rider reached drop and is collecting payment');

  return v_ride;
end;
$$;

create or replace function public.confirm_ride_payment_and_complete(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
begin
  update public.ride_requests
  set payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_confirmed_by = auth.uid(),
      status = 'completed',
      completed_at = now()
  where id = p_ride_id
    and assigned_rider_id = auth.uid()
    and status = 'started'
    and payment_status = 'awaiting_payment'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Payment must be awaiting confirmation before completing the ride';
  end if;

  update public.rider_locations
  set is_available = true,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, note)
  values (p_ride_id, 'completed', 'Payment confirmed by rider and ride completed');

  return v_ride;
end;
$$;

create or replace function public.complete_ride(p_ride_id uuid)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.confirm_ride_payment_and_complete(p_ride_id);
end;
$$;

grant execute on function public.mark_ride_reached_drop(uuid) to authenticated;
grant execute on function public.confirm_ride_payment_and_complete(uuid) to authenticated;
grant execute on function public.complete_ride(uuid) to authenticated;
