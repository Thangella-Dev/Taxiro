import { getSupabase } from "@/lib/supabase";
import type { FareCalculationBreakdown, LatLng, VehicleType } from "@/types/database";

export type FareEstimateRequest = {
  vehicleType: VehicleType;
  distanceKm: number | null;
  durationMin: number | null;
  waitingMin?: number;
  pickup?: LatLng | null;
  drop?: LatLng | null;
  couponCode?: string | null;
  walletCredit?: number;
  isAirportPickup?: boolean;
  tollCharge?: number;
  at?: Date | string;
  profileId?: string | null;
};

export async function calculateTaxiroFareEstimate({
  at,
  couponCode,
  distanceKm,
  drop,
  durationMin,
  isAirportPickup = false,
  pickup,
  profileId,
  tollCharge = 0,
  vehicleType,
  waitingMin = 0,
  walletCredit = 0,
}: FareEstimateRequest): Promise<FareCalculationBreakdown> {
  if (distanceKm === null || distanceKm === undefined) {
    throw new Error("Route distance is required before calculating fare.");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.rpc("calculate_taxiro_fare", {
    p_at: at ? new Date(at).toISOString() : new Date().toISOString(),
    p_coupon_code: couponCode?.trim() || null,
    p_distance_km: distanceKm,
    p_drop_lat: drop?.lat ?? null,
    p_drop_lng: drop?.lng ?? null,
    p_duration_min: durationMin ?? 0,
    p_is_airport_pickup: isAirportPickup,
    p_pickup_lat: pickup?.lat ?? null,
    p_pickup_lng: pickup?.lng ?? null,
    p_profile_id: profileId ?? null,
    p_toll_charge: tollCharge,
    p_vehicle_type: vehicleType,
    p_waiting_min: waitingMin,
    p_wallet_credit: walletCredit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeFareBreakdown(data as Partial<FareCalculationBreakdown>);
}

export function normalizeFareBreakdown(
  data: Partial<FareCalculationBreakdown> | null | undefined,
): FareCalculationBreakdown {
  if (!data) throw new Error("Pricing engine returned an empty fare response.");
  return {
    airport_fee: toNumber(data.airport_fee),
    base_fare: toNumber(data.base_fare),
    cashback_amount: toNumber(data.cashback_amount),
    company_commission_rate: toNumber(data.company_commission_rate),
    coupon_discount: toNumber(data.coupon_discount),
    currency: "INR",
    distance_charge: toNumber(data.distance_charge),
    driver_earning: toNumber(data.driver_earning),
    final_fare: toNumber(data.final_fare),
    free_waiting_minutes: toNumber(data.free_waiting_minutes),
    minimum_fare: toNumber(data.minimum_fare),
    night_charge: toNumber(data.night_charge),
    platform_commission: toNumber(data.platform_commission),
    pricing_rule_id: data.pricing_rule_id ?? null,
    rule_snapshot: isRecord(data.rule_snapshot) ? data.rule_snapshot : {},
    service_area_id: data.service_area_id ?? null,
    subtotal_before_surge: toNumber(data.subtotal_before_surge),
    surge_charge: toNumber(data.surge_charge),
    surge_multiplier: toNumber(data.surge_multiplier, 1),
    tax_amount: toNumber(data.tax_amount),
    time_charge: toNumber(data.time_charge),
    toll_charge: toNumber(data.toll_charge),
    vehicle_type: data.vehicle_type ?? "bike",
    waiting_charge: toNumber(data.waiting_charge),
    wallet_credit_applied: toNumber(data.wallet_credit_applied),
  };
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}