-- Enable full replica identity for Taxiro Realtime row-change payloads.
-- Additive only: no tables or rows are deleted.

do $$
declare
  v_table_name text;
  table_names text[] := array[
    'profiles',
    'ride_requests',
    'rider_locations',
    'rider_routes',
    'ride_status_events',
    'ride_confirmation_codes',
    'ride_chat_messages',
    'rider_profiles',
    'ride_ratings'
  ];
begin
  foreach v_table_name in array table_names loop
    execute format('alter table public.%I replica identity full', v_table_name);
  end loop;
end $$;
