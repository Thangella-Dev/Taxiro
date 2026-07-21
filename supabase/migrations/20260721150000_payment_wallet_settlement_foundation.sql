do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'ride_requests'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%payment_method%'
  loop
    execute format('alter table public.ride_requests drop constraint if exists %I', constraint_name);
  end loop;

  alter table public.ride_requests
    add constraint ride_requests_payment_method_check
    check (payment_method in (
      'cash',
      'upi',
      'driver_direct_upi',
      'wallet',
      'card',
      'netbanking',
      'corporate',
      'pay_later',
      'partial_wallet_online'
    ));
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'ride_requests'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%payment_status%'
  loop
    execute format('alter table public.ride_requests drop constraint if exists %I', constraint_name);
  end loop;

  alter table public.ride_requests
    add constraint ride_requests_payment_status_check
    check (payment_status in (
      'pending',
      'payment_pending',
      'authorized',
      'awaiting_payment',
      'paid',
      'failed',
      'refunded',
      'disputed'
    ));
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'wallet_transactions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%transaction_type%'
  loop
    execute format('alter table public.wallet_transactions drop constraint if exists %I', constraint_name);
  end loop;

  alter table public.wallet_transactions
    add constraint wallet_transactions_transaction_type_check
    check (transaction_type in (
      'credit',
      'ride_debit',
      'refund',
      'promo',
      'adjustment',
      'ride_earning',
      'commission_debit',
      'withdrawal',
      'settlement',
      'payment_collected',
      'cashback',
      'referral',
      'reversal'
    ));
end $$;

alter table public.wallet_transactions
  add column if not exists previous_balance numeric,
  add column if not exists new_balance numeric,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists status text not null default 'posted',
  add column if not exists description text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  payer_id uuid references public.profiles(id) on delete set null,
  payee_rider_id uuid references public.profiles(id) on delete set null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  method text not null check (method in (
    'cash',
    'upi',
    'driver_direct_upi',
    'wallet',
    'card',
    'netbanking',
    'corporate',
    'pay_later',
    'partial_wallet_online'
  )),
  provider text not null default 'manual',
  provider_order_id text,
  provider_payment_id text,
  provider_reference text,
  status text not null default 'initiated' check (status in (
    'initiated',
    'payment_pending',
    'authorized',
    'captured',
    'failed',
    'refunded',
    'cancelled',
    'disputed',
    'reconciled'
  )),
  wallet_amount numeric not null default 0 check (wallet_amount >= 0),
  gateway_amount numeric not null default 0 check (gateway_amount >= 0),
  gateway_fee numeric not null default 0 check (gateway_fee >= 0),
  taxiro_commission numeric not null default 0 check (taxiro_commission >= 0),
  rider_earning numeric not null default 0 check (rider_earning >= 0),
  collected_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  reconciled_at timestamptz
);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments(id) on delete cascade,
  ride_id uuid references public.ride_requests(id) on delete cascade,
  event_type text not null,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_settlement_items (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.ride_requests(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in (
    'driver_payable',
    'platform_commission',
    'cash_collected',
    'tip',
    'bonus',
    'adjustment',
    'refund'
  )),
  amount numeric not null check (amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending','settled','waived','disputed','cancelled')),
  settlement_batch_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists payments_ride_idx on public.payments(ride_id, created_at desc);
create index if not exists payments_status_idx on public.payments(status, created_at desc);
create index if not exists payment_events_payment_idx on public.payment_events(payment_id, created_at desc);
create index if not exists driver_settlement_items_rider_idx on public.driver_settlement_items(rider_id, status, created_at desc);
create index if not exists driver_settlement_items_ride_idx on public.driver_settlement_items(ride_id);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.driver_settlement_items enable row level security;

drop policy if exists "ride participants read payments" on public.payments;
drop policy if exists "admins manage payments" on public.payments;
drop policy if exists "ride participants read payment events" on public.payment_events;
drop policy if exists "admins manage payment events" on public.payment_events;
drop policy if exists "riders read own settlement items" on public.driver_settlement_items;
drop policy if exists "admins manage settlement items" on public.driver_settlement_items;

create policy "ride participants read payments" on public.payments
for select to authenticated
using (
  public.is_admin()
  or payer_id = auth.uid()
  or payee_rider_id = auth.uid()
  or exists (
    select 1
    from public.ride_requests ride
    where ride.id = payments.ride_id
      and (ride.user_id = auth.uid() or ride.assigned_rider_id = auth.uid())
  )
);

create policy "admins manage payments" on public.payments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "ride participants read payment events" on public.payment_events
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.payments payment
    join public.ride_requests ride on ride.id = payment.ride_id
    where payment.id = payment_events.payment_id
      and (ride.user_id = auth.uid() or ride.assigned_rider_id = auth.uid())
  )
);

create policy "admins manage payment events" on public.payment_events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "riders read own settlement items" on public.driver_settlement_items
for select to authenticated
using (rider_id = auth.uid() or public.is_admin());

create policy "admins manage settlement items" on public.driver_settlement_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.create_ride_payment_order(
  p_ride_id uuid,
  p_method text,
  p_wallet_amount numeric default 0,
  p_provider text default 'manual'
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ride public.ride_requests;
  normalized_method text := lower(trim(coalesce(p_method, '')));
  normalized_provider text := lower(trim(coalesce(p_provider, 'manual')));
  wallet_amount numeric := greatest(coalesce(p_wallet_amount, 0), 0);
  payment public.payments;
begin
  select * into target_ride
  from public.ride_requests
  where id = p_ride_id
    and user_id = auth.uid();

  if target_ride.id is null then
    raise exception 'Only the booking customer can create this payment order';
  end if;

  if normalized_method not in ('cash','upi','driver_direct_upi','wallet','card','netbanking','corporate','pay_later','partial_wallet_online') then
    raise exception 'Unsupported payment method';
  end if;

  insert into public.payments (
    ride_id,
    payer_id,
    payee_rider_id,
    amount,
    method,
    provider,
    status,
    wallet_amount,
    gateway_amount,
    taxiro_commission,
    rider_earning,
    metadata
  )
  values (
    target_ride.id,
    target_ride.user_id,
    target_ride.assigned_rider_id,
    greatest(coalesce(target_ride.fare_estimate, 0), 0),
    normalized_method,
    coalesce(nullif(normalized_provider, ''), 'manual'),
    case
      when normalized_method in ('cash','driver_direct_upi','upi','pay_later') then 'payment_pending'
      else 'initiated'
    end,
    least(wallet_amount, greatest(coalesce(target_ride.fare_estimate, 0), 0)),
    greatest(greatest(coalesce(target_ride.fare_estimate, 0), 0) - least(wallet_amount, greatest(coalesce(target_ride.fare_estimate, 0), 0)), 0),
    greatest(coalesce(target_ride.company_commission, 0), 0),
    greatest(coalesce(target_ride.rider_earning, greatest(coalesce(target_ride.fare_estimate, 0), 0) - coalesce(target_ride.company_commission, 0)), 0),
    jsonb_build_object('source', 'customer_order')
  )
  returning * into payment;

  insert into public.payment_events(payment_id, ride_id, event_type, payload)
  values (payment.id, target_ride.id, 'payment_order_created', jsonb_build_object('method', normalized_method, 'provider', normalized_provider));

  return payment;
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
  v_payment_id uuid;
  v_payment_method text;
  v_amount numeric;
  v_commission numeric;
  v_rider_earning numeric;
  previous_balance numeric;
  next_balance numeric;
  customer_previous_balance numeric;
  customer_next_balance numeric;
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

  v_payment_method := coalesce(nullif(v_ride.payment_method, ''), 'cash');
  v_amount := greatest(coalesce(v_ride.fare_estimate, 0), 0);
  v_commission := greatest(coalesce(v_ride.company_commission, round(v_amount * 0.07, 2)), 0);
  v_rider_earning := greatest(coalesce(v_ride.rider_earning, v_amount - v_commission), 0);

  select id into v_payment_id
  from public.payments
  where ride_id = v_ride.id
    and status = 'captured'
  order by created_at desc
  limit 1;

  if v_payment_id is null then
    insert into public.payments (
      ride_id,
      payer_id,
      payee_rider_id,
      amount,
      method,
      provider,
      status,
      wallet_amount,
      gateway_amount,
      taxiro_commission,
      rider_earning,
      collected_by,
      confirmed_by,
      captured_at,
      metadata
    )
    values (
      v_ride.id,
      v_ride.user_id,
      v_ride.assigned_rider_id,
      v_amount,
      v_payment_method,
      case when v_payment_method in ('cash','upi','driver_direct_upi') then 'driver_direct' else 'taxiro' end,
      'captured',
      case when v_payment_method in ('wallet','partial_wallet_online') then v_amount else 0 end,
      case when v_payment_method in ('card','netbanking','corporate','partial_wallet_online') then v_amount else 0 end,
      v_commission,
      v_rider_earning,
      auth.uid(),
      auth.uid(),
      now(),
      jsonb_build_object('source', 'rider_completion')
    )
    returning id into v_payment_id;
  end if;

  insert into public.payment_events(payment_id, ride_id, event_type, payload)
  values (
    v_payment_id,
    v_ride.id,
    'payment_captured_by_rider',
    jsonb_build_object('method', v_payment_method, 'amount', v_amount)
  );

  if v_payment_method in ('wallet','partial_wallet_online') and v_amount > 0 then
    insert into public.wallets(profile_id, balance, currency, updated_at)
    values (v_ride.user_id, 0, 'INR', now())
    on conflict (profile_id) do nothing;

    select balance into customer_previous_balance
    from public.wallets
    where profile_id = v_ride.user_id
    for update;

    if coalesce(customer_previous_balance, 0) < v_amount then
      raise exception 'Customer wallet balance is insufficient for this ride payment';
    end if;

    customer_next_balance := coalesce(customer_previous_balance, 0) - v_amount;

    update public.wallets
    set balance = customer_next_balance,
        updated_at = now()
    where profile_id = v_ride.user_id;

    insert into public.wallet_transactions (
      profile_id,
      ride_id,
      amount,
      transaction_type,
      reference,
      previous_balance,
      new_balance,
      reference_type,
      reference_id,
      description,
      metadata
    )
    values (
      v_ride.user_id,
      v_ride.id,
      -v_amount,
      'ride_debit',
      'payment:' || v_payment_id::text,
      customer_previous_balance,
      customer_next_balance,
      'payment',
      v_payment_id,
      'Ride fare debited from Taxiro wallet',
      jsonb_build_object('method', v_payment_method)
    );
  end if;

  insert into public.driver_settlement_items(payment_id, ride_id, rider_id, item_type, amount, metadata)
  values
    (v_payment_id, v_ride.id, v_ride.assigned_rider_id, 'driver_payable', v_rider_earning, jsonb_build_object('payment_method', v_payment_method)),
    (v_payment_id, v_ride.id, v_ride.assigned_rider_id, 'platform_commission', v_commission, jsonb_build_object('payment_method', v_payment_method));

  if v_payment_method in ('wallet','card','netbanking','corporate','partial_wallet_online') then
    insert into public.wallets(profile_id, balance, currency, updated_at)
    values (v_ride.assigned_rider_id, 0, 'INR', now())
    on conflict (profile_id) do nothing;

    select balance into previous_balance
    from public.wallets
    where profile_id = v_ride.assigned_rider_id
    for update;

    next_balance := coalesce(previous_balance, 0) + v_rider_earning;

    update public.wallets
    set balance = next_balance,
        updated_at = now()
    where profile_id = v_ride.assigned_rider_id;

    insert into public.wallet_transactions (
      profile_id,
      ride_id,
      amount,
      transaction_type,
      reference,
      previous_balance,
      new_balance,
      reference_type,
      reference_id,
      description,
      metadata
    )
    values (
      v_ride.assigned_rider_id,
      v_ride.id,
      v_rider_earning,
      'ride_earning',
      'payment:' || v_payment_id::text,
      previous_balance,
      next_balance,
      'payment',
      v_payment_id,
      'Ride earning credited after Taxiro-collected payment',
      jsonb_build_object('commission', v_commission, 'method', v_payment_method)
    );
  end if;

  update public.rider_locations
  set is_available = true,
      updated_at = now()
  where rider_id = auth.uid();

  insert into public.ride_status_events (ride_id, status, actor_id, note)
  values (p_ride_id, 'completed', auth.uid(), 'Payment confirmed by rider and ride completed');

  return v_ride;
end;
$$;

grant execute on function public.create_ride_payment_order(uuid, text, numeric, text) to authenticated;
grant execute on function public.confirm_ride_payment_and_complete(uuid) to authenticated;

notify pgrst, 'reload schema';
