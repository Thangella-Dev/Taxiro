-- Additive production operations and product-expansion foundation for Taxiro.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  related_ride_id uuid references public.ride_requests(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('account','ride','payment','safety','rider','technical','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_user','resolved','closed')),
  subject text not null check (char_length(subject) between 4 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles(id),
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 60),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  center_lat numeric not null check (center_lat between -90 and 90),
  center_lng numeric not null check (center_lng between -180 and 180),
  radius_km numeric not null check (radius_km > 0 and radius_km <= 250),
  supported_vehicle_types text[] not null default array['bike','auto','car']::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike','auto','car')),
  base_fare numeric not null default 0 check (base_fare >= 0),
  per_km_rate numeric not null check (per_km_rate > 0),
  per_minute_rate numeric not null default 0 check (per_minute_rate >= 0),
  minimum_fare numeric not null default 0 check (minimum_fare >= 0),
  company_commission_rate numeric not null default 0.07 check (company_commission_rate between 0 and 1),
  peak_windows jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  ride_id uuid references public.ride_requests(id) on delete set null,
  signal_type text not null check (signal_type in ('impossible_speed','location_jump','mock_location','repeat_cancellation','payment_dispute','account_abuse','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewing','dismissed','confirmed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  address text not null check (char_length(address) between 3 and 300),
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique(profile_id, label)
);

create table if not exists public.ride_stops (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  stop_order smallint not null check (stop_order between 1 and 5),
  address text not null,
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  reached_at timestamptz,
  created_at timestamptz not null default now(),
  unique(ride_id, stop_order)
);

create table if not exists public.recurring_ride_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike','auto','car')),
  pickup_address text not null,
  pickup_lat numeric not null,
  pickup_lng numeric not null,
  drop_address text not null,
  drop_lat numeric not null,
  drop_lng numeric not null,
  local_time time not null,
  weekdays smallint[] not null,
  next_run_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  recipient_name text,
  recipient_phone text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 24),
  discount_type text not null check (discount_type in ('flat','percent')),
  discount_value numeric not null check (discount_value > 0),
  max_discount numeric,
  minimum_fare numeric not null default 0,
  usage_limit integer,
  per_profile_limit integer not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes(id),
  profile_id uuid not null references public.profiles(id),
  ride_id uuid not null references public.ride_requests(id),
  discount_amount numeric not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique(promo_id, ride_id)
);

create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid references public.ride_requests(id) on delete set null,
  amount numeric not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('credit','ride_debit','refund','promo','adjustment')),
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.rider_incentives (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_rides integer not null check (target_rides > 0),
  reward_amount numeric not null check (reward_amount > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  completed_rides integer not null default 0,
  status text not null default 'active' check (status in ('active','earned','expired','paid')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_email text not null,
  owner_profile_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.business_account_members (
  business_account_id uuid not null references public.business_accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','manager','member')),
  created_at timestamptz not null default now(),
  primary key (business_account_id, profile_id)
);

create index if not exists support_tickets_owner_status_idx on public.support_tickets(created_by, status, created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists fraud_signals_status_idx on public.fraud_signals(status, severity, created_at desc);
create index if not exists saved_places_profile_idx on public.saved_places(profile_id, created_at desc);
create index if not exists trip_shares_token_idx on public.trip_shares(share_token) where revoked_at is null;
create index if not exists wallet_transactions_profile_idx on public.wallet_transactions(profile_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.service_areas enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.fraud_signals enable row level security;
alter table public.saved_places enable row level security;
alter table public.ride_stops enable row level security;
alter table public.recurring_ride_templates enable row level security;
alter table public.trip_shares enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.rider_incentives enable row level security;
alter table public.business_accounts enable row level security;
alter table public.business_account_members enable row level security;

drop policy if exists "owners and admins read support tickets" on public.support_tickets;
drop policy if exists "users create support tickets" on public.support_tickets;
drop policy if exists "admins update support tickets" on public.support_tickets;

create policy "owners and admins read support tickets" on public.support_tickets for select to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "users create support tickets" on public.support_tickets for insert to authenticated with check (created_by = auth.uid());
create policy "admins update support tickets" on public.support_tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated using (public.is_admin());
create policy "admins write audit logs" on public.admin_audit_logs for insert to authenticated with check (admin_id = auth.uid() and public.is_admin());
create policy "authenticated read active service areas" on public.service_areas for select to authenticated using (is_active or public.is_admin());
create policy "admins manage service areas" on public.service_areas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active pricing" on public.pricing_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage pricing" on public.pricing_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage fraud signals" on public.fraud_signals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles manage saved places" on public.saved_places for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "ride participants read stops" on public.ride_stops for select to authenticated using (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or ride.assigned_rider_id = auth.uid() or public.is_admin())));
create policy "ride owners manage stops" on public.ride_stops for all to authenticated using (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.ride_requests ride where ride.id = ride_stops.ride_id and (ride.user_id = auth.uid() or public.is_admin())));
create policy "profiles manage recurring rides" on public.recurring_ride_templates for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "owners manage trip shares" on public.trip_shares for all to authenticated using (shared_by = auth.uid() or public.is_admin()) with check (shared_by = auth.uid() or public.is_admin());
create policy "authenticated read active promos" on public.promo_codes for select to authenticated using ((is_active and starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_admin());
create policy "admins manage promos" on public.promo_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles read promo redemptions" on public.promo_redemptions for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "profiles read wallets" on public.wallets for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "profiles read wallet transactions" on public.wallet_transactions for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "riders read own incentives" on public.rider_incentives for select to authenticated using (rider_id = auth.uid() or public.is_admin());
create policy "admins manage incentives" on public.rider_incentives for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "business owners read account" on public.business_accounts for select to authenticated using (owner_profile_id = auth.uid() or public.is_admin());
create policy "business owners manage account" on public.business_accounts for all to authenticated using (owner_profile_id = auth.uid() or public.is_admin()) with check (owner_profile_id = auth.uid() or public.is_admin());
create policy "business members read membership" on public.business_account_members for select to authenticated using (profile_id = auth.uid() or public.is_admin() or exists (select 1 from public.business_accounts account where account.id = business_account_members.business_account_id and account.owner_profile_id = auth.uid()));

create or replace function public.create_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'other',
  p_related_ride_id uuid default null
) returns public.support_tickets
language plpgsql security invoker set search_path = public as $$
declare created public.support_tickets;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.support_tickets(created_by, related_ride_id, category, subject, description)
  values (auth.uid(), p_related_ride_id, p_category, trim(p_subject), trim(p_description)) returning * into created;
  return created;
end;
$$;

create or replace function public.create_trip_share(p_ride_id uuid, p_recipient_name text default null, p_recipient_phone text default null)
returns public.trip_shares language plpgsql security invoker set search_path = public as $$
declare created public.trip_shares;
begin
  if not exists (select 1 from public.ride_requests where id = p_ride_id and user_id = auth.uid()) then
    raise exception 'Ride not found or access denied';
  end if;
  insert into public.trip_shares(ride_id, shared_by, recipient_name, recipient_phone)
  values (p_ride_id, auth.uid(), nullif(trim(p_recipient_name), ''), nullif(trim(p_recipient_phone), '')) returning * into created;
  return created;
end;
$$;

grant execute on function public.create_support_ticket(text,text,text,uuid) to authenticated;
grant execute on function public.create_trip_share(uuid,text,text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
