"use client";

import { useEffect, useRef } from "react";

import { isAuthOrPermissionError } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { LatLng, RideRequest, SafetyAlert, SafetyAlertType } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type CreateSafetyAlertInput = {
  accuracyM?: number | null;
  alertType: SafetyAlertType;
  location?: (LatLng & { accuracy_m?: number | null }) | null;
  message: string;
  rideId: string;
};

type RouteSummary = {
  distanceKm: number | null;
  durationMin: number | null;
};

export async function createSafetyAlertWithSupabase(
  supabase: SupabaseClient,
  {
    accuracyM,
    alertType,
    location,
    message,
    rideId,
  }: CreateSafetyAlertInput,
) {
  const { data, error } = await supabase.rpc("create_safety_alert", {
    p_accuracy_m: accuracyM ?? location?.accuracy_m ?? null,
    p_alert_type: alertType,
    p_lat: location?.lat ?? null,
    p_lng: location?.lng ?? null,
    p_message: message,
    p_ride_id: rideId,
  });

  if (!error) {
    return {
      alert: (data as SafetyAlert | null) ?? null,
      error: null,
    };
  }

  const messageText = `${error.message ?? ""}`.toLowerCase();
  const shouldFallback =
    isAuthOrPermissionError(error) ||
    messageText.includes("permission denied") ||
    messageText.includes("could not find function") ||
    messageText.includes("not found") ||
    messageText.includes("not authenticated") ||
    messageText.includes("authentication required");

  if (!shouldFallback) {
    return { alert: null, error: error.message ?? null };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    return {
      alert: null,
      error: authError?.message ?? error.message ?? null,
    };
  }

  const { data: rideStatusData, error: rideStatusError } = await supabase
    .from("ride_requests")
    .select("status")
    .eq("id", rideId)
    .maybeSingle();

  const status = (rideStatusData?.status as RideRequest["status"] | undefined) ?? "assigned";

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("emergency_contact_phone")
    .eq("id", user.id)
    .maybeSingle();

  const deliveryStatus =
    profileError || !profileData?.emergency_contact_phone
      ? "no_contact"
      : "unlinked";

  const { data: insertedAlert, error: insertError } = await supabase
    .from("safety_alerts")
    .insert({
      accuracy_m: accuracyM ?? location?.accuracy_m ?? null,
      alert_type: alertType,
      delivery_status: deliveryStatus,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      message,
      recipient_phone: profileData?.emergency_contact_phone ?? null,
      ride_id: rideId,
      triggered_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !insertedAlert) {
    return {
      alert: null,
      error: insertError?.message ?? error.message ?? null,
    };
  }

  await supabase.from("ride_status_events").insert({
    actor_id: user.id,
    note: `Safety alert created: ${alertType}`,
    ride_id: rideId,
    status: rideStatusError ? "assigned" : status,
  });

  return {
    alert: insertedAlert as SafetyAlert,
    error: null,
  };
}

export async function createSafetyAlert(input: CreateSafetyAlertInput) {
  const supabase = getSupabase();
  if (!supabase) {
    return { alert: null, error: "Supabase is not configured." };
  }

  return createSafetyAlertWithSupabase(supabase, input);
}

export function usePanicTrigger({
  enabled,
  onPanic,
}: {
  enabled: boolean;
  onPanic: () => void;
}) {
  const pressesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      const isVolumeUp =
        event.key === "AudioVolumeUp" ||
        event.code === "AudioVolumeUp" ||
        event.key === "VolumeUp" ||
        event.code === "VolumeUp";

      if (!isVolumeUp) return;

      const now = Date.now();
      pressesRef.current = [...pressesRef.current.filter((value) => now - value <= 1_500), now];
      if (pressesRef.current.length >= 3) {
        pressesRef.current = [];
        onPanic();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onPanic]);
}

export function useRideSafetyMonitor({
  enabled,
  location,
  onStatus,
  ride,
  routeSummary,
}: {
  enabled: boolean;
  location?: LatLng | null;
  onStatus?: (message: string) => void;
  ride: RideRequest | null;
  routeSummary: RouteSummary | null;
}) {
  const alertedRef = useRef<Set<SafetyAlertType>>(new Set());
  const routeChangeCountRef = useRef(0);
  const lastRouteRef = useRef<RouteSummary | null>(null);

  useEffect(() => {
    alertedRef.current = new Set();
    routeChangeCountRef.current = 0;
    lastRouteRef.current = null;
  }, [ride?.id]);

  useEffect(() => {
    if (!enabled || !ride || ride.status !== "started" || !ride.started_at) return undefined;

    async function checkDelay() {
      if (!ride?.started_at || alertedRef.current.has("late_trip")) return;
      const expectedMin = ride.estimated_duration_min ?? routeSummary?.durationMin ?? null;
      if (!expectedMin) return;

      const elapsedMin = (Date.now() - new Date(ride.started_at).getTime()) / 60_000;
      const thresholdMin = Math.max(expectedMin * 1.5, expectedMin + 15);
      if (elapsedMin < thresholdMin) return;

      alertedRef.current.add("late_trip");
      const { error } = await createSafetyAlert({
        alertType: "late_trip",
        location,
        message: `Taxiro trip is taking longer than expected. Expected ${Math.round(expectedMin)} min, elapsed ${Math.round(elapsedMin)} min.`,
        rideId: ride.id,
      });
      onStatus?.(error ?? "Emergency contact notified about trip delay if they have Taxiro.");
    }

    void checkDelay();
    const timer = window.setInterval(() => void checkDelay(), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, location, onStatus, ride, routeSummary]);

  useEffect(() => {
    if (!enabled || !ride || ride.status !== "started" || !routeSummary) return;
    if (alertedRef.current.has("route_changed")) return;

    const previous = lastRouteRef.current;
    lastRouteRef.current = routeSummary;
    if (!previous || previous.distanceKm === null || previous.durationMin === null) return;
    if (routeSummary.distanceKm === null || routeSummary.durationMin === null) return;

    const distanceJump = Math.abs(routeSummary.distanceKm - previous.distanceKm);
    const durationJump = Math.abs(routeSummary.durationMin - previous.durationMin);
    if (distanceJump < 2 && durationJump < 10) return;

    routeChangeCountRef.current += 1;
    if (routeChangeCountRef.current < 3) return;

    alertedRef.current.add("route_changed");
    void createSafetyAlert({
      alertType: "route_changed",
      location,
      message: "Taxiro detected multiple significant route or ETA changes during an active trip.",
      rideId: ride.id,
    }).then(({ error }) => {
      onStatus?.(error ?? "Emergency contact notified about route changes if they have Taxiro.");
    });
  }, [enabled, location, onStatus, ride, routeSummary]);
}
