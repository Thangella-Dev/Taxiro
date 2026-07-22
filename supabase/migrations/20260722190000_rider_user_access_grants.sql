-- Ensure riders and booking users can call the ride flow RPCs and access the ride tables
-- that power ready signals, confirmation codes, status updates, and rider details.

-- Table access for authenticated users (RLS policies remain the enforcement layer).
grant select, insert, update on public.ride_requests to authenticated;
grant select, insert, update on public.ride_status_events to authenticated;
grant select, insert, update on public.ride_confirmation_codes to authenticated;
grant select, insert, update on public.ride_chat_messages to authenticated;
grant select, insert, update on public.rider_locations to authenticated;
grant select, insert, update on public.rider_profiles to authenticated;
grant select, insert, update on public.rider_vehicles to authenticated;
grant select, insert, update on public.ride_fare_breakdowns to authenticated;

-- Ride flow RPCs used by users and riders.
revoke execute on function public.accept_ready_ride(uuid) from anon;
grant execute on function public.accept_ready_ride(uuid) to authenticated;

revoke execute on function public.cancel_ride(uuid, text) from anon;
grant execute on function public.cancel_ride(uuid, text) to authenticated;

revoke execute on function public.complete_ride(uuid) from anon;
grant execute on function public.complete_ride(uuid) to authenticated;

revoke execute on function public.confirm_ride_payment_and_complete(uuid) from anon;
grant execute on function public.confirm_ride_payment_and_complete(uuid) to authenticated;

revoke execute on function public.get_assigned_rider_details(uuid) from anon;
grant execute on function public.get_assigned_rider_details(uuid) to authenticated;

revoke execute on function public.get_or_create_ride_confirmation_code(uuid) from anon;
grant execute on function public.get_or_create_ride_confirmation_code(uuid) to authenticated;

revoke execute on function public.mark_ride_ready_and_assign(uuid, integer) from anon;
grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;

revoke execute on function public.mark_ride_ready_and_assign(uuid) from anon;
grant execute on function public.mark_ride_ready_and_assign(uuid) to authenticated;

revoke execute on function public.mark_ride_reached_drop(uuid) from anon;
grant execute on function public.mark_ride_reached_drop(uuid) to authenticated;

revoke execute on function public.set_active_rider_vehicle(text) from anon;
grant execute on function public.set_active_rider_vehicle(text) to authenticated;

revoke execute on function public.verify_ride_code(uuid, text) from anon;
grant execute on function public.verify_ride_code(uuid, text) to authenticated;

revoke execute on function public.attach_ride_fare_breakdown(uuid, jsonb) from anon;
grant execute on function public.attach_ride_fare_breakdown(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
