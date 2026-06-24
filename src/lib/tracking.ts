import type { SupabaseClient } from "@supabase/supabase-js";

import type { LatLng } from "@/types/database";

export type RiderTrackingUpdate = LatLng & {
  accuracy_m: number | null;
  heading: number | null;
  speed: number | null;
};

export function watchRiderLocation({
  isAvailable,
  onError,
  onUpdate,
  riderId,
  supabase,
}: {
  isAvailable: boolean;
  onError: (message: string) => void;
  onUpdate: (location: RiderTrackingUpdate) => void;
  riderId: string;
  supabase: SupabaseClient;
}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("GPS tracking is not available in this browser. Use manual map refresh.");
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = new Date().toISOString();
      const location: RiderTrackingUpdate = {
        accuracy_m: Math.round(position.coords.accuracy),
        heading: position.coords.heading,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
      };

      onUpdate(location);
      void supabase.from("rider_locations").upsert({
        accuracy_m: location.accuracy_m,
        heading: location.heading,
        is_available: isAvailable,
        last_seen_at: now,
        lat: location.lat,
        lng: location.lng,
        rider_id: riderId,
        speed: location.speed,
        updated_at: now,
      });
    },
    (error) => {
      onError(error.message || "Location permission denied. Use manual map refresh.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

