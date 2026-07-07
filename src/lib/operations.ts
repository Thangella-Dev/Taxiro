import type { LatLng, PricingRule, ServiceArea, VehicleType } from "@/types/database";

export type ServiceAreaDecision = {
  area: ServiceArea | null;
  configured: boolean;
  reason: string | null;
};

export function distanceKmBetween(from: LatLng, to: LatLng) {
  const earthRadiusKm = 6_371;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const fromLatitude = radians(from.lat);
  const toLatitude = radians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findServiceAreaForTrip(
  areas: ServiceArea[],
  pickup: LatLng,
  drop: LatLng,
  vehicleType: VehicleType,
): ServiceAreaDecision {
  const activeAreas = areas.filter((area) => area.is_active);
  if (!activeAreas.length) return { area: null, configured: false, reason: null };

  const pickupAreas = activeAreas.filter(
    (area) =>
      area.supported_vehicle_types.includes(vehicleType) &&
      distanceKmBetween(pickup, { lat: area.center_lat, lng: area.center_lng }) <= area.radius_km,
  );
  if (!pickupAreas.length) {
    return {
      area: null,
      configured: true,
      reason: `${vehicleLabel(vehicleType)} service is not available at this pickup yet.`,
    };
  }

  const area = pickupAreas.find(
    (candidate) =>
      distanceKmBetween(drop, { lat: candidate.center_lat, lng: candidate.center_lng }) <=
      candidate.radius_km,
  );
  if (!area) {
    return {
      area: null,
      configured: true,
      reason: "Pickup and destination must be inside the same active Taxiro service area.",
    };
  }
  return { area, configured: true, reason: null };
}

export function findEffectivePricingRule(
  rules: PricingRule[],
  serviceAreaId: string,
  vehicleType: VehicleType,
  departureAt: Date | string,
) {
  const timestamp = new Date(departureAt).getTime();
  return (
    rules
      .filter((rule) => {
        if (!rule.is_active || rule.service_area_id !== serviceAreaId || rule.vehicle_type !== vehicleType) return false;
        const starts = new Date(rule.effective_from).getTime();
        const ends = rule.effective_until ? new Date(rule.effective_until).getTime() : Number.POSITIVE_INFINITY;
        return timestamp >= starts && timestamp < ends;
      })
      .sort((left, right) => new Date(right.effective_from).getTime() - new Date(left.effective_from).getTime())[0] ?? null
  );
}

export function calculateConfiguredFare(
  distanceKm: number | null,
  durationMin: number | null,
  rule: PricingRule,
) {
  if (distanceKm === null) return null;
  const calculated =
    rule.base_fare +
    distanceKm * rule.per_km_rate +
    (durationMin ?? 0) * rule.per_minute_rate;
  return Math.round(Math.max(rule.minimum_fare, calculated));
}

export function assessLocationJump({
  accuracyM,
  elapsedSeconds,
  from,
  fromAccuracyM,
  to,
}: {
  accuracyM: number;
  elapsedSeconds: number;
  from: LatLng;
  fromAccuracyM: number;
  to: LatLng;
}) {
  const movedM = distanceKmBetween(from, to) * 1_000;
  const allowedMovementM = Math.max(
    120,
    fromAccuracyM + accuracyM + Math.max(1, elapsedSeconds) * 45,
  );
  return { allowedMovementM, movedM, suspicious: movedM > allowedMovementM };
}

function vehicleLabel(vehicleType: VehicleType) {
  if (vehicleType === "auto") return "Auto";
  if (vehicleType === "car") return "Car";
  return "Bike";
}
