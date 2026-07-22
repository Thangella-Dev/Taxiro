import type { VehicleType } from "@/types/database";

export type NearbyRiderLookupCandidate = {
  p_radius_km: number;
  p_vehicle_type: VehicleType | null;
};

export function buildNearbyRiderLookupPlan(
  vehicleType: VehicleType,
  radiusKm = 8,
): NearbyRiderLookupCandidate[] {
  const candidates: NearbyRiderLookupCandidate[] = [
    { p_radius_km: radiusKm, p_vehicle_type: vehicleType },
  ];

  if (radiusKm < 20) {
    candidates.push({ p_radius_km: 20, p_vehicle_type: vehicleType });
  }

  candidates.push({ p_radius_km: 20, p_vehicle_type: null });

  return candidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.p_radius_km === candidate.p_radius_km &&
          item.p_vehicle_type === candidate.p_vehicle_type,
      ) === index,
  );
}
