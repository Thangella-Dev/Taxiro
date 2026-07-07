-- Enforce operational configuration references and safely record location anomalies.

alter table public.ride_requests
  add column if not exists service_area_id uuid references public.service_areas(id) on delete set null,
  add column if not exists pricing_rule_id uuid references public.pricing_rules(id) on delete set null;

create index if not exists ride_requests_service_area_idx
  on public.ride_requests(service_area_id, created_at desc);

create or replace function public.record_location_anomaly(
  p_signal_type text,
  p_evidence jsonb default '{}'::jsonb,
  p_ride_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_signal_id uuid;
begin
  if auth.uid() is null or not public.is_rider() then
    raise exception 'Rider authentication required';
  end if;
  if p_signal_type not in ('impossible_speed', 'location_jump', 'mock_location') then
    raise exception 'Unsupported location signal type';
  end if;
  if p_ride_id is not null and not exists (
    select 1 from public.ride_requests
    where id = p_ride_id and assigned_rider_id = auth.uid()
  ) then
    raise exception 'Ride not assigned to this rider';
  end if;

  select id into v_existing
  from public.fraud_signals
  where profile_id = auth.uid()
    and signal_type = p_signal_type
    and status in ('open', 'reviewing')
    and created_at > now() - interval '15 minutes'
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.fraud_signals(
    profile_id,
    ride_id,
    signal_type,
    severity,
    evidence
  )
  values (
    auth.uid(),
    p_ride_id,
    p_signal_type,
    case when p_signal_type = 'mock_location' then 'high' else 'medium' end,
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning id into v_signal_id;

  return v_signal_id;
end;
$$;

create or replace function public.admin_review_fraud_signal(
  p_signal_id uuid,
  p_status text
) returns public.fraud_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.fraud_signals;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('reviewing', 'dismissed', 'confirmed') then
    raise exception 'Invalid fraud review status';
  end if;

  update public.fraud_signals
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_signal_id
  returning * into v_signal;
  if v_signal.id is null then
    raise exception 'Fraud signal not found';
  end if;

  insert into public.admin_audit_logs(admin_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'fraud_signal_' || p_status,
    'fraud_signal',
    p_signal_id::text,
    jsonb_build_object('signal_type', v_signal.signal_type, 'profile_id', v_signal.profile_id)
  );
  return v_signal;
end;
$$;

grant execute on function public.record_location_anomaly(text,jsonb,uuid) to authenticated;
grant execute on function public.admin_review_fraud_signal(uuid,text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['service_areas', 'pricing_rules', 'fraud_signals']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
