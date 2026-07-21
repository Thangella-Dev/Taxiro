-- Enterprise pricing, revenue, wallet, rewards, and subscription foundation for Taxiro.

do $$
declare
  constraint_name text;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ride_requests') then
    alter table public.ride_requests drop constraint if exists ride_requests_vehicle_type_check;
    alter table public.ride_requests
      add constraint ride_requests_vehicle_type_check
      check (vehicle_type in ('bike','auto','car','hatchback','sedan','suv'));

    alter table public.ride_requests drop constraint if exists ride_requests_vehicle_surcharge_check;
    alter table public.ride_requests
      add constraint ride_requests_vehicle_surcharge_check
      check (vehicle_surcharge_per_km >= 0);

    alter table public.ride_requests drop constraint if exists ride_requests_vehicle_surcharge_matches_type;
    alter table public.ride_requests drop constraint if exists ride_requests_fare_estimate_matches_rate;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rider_profiles') then
    alter table public.rider_profiles drop constraint if exists rider_profiles_active_vehicle_type_check;
    alter table public.rider_profiles
      add constraint rider_profiles_active_vehicle_type_check
      check (active_vehicle_type is null or active_vehicle_type in ('bike','auto','car','hatchback','sedan','suv'));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rider_vehicles') then
    for constraint_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'rider_vehicles'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%vehicle_type%'
    loop
      execute format('alter table public.rider_vehicles drop constraint if exists %I', constraint_name);
    end loop;

    alter table public.rider_vehicles
      add constraint rider_vehicles_vehicle_type_check
      check (vehicle_type in ('bike','auto','car','hatchback','sedan','suv'));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurring_ride_templates') then
    for constraint_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'recurring_ride_templates'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%vehicle_type%'
    loop
      execute format('alter table public.recurring_ride_templates drop constraint if exists %I', constraint_name);
    end loop;

    alter table public.recurring_ride_templates
      add constraint recurring_ride_templates_vehicle_type_check
      check (vehicle_type in ('bike','auto','car','hatchback','sedan','suv'));
  end if;
end $$;

alter table public.service_areas
  alter column supported_vehicle_types set default array['bike','auto','hatchback','sedan','suv']::text[];

alter table public.pricing_rules drop constraint if exists pricing_rules_vehicle_type_check;
alter table public.pricing_rules drop constraint if exists pricing_rules_company_commission_rate_check;
alter table public.pricing_rules
  add constraint pricing_rules_vehicle_type_check
  check (vehicle_type in ('bike','auto','car','hatchback','sedan','suv'));
alter table public.pricing_rules
  add constraint pricing_rules_company_commission_rate_check
  check (company_commission_rate between 0 and 0.30);

alter table public.pricing_rules
  add column if not exists waiting_charge_per_minute numeric not null default 0 check (waiting_charge_per_minute >= 0),
  add column if not exists free_waiting_minutes integer not null default 0 check (free_waiting_minutes >= 0),
  add column if not exists cancellation_fee numeric not null default 0 check (cancellation_fee >= 0),
  add column if not exists driver_cancellation_rules jsonb not null default '{}'::jsonb,
  add column if not exists passenger_cancellation_rules jsonb not null default '{}'::jsonb,
  add column if not exists night_charge_type text not null default 'none',
  add column if not exists night_charge_value numeric not null default 0 check (night_charge_value >= 0),
  add column if not exists airport_pickup_fee numeric not null default 0 check (airport_pickup_fee >= 0),
  add column if not exists toll_charge numeric not null default 0 check (toll_charge >= 0),
  add column if not exists tax_percentage numeric not null default 0 check (tax_percentage between 0 and 1),
  add column if not exists dynamic_surge_multiplier numeric not null default 1 check (dynamic_surge_multiplier >= 1),
  add column if not exists max_surge_multiplier numeric not null default 1.5 check (max_surge_multiplier >= 1),
  add column if not exists subscription_discount_percentage numeric not null default 0 check (subscription_discount_percentage between 0 and 1),
  add column if not exists cashback_percentage numeric not null default 0 check (cashback_percentage between 0 and 1),
  add column if not exists referral_reward_amount numeric not null default 0 check (referral_reward_amount >= 0),
  add column if not exists driver_bonus_pool numeric not null default 0 check (driver_bonus_pool >= 0),
  add column if not exists currency text not null default 'INR';

alter table public.pricing_rules drop constraint if exists pricing_rules_night_charge_type_check;
alter table public.pricing_rules
  add constraint pricing_rules_night_charge_type_check
  check (night_charge_type in ('none','flat','percent'));

alter table public.pricing_rules drop constraint if exists pricing_rules_currency_check;
alter table public.pricing_rules
  add constraint pricing_rules_currency_check
  check (currency = 'INR');

create table if not exists public.surge_rules (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  vehicle_type text check (vehicle_type is null or vehicle_type in ('bike','auto','car','hatchback','sedan','suv')),
  surge_type text not null check (surge_type in ('morning_peak','evening_peak','rain','holiday','festival','demand','night')),
  multiplier numeric not null check (multiplier >= 1 and multiplier <= 1.5),
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays smallint[],
  local_start_time time,
  local_end_time time,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.coupon_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 32),
  discount_type text not null check (discount_type in ('flat','percent')),
  discount_value numeric not null check (discount_value > 0),
  max_discount numeric check (max_discount is null or max_discount >= 0),
  min_fare numeric not null default 0 check (min_fare >= 0),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  allowed_vehicle_types text[] not null default array['bike','auto','hatchback','sedan','suv']::text[],
  first_ride_only boolean not null default false,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_profile_limit integer not null default 1 check (per_profile_limit > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.driver_bonus_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  bonus_type text not null check (bonus_type in ('daily_rides','weekly_rides','peak_hour','airport','night','new_driver','referral','manual')),
  vehicle_type text check (vehicle_type is null or vehicle_type in ('bike','auto','car','hatchback','sedan','suv')),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  target_rides integer check (target_rides is null or target_rides > 0),
  reward_amount numeric not null check (reward_amount > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.referral_reward_rules (
  id uuid primary key default gen_random_uuid(),
  referral_type text not null check (referral_type in ('passenger','driver')),
  referrer_reward_amount numeric not null check (referrer_reward_amount >= 0),
  referee_reward_amount numeric not null default 0 check (referee_reward_amount >= 0),
  required_completed_rides integer not null default 1 check (required_completed_rides > 0),
  wallet_transaction_type text not null default 'referral',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_price numeric not null check (monthly_price >= 0),
  discount_percentage numeric not null default 0 check (discount_percentage between 0 and 1),
  priority_matching boolean not null default false,
  priority_support boolean not null default false,
  free_cancellations_per_month integer not null default 0 check (free_cancellations_per_month >= 0),
  benefits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active','cancelled','expired','paused')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  name text not null,
  tax_percentage numeric not null check (tax_percentage between 0 and 1),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.airport_pricing (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete cascade,
  airport_name text not null,
  center_lat numeric not null check (center_lat between -90 and 90),
  center_lng numeric not null check (center_lng between -180 and 180),
  radius_km numeric not null check (radius_km > 0 and radius_km <= 30),
  pickup_fee numeric not null default 0 check (pickup_fee >= 0),
  drop_fee numeric not null default 0 check (drop_fee >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ride_fare_breakdowns (
  ride_id uuid primary key references public.ride_requests(id) on delete cascade,
  pricing_rule_id uuid references public.pricing_rules(id) on delete set null,
  service_area_id uuid references public.service_areas(id) on delete set null,
  vehicle_type text not null check (vehicle_type in ('bike','auto','car','hatchback','sedan','suv')),
  currency text not null default 'INR' check (currency = 'INR'),
  base_fare numeric not null default 0,
  distance_charge numeric not null default 0,
  time_charge numeric not null default 0,
  waiting_charge numeric not null default 0,
  airport_fee numeric not null default 0,
  toll_charge numeric not null default 0,
  night_charge numeric not null default 0,
  surge_multiplier numeric not null default 1,
  surge_charge numeric not null default 0,
  coupon_discount numeric not null default 0,
  wallet_credit_applied numeric not null default 0,
  tax_amount numeric not null default 0,
  final_fare numeric not null default 0,
  platform_commission numeric not null default 0,
  driver_earning numeric not null default 0,
  cashback_amount numeric not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fare_audit_logs (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  ride_id uuid references public.ride_requests(id) on delete set null,
  pricing_rule_id uuid references public.pricing_rules(id) on delete set null,
  service_area_id uuid references public.service_areas(id) on delete set null,
  vehicle_type text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  payout_method text not null default 'upi' check (payout_method in ('upi','bank','wallet')),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  reference text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists pricing_rules_lookup_idx on public.pricing_rules(service_area_id, vehicle_type, is_active, effective_from desc);
create index if not exists surge_rules_lookup_idx on public.surge_rules(service_area_id, vehicle_type, is_active, priority, created_at desc);
create index if not exists coupon_campaigns_code_idx on public.coupon_campaigns(code) where is_active;
create index if not exists fare_audit_logs_profile_idx on public.fare_audit_logs(profile_id, created_at desc);
create index if not exists driver_payouts_rider_idx on public.driver_payouts(rider_id, requested_at desc);
create index if not exists user_subscriptions_profile_idx on public.user_subscriptions(profile_id, status, ends_at);

alter table public.surge_rules enable row level security;
alter table public.coupon_campaigns enable row level security;
alter table public.driver_bonus_rules enable row level security;
alter table public.referral_reward_rules enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.tax_rules enable row level security;
alter table public.airport_pricing enable row level security;
alter table public.ride_fare_breakdowns enable row level security;
alter table public.fare_audit_logs enable row level security;
alter table public.driver_payouts enable row level security;

drop policy if exists "authenticated read active surge rules" on public.surge_rules;
drop policy if exists "admins manage surge rules" on public.surge_rules;
drop policy if exists "authenticated read active coupons" on public.coupon_campaigns;
drop policy if exists "admins manage coupon campaigns" on public.coupon_campaigns;
drop policy if exists "riders read active bonus rules" on public.driver_bonus_rules;
drop policy if exists "admins manage driver bonus rules" on public.driver_bonus_rules;
drop policy if exists "authenticated read active referral rules" on public.referral_reward_rules;
drop policy if exists "admins manage referral reward rules" on public.referral_reward_rules;
drop policy if exists "authenticated read active subscription plans" on public.subscription_plans;
drop policy if exists "admins manage subscription plans" on public.subscription_plans;
drop policy if exists "profiles read own subscriptions" on public.user_subscriptions;
drop policy if exists "admins manage user subscriptions" on public.user_subscriptions;
drop policy if exists "authenticated read active tax rules" on public.tax_rules;
drop policy if exists "admins manage tax rules" on public.tax_rules;
drop policy if exists "authenticated read active airport pricing" on public.airport_pricing;
drop policy if exists "admins manage airport pricing" on public.airport_pricing;
drop policy if exists "ride participants read fare breakdowns" on public.ride_fare_breakdowns;
drop policy if exists "admins read fare audit logs" on public.fare_audit_logs;
drop policy if exists "riders read own payouts" on public.driver_payouts;
drop policy if exists "admins manage driver payouts" on public.driver_payouts;

create policy "authenticated read active surge rules" on public.surge_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage surge rules" on public.surge_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active coupons" on public.coupon_campaigns for select to authenticated using (is_active or public.is_admin());
create policy "admins manage coupon campaigns" on public.coupon_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "riders read active bonus rules" on public.driver_bonus_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage driver bonus rules" on public.driver_bonus_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active referral rules" on public.referral_reward_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage referral reward rules" on public.referral_reward_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active subscription plans" on public.subscription_plans for select to authenticated using (is_active or public.is_admin());
create policy "admins manage subscription plans" on public.subscription_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles read own subscriptions" on public.user_subscriptions for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "admins manage user subscriptions" on public.user_subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active tax rules" on public.tax_rules for select to authenticated using (is_active or public.is_admin());
create policy "admins manage tax rules" on public.tax_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read active airport pricing" on public.airport_pricing for select to authenticated using (is_active or public.is_admin());
create policy "admins manage airport pricing" on public.airport_pricing for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ride participants read fare breakdowns" on public.ride_fare_breakdowns for select to authenticated using (public.is_admin() or exists (select 1 from public.ride_requests ride where ride.id = ride_fare_breakdowns.ride_id and (ride.user_id = auth.uid() or ride.assigned_rider_id = auth.uid())));
create policy "admins read fare audit logs" on public.fare_audit_logs for select to authenticated using (public.is_admin());
create policy "riders read own payouts" on public.driver_payouts for select to authenticated using (rider_id = auth.uid() or public.is_admin());
create policy "admins manage driver payouts" on public.driver_payouts for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.pricing_rules (
  service_area_id,
  vehicle_type,
  base_fare,
  per_km_rate,
  per_minute_rate,
  minimum_fare,
  waiting_charge_per_minute,
  free_waiting_minutes,
  cancellation_fee,
  company_commission_rate,
  dynamic_surge_multiplier,
  max_surge_multiplier,
  currency,
  is_active
)
select null, seed.vehicle_type, seed.base_fare, seed.per_km_rate, seed.per_minute_rate, seed.minimum_fare, seed.waiting_charge_per_minute, 3, 20, 0.07, 1, 1.5, 'INR', true
from (
  values
    ('bike', 20::numeric, 7::numeric, 1::numeric, 30::numeric, 1::numeric),
    ('auto', 25::numeric, 10::numeric, 1.5::numeric, 40::numeric, 1.5::numeric),
    ('hatchback', 35::numeric, 14::numeric, 2::numeric, 60::numeric, 2::numeric),
    ('sedan', 45::numeric, 17::numeric, 2::numeric, 80::numeric, 2::numeric),
    ('suv', 60::numeric, 22::numeric, 3::numeric, 120::numeric, 3::numeric)
) as seed(vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, waiting_charge_per_minute)
where not exists (
  select 1 from public.pricing_rules rule
  where rule.service_area_id is null
    and rule.vehicle_type = seed.vehicle_type
);

insert into public.surge_rules (surge_type, multiplier, local_start_time, local_end_time, is_active)
select seed.surge_type, seed.multiplier, seed.local_start_time, seed.local_end_time, true
from (
  values
    ('morning_peak', 1.3::numeric, '09:00'::time, '10:30'::time),
    ('evening_peak', 1.3::numeric, '17:00'::time, '18:00'::time),
    ('night', 1.3::numeric, '22:00'::time, '23:59'::time)
) as seed(surge_type, multiplier, local_start_time, local_end_time)
where not exists (
  select 1 from public.surge_rules rule
  where rule.service_area_id is null
    and rule.vehicle_type is null
    and rule.surge_type = seed.surge_type
    and rule.local_start_time = seed.local_start_time
);

insert into public.subscription_plans (
  name,
  monthly_price,
  discount_percentage,
  priority_matching,
  priority_support,
  free_cancellations_per_month,
  benefits,
  is_active
)
select 'Taxiro Plus', 99, 0.10, true, true, 1, '{"special_promotions": true}'::jsonb, true
where not exists (select 1 from public.subscription_plans where name = 'Taxiro Plus');

insert into public.referral_reward_rules (
  referral_type,
  referrer_reward_amount,
  referee_reward_amount,
  required_completed_rides,
  wallet_transaction_type,
  is_active
)
select seed.referral_type, seed.referrer_reward_amount, seed.referee_reward_amount, seed.required_completed_rides, 'referral', true
from (
  values
    ('passenger', 50::numeric, 50::numeric, 1),
    ('driver', 500::numeric, 0::numeric, 50)
) as seed(referral_type, referrer_reward_amount, referee_reward_amount, required_completed_rides)
where not exists (
  select 1 from public.referral_reward_rules rule
  where rule.referral_type = seed.referral_type
);

create or replace function public.calculate_taxiro_fare(
  p_vehicle_type text,
  p_distance_km numeric,
  p_duration_min numeric default 0,
  p_waiting_min numeric default 0,
  p_pickup_lat numeric default null,
  p_pickup_lng numeric default null,
  p_drop_lat numeric default null,
  p_drop_lng numeric default null,
  p_coupon_code text default null,
  p_wallet_credit numeric default 0,
  p_is_airport_pickup boolean default false,
  p_toll_charge numeric default 0,
  p_at timestamptz default now(),
  p_profile_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_vehicle text := lower(trim(coalesce(p_vehicle_type, '')));
  resolved_vehicle text;
  matched_area public.service_areas%rowtype;
  matched_rule public.pricing_rules%rowtype;
  matched_coupon public.coupon_campaigns%rowtype;
  matched_subscription public.subscription_plans%rowtype;
  active_surge numeric := 1;
  capped_surge numeric := 1;
  local_time time := (p_at at time zone 'Asia/Kolkata')::time;
  local_weekday smallint := extract(dow from (p_at at time zone 'Asia/Kolkata'))::smallint;
  billable_waiting numeric;
  base_fare numeric;
  distance_charge numeric;
  time_charge numeric;
  waiting_charge numeric;
  airport_fee numeric;
  toll_fee numeric;
  night_charge numeric := 0;
  subtotal_before_surge numeric;
  subtotal_after_surge numeric;
  surge_charge numeric;
  coupon_discount numeric := 0;
  subscription_discount numeric := 0;
  wallet_credit numeric := 0;
  taxable_amount numeric;
  tax_amount numeric;
  final_fare numeric;
  platform_commission numeric;
  driver_earning numeric;
  cashback_amount numeric;
  response jsonb;
begin
  if normalized_vehicle = 'car' then
    resolved_vehicle := 'sedan';
  else
    resolved_vehicle := normalized_vehicle;
  end if;

  if resolved_vehicle not in ('bike','auto','hatchback','sedan','suv') then
    raise exception 'Unsupported vehicle type: %', p_vehicle_type using errcode = '22023';
  end if;

  if p_distance_km is null or p_distance_km < 0 then
    raise exception 'Distance must be a non-negative number' using errcode = '22023';
  end if;

  if coalesce(p_duration_min, 0) < 0 or coalesce(p_waiting_min, 0) < 0 then
    raise exception 'Duration and waiting minutes must be non-negative' using errcode = '22023';
  end if;

  if p_pickup_lat is not null and p_pickup_lng is not null then
    select *
    into matched_area
    from public.service_areas area
    where area.is_active
      and (resolved_vehicle = any(area.supported_vehicle_types) or normalized_vehicle = any(area.supported_vehicle_types))
      and (
        6371 * 2 * asin(
          sqrt(
            power(sin(radians((p_pickup_lat - area.center_lat) / 2)), 2) +
            cos(radians(area.center_lat)) * cos(radians(p_pickup_lat)) *
            power(sin(radians((p_pickup_lng - area.center_lng) / 2)), 2)
          )
        )
      ) <= area.radius_km
    order by area.radius_km asc, area.updated_at desc
    limit 1;
  end if;

  select *
  into matched_rule
  from public.pricing_rules rule
  where rule.is_active
    and coalesce(rule.service_area_id, matched_area.id) is not distinct from matched_area.id
    and (rule.vehicle_type = resolved_vehicle or rule.vehicle_type = normalized_vehicle)
    and rule.effective_from <= p_at
    and (rule.effective_until is null or rule.effective_until > p_at)
  order by rule.service_area_id nulls last, rule.effective_from desc
  limit 1;

  if matched_rule.id is null then
    select *
    into matched_rule
    from public.pricing_rules rule
    where rule.is_active
      and rule.service_area_id is null
      and (rule.vehicle_type = resolved_vehicle or rule.vehicle_type = normalized_vehicle)
      and rule.effective_from <= p_at
      and (rule.effective_until is null or rule.effective_until > p_at)
    order by rule.effective_from desc
    limit 1;
  end if;

  if matched_rule.id is null then
    raise exception 'No active pricing rule for vehicle %', resolved_vehicle using errcode = 'P0002';
  end if;

  select coalesce(max(rule.multiplier), 1)
  into active_surge
  from public.surge_rules rule
  where rule.is_active
    and (rule.service_area_id is null or rule.service_area_id = matched_area.id)
    and (rule.vehicle_type is null or rule.vehicle_type = resolved_vehicle or rule.vehicle_type = normalized_vehicle)
    and (rule.starts_at is null or rule.starts_at <= p_at)
    and (rule.ends_at is null or rule.ends_at > p_at)
    and (rule.weekdays is null or local_weekday = any(rule.weekdays))
    and (
      rule.local_start_time is null
      or rule.local_end_time is null
      or (rule.local_start_time <= rule.local_end_time and local_time >= rule.local_start_time and local_time < rule.local_end_time)
      or (rule.local_start_time > rule.local_end_time and (local_time >= rule.local_start_time or local_time < rule.local_end_time))
    );

  capped_surge := least(coalesce(active_surge, 1), least(matched_rule.max_surge_multiplier, 1.5), 1.5);
  billable_waiting := greatest(coalesce(p_waiting_min, 0) - matched_rule.free_waiting_minutes, 0);
  base_fare := matched_rule.base_fare;
  distance_charge := coalesce(p_distance_km, 0) * matched_rule.per_km_rate;
  time_charge := coalesce(p_duration_min, 0) * matched_rule.per_minute_rate;
  waiting_charge := billable_waiting * matched_rule.waiting_charge_per_minute;
  airport_fee := case when p_is_airport_pickup then matched_rule.airport_pickup_fee else 0 end;
  toll_fee := greatest(coalesce(p_toll_charge, 0), matched_rule.toll_charge);

  if matched_rule.night_charge_type = 'flat' and (local_time >= '22:00'::time or local_time < '05:00'::time) then
    night_charge := matched_rule.night_charge_value;
  elsif matched_rule.night_charge_type = 'percent' and (local_time >= '22:00'::time or local_time < '05:00'::time) then
    night_charge := (base_fare + distance_charge + time_charge + waiting_charge) * matched_rule.night_charge_value;
  end if;

  subtotal_before_surge := base_fare + distance_charge + time_charge + waiting_charge + airport_fee + toll_fee + night_charge;
  surge_charge := greatest(subtotal_before_surge * capped_surge - subtotal_before_surge, 0);
  subtotal_after_surge := subtotal_before_surge + surge_charge;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select *
    into matched_coupon
    from public.coupon_campaigns coupon
    where coupon.is_active
      and coupon.code = upper(trim(p_coupon_code))
      and (coupon.service_area_id is null or coupon.service_area_id = matched_area.id)
      and (resolved_vehicle = any(coupon.allowed_vehicle_types) or normalized_vehicle = any(coupon.allowed_vehicle_types))
      and coupon.starts_at <= p_at
      and (coupon.ends_at is null or coupon.ends_at > p_at)
      and subtotal_after_surge >= coupon.min_fare
    order by coupon.created_at desc
    limit 1;

    if matched_coupon.id is not null then
      if matched_coupon.discount_type = 'flat' then
        coupon_discount := matched_coupon.discount_value;
      else
        coupon_discount := subtotal_after_surge * matched_coupon.discount_value;
      end if;
      if matched_coupon.max_discount is not null then
        coupon_discount := least(coupon_discount, matched_coupon.max_discount);
      end if;
    end if;
  end if;

  if p_profile_id is not null then
    select plan.*
    into matched_subscription
    from public.user_subscriptions sub
    join public.subscription_plans plan on plan.id = sub.plan_id
    where sub.profile_id = p_profile_id
      and sub.status = 'active'
      and plan.is_active
      and sub.starts_at <= p_at
      and (sub.ends_at is null or sub.ends_at > p_at)
    order by sub.created_at desc
    limit 1;

    if matched_subscription.id is not null then
      subscription_discount := subtotal_after_surge * matched_subscription.discount_percentage;
    end if;
  end if;

  coupon_discount := least(greatest(coupon_discount + subscription_discount, 0), subtotal_after_surge);
  wallet_credit := least(greatest(coalesce(p_wallet_credit, 0), 0), subtotal_after_surge - coupon_discount);
  taxable_amount := greatest(subtotal_after_surge - coupon_discount - wallet_credit, 0);
  tax_amount := taxable_amount * matched_rule.tax_percentage;
  final_fare := greatest(matched_rule.minimum_fare, taxable_amount + tax_amount);
  final_fare := round(final_fare);
  platform_commission := round(final_fare * matched_rule.company_commission_rate);
  driver_earning := final_fare - platform_commission;
  cashback_amount := round(final_fare * matched_rule.cashback_percentage);

  response := jsonb_build_object(
    'vehicle_type', resolved_vehicle,
    'currency', matched_rule.currency,
    'service_area_id', matched_area.id,
    'pricing_rule_id', matched_rule.id,
    'base_fare', round(base_fare, 2),
    'distance_charge', round(distance_charge, 2),
    'time_charge', round(time_charge, 2),
    'waiting_charge', round(waiting_charge, 2),
    'free_waiting_minutes', matched_rule.free_waiting_minutes,
    'airport_fee', round(airport_fee, 2),
    'toll_charge', round(toll_fee, 2),
    'night_charge', round(night_charge, 2),
    'subtotal_before_surge', round(subtotal_before_surge, 2),
    'surge_multiplier', round(capped_surge, 2),
    'surge_charge', round(surge_charge, 2),
    'coupon_discount', round(coupon_discount, 2),
    'wallet_credit_applied', round(wallet_credit, 2),
    'tax_amount', round(tax_amount, 2),
    'minimum_fare', matched_rule.minimum_fare,
    'final_fare', final_fare,
    'company_commission_rate', matched_rule.company_commission_rate,
    'platform_commission', platform_commission,
    'driver_earning', driver_earning,
    'cashback_amount', cashback_amount,
    'rule_snapshot', to_jsonb(matched_rule)
  );

  insert into public.fare_audit_logs (
    profile_id,
    pricing_rule_id,
    service_area_id,
    vehicle_type,
    request_payload,
    response_payload
  )
  values (
    p_profile_id,
    matched_rule.id,
    matched_area.id,
    resolved_vehicle,
    jsonb_build_object(
      'vehicle_type', p_vehicle_type,
      'distance_km', p_distance_km,
      'duration_min', p_duration_min,
      'waiting_min', p_waiting_min,
      'pickup_lat', p_pickup_lat,
      'pickup_lng', p_pickup_lng,
      'drop_lat', p_drop_lat,
      'drop_lng', p_drop_lng,
      'coupon_code_present', p_coupon_code is not null,
      'wallet_credit', p_wallet_credit,
      'is_airport_pickup', p_is_airport_pickup,
      'toll_charge', p_toll_charge
    ),
    response
  );

  return response;
end;
$$;

create or replace function public.attach_ride_fare_breakdown(
  p_ride_id uuid,
  p_breakdown jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ride public.ride_requests%rowtype;
begin
  select * into target_ride
  from public.ride_requests
  where id = p_ride_id;

  if target_ride.id is null then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;

  if target_ride.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed to update this ride fare' using errcode = '42501';
  end if;

  insert into public.ride_fare_breakdowns (
    ride_id,
    pricing_rule_id,
    service_area_id,
    vehicle_type,
    currency,
    base_fare,
    distance_charge,
    time_charge,
    waiting_charge,
    airport_fee,
    toll_charge,
    night_charge,
    surge_multiplier,
    surge_charge,
    coupon_discount,
    wallet_credit_applied,
    tax_amount,
    final_fare,
    platform_commission,
    driver_earning,
    cashback_amount,
    breakdown
  )
  values (
    p_ride_id,
    nullif(p_breakdown->>'pricing_rule_id', '')::uuid,
    nullif(p_breakdown->>'service_area_id', '')::uuid,
    coalesce(p_breakdown->>'vehicle_type', target_ride.vehicle_type),
    coalesce(p_breakdown->>'currency', 'INR'),
    coalesce((p_breakdown->>'base_fare')::numeric, 0),
    coalesce((p_breakdown->>'distance_charge')::numeric, 0),
    coalesce((p_breakdown->>'time_charge')::numeric, 0),
    coalesce((p_breakdown->>'waiting_charge')::numeric, 0),
    coalesce((p_breakdown->>'airport_fee')::numeric, 0),
    coalesce((p_breakdown->>'toll_charge')::numeric, 0),
    coalesce((p_breakdown->>'night_charge')::numeric, 0),
    coalesce((p_breakdown->>'surge_multiplier')::numeric, 1),
    coalesce((p_breakdown->>'surge_charge')::numeric, 0),
    coalesce((p_breakdown->>'coupon_discount')::numeric, 0),
    coalesce((p_breakdown->>'wallet_credit_applied')::numeric, 0),
    coalesce((p_breakdown->>'tax_amount')::numeric, 0),
    coalesce((p_breakdown->>'final_fare')::numeric, target_ride.fare_estimate, 0),
    coalesce((p_breakdown->>'platform_commission')::numeric, target_ride.company_commission, 0),
    coalesce((p_breakdown->>'driver_earning')::numeric, target_ride.rider_earning, 0),
    coalesce((p_breakdown->>'cashback_amount')::numeric, 0),
    p_breakdown
  )
  on conflict (ride_id) do update set
    pricing_rule_id = excluded.pricing_rule_id,
    service_area_id = excluded.service_area_id,
    vehicle_type = excluded.vehicle_type,
    currency = excluded.currency,
    base_fare = excluded.base_fare,
    distance_charge = excluded.distance_charge,
    time_charge = excluded.time_charge,
    waiting_charge = excluded.waiting_charge,
    airport_fee = excluded.airport_fee,
    toll_charge = excluded.toll_charge,
    night_charge = excluded.night_charge,
    surge_multiplier = excluded.surge_multiplier,
    surge_charge = excluded.surge_charge,
    coupon_discount = excluded.coupon_discount,
    wallet_credit_applied = excluded.wallet_credit_applied,
    tax_amount = excluded.tax_amount,
    final_fare = excluded.final_fare,
    platform_commission = excluded.platform_commission,
    driver_earning = excluded.driver_earning,
    cashback_amount = excluded.cashback_amount,
    breakdown = excluded.breakdown,
    created_at = now();
end;
$$;

grant execute on function public.calculate_taxiro_fare(text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,numeric,boolean,numeric,timestamptz,uuid) to authenticated;
grant execute on function public.attach_ride_fare_breakdown(uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
