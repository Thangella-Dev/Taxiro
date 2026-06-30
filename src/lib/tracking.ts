import type { SupabaseClient } from "@supabase/supabase-js";

import type { LatLng } from "@/types/database";

export type RiderTrackingUpdate = LatLng & {
  accuracy_m: number | null;
  heading: number | null;
  speed: number | null;
};

const PRECISE_TARGET_ACCURACY_M = 60;
export const MAX_USABLE_LOCATION_ACCURACY_M = 250;
const PRECISE_LOCATION_TIMEOUT_MS = 12_000;
const MAX_RIDER_TRACKING_ACCURACY_M = 100;
const RIDER_WRITE_INTERVAL_MS = 5_000;
const RIDER_HEARTBEAT_INTERVAL_MS = 15_000;
const RIDER_MINIMUM_MOVEMENT_M = 4;

type GeolocationPermissionState = PermissionState | "unknown";

async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

function geolocationErrorMessage(error?: GeolocationPositionError) {
  if (!error) return "GPS could not determine your location. Search or choose it on the map.";
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission is blocked. Allow precise location access in browser settings, then try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your device cannot get a GPS fix right now. Move near a window or outdoors, then try again.";
  }
  return "GPS detection timed out. Move near a window or outdoors, then try again.";
}

function ensureGeolocationReady() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location detection is not supported in this browser.");
  }
  if (!window.isSecureContext) {
    throw new Error("Location detection requires HTTPS or localhost.");
  }
}

function requestCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: PRECISE_LOCATION_TIMEOUT_MS,
    });
  });
}

export async function getPromptedCurrentLocation(onProgress?: (accuracyM: number) => void) {
  ensureGeolocationReady();

  const permissionState = await getGeolocationPermissionState();
  if (permissionState === "denied") {
    throw new Error("Location permission is blocked. Allow precise location access in browser settings, then try again.");
  }

  let best: GeolocationPosition;
  try {
    best = await requestCurrentPosition();
    onProgress?.(Math.round(best.coords.accuracy));
  } catch (error) {
    throw new Error(geolocationErrorMessage(error as GeolocationPositionError));
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let timer: number | null = null;

    function finish(position?: GeolocationPosition, error?: GeolocationPositionError) {
      if (settled) return;
      settled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      if (position && position.coords.accuracy <= MAX_USABLE_LOCATION_ACCURACY_M) {
        resolve(position);
        return;
      }
      if (position) {
        reject(
          new Error(
            `GPS is only accurate to +/-${Math.round(position.coords.accuracy)}m. Move near a window or outdoors, or choose the exact point on the map.`,
          ),
        );
        return;
      }
      reject(new Error(geolocationErrorMessage(error)));
    }

    if (best.coords.accuracy <= PRECISE_TARGET_ACCURACY_M) {
      finish(best);
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) return;
        if (position.coords.accuracy < best.coords.accuracy) {
          best = position;
          onProgress?.(Math.round(position.coords.accuracy));
        }
        if (position.coords.accuracy <= PRECISE_TARGET_ACCURACY_M) finish(position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) finish(undefined, error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: PRECISE_LOCATION_TIMEOUT_MS + 1_000 },
    );

    timer = window.setTimeout(() => finish(best), PRECISE_LOCATION_TIMEOUT_MS);
  });
}

export function getPreciseCurrentLocation(onProgress?: (accuracyM: number) => void) {
  return getPromptedCurrentLocation(onProgress);
}

function distanceInMeters(from: LatLng, to: LatLng) {
  const earthRadiusM = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

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
    onError("GPS tracking is not available in this browser. Use manual map selection.");
    return null;
  }
  if (!window.isSecureContext) {
    onError("Live GPS requires HTTPS or localhost. Use manual map selection for now.");
    return null;
  }

  let lastAccepted: RiderTrackingUpdate | null = null;
  let lastAcceptedAt = 0;
  let lastStoredAt = 0;
  let lastWeakSignalNoticeAt = 0;

  void getGeolocationPermissionState().then((permissionState) => {
    if (permissionState === "prompt") {
      onError("Tap the GPS button to allow location permission and start live tracking.");
    }
    if (permissionState === "denied") {
      onError("Location permission is blocked. Allow precise location access in browser settings, then try again.");
    }
  });

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const receivedAt = Date.now();
      const accuracyM = Math.round(position.coords.accuracy);

      if (accuracyM > MAX_RIDER_TRACKING_ACCURACY_M) {
        if (receivedAt - lastWeakSignalNoticeAt >= 10_000) {
          onError(`GPS signal is too weak (+/-${accuracyM}m). Waiting for a better fix.`);
          lastWeakSignalNoticeAt = receivedAt;
        }
        return;
      }

      if (
        lastAccepted?.accuracy_m &&
        receivedAt - lastAcceptedAt < 20_000 &&
        accuracyM > Math.max(50, lastAccepted.accuracy_m * 2)
      ) {
        return;
      }

      const location: RiderTrackingUpdate = {
        accuracy_m: accuracyM,
        heading: position.coords.heading,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
      };
      const movedM = lastAccepted ? distanceInMeters(lastAccepted, location) : Number.POSITIVE_INFINITY;
      const shouldStore =
        !lastAccepted ||
        (receivedAt - lastStoredAt >= RIDER_WRITE_INTERVAL_MS && movedM >= RIDER_MINIMUM_MOVEMENT_M) ||
        receivedAt - lastStoredAt >= RIDER_HEARTBEAT_INTERVAL_MS;

      lastAccepted = location;
      lastAcceptedAt = receivedAt;
      onUpdate(location);

      if (!shouldStore) return;
      lastStoredAt = receivedAt;
      const now = new Date(receivedAt).toISOString();
      void supabase
        .from("rider_locations")
        .upsert({
          accuracy_m: location.accuracy_m,
          heading: location.heading,
          is_available: isAvailable,
          last_seen_at: now,
          lat: location.lat,
          lng: location.lng,
          rider_id: riderId,
          speed: location.speed,
          updated_at: now,
        })
        .then(({ error }) => {
          if (error) onError("Live GPS was found but could not be published. Trying again.");
        });
    },
    (error) => {
      onError(geolocationErrorMessage(error));
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}