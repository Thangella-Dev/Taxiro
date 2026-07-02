import type { SupabaseClient } from "@supabase/supabase-js";

import type { LatLng } from "@/types/database";

export type RiderTrackingUpdate = LatLng & {
  accuracy_m: number | null;
  heading: number | null;
  speed: number | null;
};

export const PRECISE_TARGET_ACCURACY_M = 60;
export const MAX_USABLE_LOCATION_ACCURACY_M = 100;
const PRECISE_LOCATION_TIMEOUT_MS = 18_000;
const MAX_RIDER_TRACKING_ACCURACY_M = 100;
const RIDER_WRITE_INTERVAL_MS = 5_000;
const RIDER_HEARTBEAT_INTERVAL_MS = 15_000;
const RIDER_MINIMUM_MOVEMENT_M = 4;
const MAX_POSITION_AGE_MS = 15_000;
const MIN_CONFIRMATION_SAMPLE_GAP_MS = 700;
const MIN_CONFIRMATION_RADIUS_M = 45;
const MAX_PLAUSIBLE_RIDER_SPEED_MPS = 45;

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
    const installed =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    return installed
      ? "Location is blocked for installed Taxiro. Open device Settings, allow precise location for Taxiro or the browser, then reopen the app."
      : "Location permission is blocked. Allow precise location access in browser settings, then try again.";
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

function requestCurrentPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function isFreshPosition(position: GeolocationPosition) {
  return (
    Number.isFinite(position.coords.latitude) &&
    Number.isFinite(position.coords.longitude) &&
    Number.isFinite(position.coords.accuracy) &&
    position.coords.accuracy > 0 &&
    Date.now() - position.timestamp <= MAX_POSITION_AGE_MS
  );
}

function positionsAgree(first: GeolocationPosition, second: GeolocationPosition) {
  if (Math.abs(second.timestamp - first.timestamp) < MIN_CONFIRMATION_SAMPLE_GAP_MS) return false;
  const distanceM = distanceInMeters(
    { lat: first.coords.latitude, lng: first.coords.longitude },
    { lat: second.coords.latitude, lng: second.coords.longitude },
  );
  const confirmationRadiusM = Math.max(
    MIN_CONFIRMATION_RADIUS_M,
    first.coords.accuracy + second.coords.accuracy,
  );
  return distanceM <= confirmationRadiusM;
}

function positionToTrackingUpdate(position: GeolocationPosition): RiderTrackingUpdate {
  return {
    accuracy_m: Math.round(position.coords.accuracy),
    heading: position.coords.heading,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    speed: position.coords.speed,
  };
}

export async function getPromptedCurrentLocation(onProgress?: (accuracyM: number) => void) {
  ensureGeolocationReady();

  return new Promise<GeolocationPosition>((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let timer: number | null = null;
    let lastError: GeolocationPositionError | null = null;
    let bestAccuracyM = Number.POSITIVE_INFINITY;
    let usableSamples: GeolocationPosition[] = [];

    function finish(position?: GeolocationPosition, message?: string) {
      if (settled) return;
      settled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (position) resolve(position);
      else reject(new Error(message ?? geolocationErrorMessage(lastError ?? undefined)));
    }

    function consider(position: GeolocationPosition) {
      if (!isFreshPosition(position)) return;
      const accuracyM = Math.round(position.coords.accuracy);
      bestAccuracyM = Math.min(bestAccuracyM, accuracyM);
      onProgress?.(accuracyM);
      if (accuracyM > MAX_USABLE_LOCATION_ACCURACY_M) return;

      const agreeingSample = usableSamples.find((sample) => positionsAgree(sample, position));
      usableSamples = [...usableSamples.slice(-5), position];
      if (!agreeingSample) return;

      const confirmed =
        position.coords.accuracy <= agreeingSample.coords.accuracy * 1.5
          ? position
          : agreeingSample;
      finish(confirmed);
    }

    function handleError(error: GeolocationPositionError) {
      lastError = error;
      if (error.code === error.PERMISSION_DENIED) {
        finish(undefined, geolocationErrorMessage(error));
      }
    }

    watchId = navigator.geolocation.watchPosition(
      consider,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: PRECISE_LOCATION_TIMEOUT_MS,
      },
    );

    void requestCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: PRECISE_LOCATION_TIMEOUT_MS,
    }).then(consider).catch((error: GeolocationPositionError) => handleError(error));

    timer = window.setTimeout(() => {
      if (bestAccuracyM > MAX_USABLE_LOCATION_ACCURACY_M) {
        finish(
          undefined,
          Number.isFinite(bestAccuracyM)
            ? "GPS is too weak (+/-" + bestAccuracyM + "m). Move outdoors or choose the exact point on the map."
            : undefined,
        );
        return;
      }
      finish(
        undefined,
        usableSamples.length
          ? "GPS returned only one unconfirmed position. Try again outdoors or choose the exact point on the map."
          : undefined,
      );
    }, PRECISE_LOCATION_TIMEOUT_MS);
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
  let confirmationSamples: GeolocationPosition[] = [];
  let jumpSamples: GeolocationPosition[] = [];

  void getGeolocationPermissionState().then((permissionState) => {
    if (permissionState === "prompt") {
      onError("Tap the GPS button to allow location permission and confirm live tracking.");
    }
    if (permissionState === "denied") {
      onError("Location permission is blocked. Allow precise location access in browser settings, then try again.");
    }
  });

  function publish(position: GeolocationPosition) {
    const receivedAt = Date.now();
    const location = positionToTrackingUpdate(position);
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
        if (error) onError("Live GPS was confirmed but could not be published. Trying again.");
      });
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const receivedAt = Date.now();
      if (!isFreshPosition(position)) {
        onError("Ignoring a stale GPS position. Waiting for a fresh fix.");
        return;
      }

      const accuracyM = Math.round(position.coords.accuracy);
      if (accuracyM > MAX_RIDER_TRACKING_ACCURACY_M) {
        if (receivedAt - lastWeakSignalNoticeAt >= 10_000) {
          onError("GPS signal is too weak (+/-" + accuracyM + "m). Waiting for a better fix.");
          lastWeakSignalNoticeAt = receivedAt;
        }
        return;
      }

      if (!lastAccepted) {
        const agreeingSample = confirmationSamples.find((sample) => positionsAgree(sample, position));
        confirmationSamples = [...confirmationSamples.slice(-4), position];
        if (!agreeingSample) {
          if (receivedAt - lastWeakSignalNoticeAt >= 4_000) {
            onError("Confirming rider GPS with another fresh sample...");
            lastWeakSignalNoticeAt = receivedAt;
          }
          return;
        }
        confirmationSamples = [];
        publish(position);
        return;
      }

      const elapsedSeconds = Math.max(1, (receivedAt - lastAcceptedAt) / 1000);
      const movedM = distanceInMeters(lastAccepted, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      const allowedMovementM = Math.max(
        120,
        (lastAccepted.accuracy_m ?? 0) +
          accuracyM +
          elapsedSeconds * MAX_PLAUSIBLE_RIDER_SPEED_MPS,
      );

      if (movedM > allowedMovementM) {
        const agreeingJump = jumpSamples.find((sample) => positionsAgree(sample, position));
        jumpSamples = [...jumpSamples.slice(-3), position];
        if (!agreeingJump) {
          onError("A large GPS jump was detected. Confirming before moving your live marker...");
          return;
        }
      } else {
        jumpSamples = [];
      }

      publish(position);
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
