import type { SupabaseClient } from "@supabase/supabase-js";

import { isAuthOrPermissionError } from "@/lib/auth";
import type { RideRequest } from "@/types/database";

export async function publishRideReadySignal(
  supabase: SupabaseClient,
  rideId: string,
  signalMinutes: 15 | 30 | 60,
  userId: string,
) {
  const normalizedMinutes = [15, 30, 60].includes(signalMinutes)
    ? signalMinutes
    : 30;

  const { data, error } = await supabase.rpc("mark_ride_ready_and_assign", {
    p_ride_id: rideId,
    p_signal_minutes: normalizedMinutes,
  });

  if (!error) {
    return { data: data as RideRequest | null, error: null };
  }

  const message = `${error.message ?? ""}`.toLowerCase();
  const shouldFallback =
    isAuthOrPermissionError(error) ||
    message.includes("permission denied") ||
    message.includes("could not find function") ||
    message.includes("not found") ||
    message.includes("not authenticated") ||
    message.includes("authentication required");

  if (!shouldFallback) {
    return { data: null, error };
  }

  const now = new Date().toISOString();
  const readyExpiresAt = new Date(
    Date.now() + normalizedMinutes * 60_000,
  ).toISOString();

  const { data: updatedRide, error: updateError } = await supabase
    .from("ride_requests")
    .update({
      accepted_at: null,
      assigned_rider_id: null,
      ready_at: now,
      ready_expires_at: readyExpiresAt,
      ready_signal_minutes: normalizedMinutes,
      status: "ready",
    })
    .eq("id", rideId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError || !updatedRide) {
    return { data: null, error: updateError ?? new Error("Could not publish ready signal.") };
  }

  await supabase.from("ride_status_events").insert({
    actor_id: userId,
    note: `User ready signal published for ${normalizedMinutes} minutes`,
    ride_id: rideId,
    status: "ready",
  });

  return { data: updatedRide as RideRequest, error: null };
}
