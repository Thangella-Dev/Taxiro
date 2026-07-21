import { describe, expect, it } from "vitest";

import {
  assessLocationJump,
  calculateConfiguredFare,
  findEffectivePricingRule,
  findServiceAreaForTrip,
} from "@/lib/operations";
import type { PricingRule, ServiceArea } from "@/types/database";

const area: ServiceArea = {
  center_lat: 17.385,
  center_lng: 78.4867,
  created_at: "2026-07-06T00:00:00.000Z",
  id: "hyderabad",
  is_active: true,
  name: "Hyderabad",
  radius_km: 30,
  supported_vehicle_types: ["bike", "auto", "hatchback", "sedan", "suv"],
  updated_at: "2026-07-06T00:00:00.000Z",
};

const rule: PricingRule = {
  airport_pickup_fee: 0,
  base_fare: 10,
  cashback_percentage: 0,
  cancellation_fee: 20,
  company_commission_rate: 0.07,
  created_at: "2026-07-06T00:00:00.000Z",
  currency: "INR",
  driver_bonus_pool: 0,
  driver_cancellation_rules: {},
  dynamic_surge_multiplier: 1,
  effective_from: "2026-07-01T00:00:00.000Z",
  effective_until: null,
  free_waiting_minutes: 3,
  id: "bike-hyd",
  is_active: true,
  max_surge_multiplier: 1.5,
  minimum_fare: 40,
  night_charge_type: "none",
  night_charge_value: 0,
  passenger_cancellation_rules: {},
  peak_windows: [],
  per_km_rate: 7,
  per_minute_rate: 0.5,
  referral_reward_amount: 0,
  service_area_id: area.id,
  subscription_discount_percentage: 0,
  tax_percentage: 0,
  toll_charge: 0,
  vehicle_type: "bike",
  waiting_charge_per_minute: 1,
};

describe("operational controls", () => {
  it("accepts a trip inside one configured service area", () => {
    const decision = findServiceAreaForTrip(
      [area],
      { lat: 17.4, lng: 78.48 },
      { lat: 17.45, lng: 78.4 },
      "bike",
    );
    expect(decision.area?.id).toBe(area.id);
    expect(decision.reason).toBeNull();
  });

  it("rejects a destination outside the pickup service area", () => {
    const decision = findServiceAreaForTrip(
      [area],
      { lat: 17.4, lng: 78.48 },
      { lat: 18.2, lng: 79.4 },
      "bike",
    );
    expect(decision.area).toBeNull();
    expect(decision.reason).toContain("same active");
  });

  it("selects an effective rule and applies minimum/base/time pricing", () => {
    expect(findEffectivePricingRule([rule], area.id, "bike", "2026-07-06T08:00:00.000Z")?.id).toBe(rule.id);
    expect(calculateConfiguredFare(3, 10, rule)).toBe(40);
    expect(calculateConfiguredFare(10, 20, rule)).toBe(90);
  });

  it("classifies impossible movement while allowing plausible movement", () => {
    expect(assessLocationJump({
      accuracyM: 10,
      elapsedSeconds: 10,
      from: { lat: 17.385, lng: 78.4867 },
      fromAccuracyM: 10,
      to: { lat: 17.386, lng: 78.487 },
    }).suspicious).toBe(false);
    expect(assessLocationJump({
      accuracyM: 10,
      elapsedSeconds: 2,
      from: { lat: 17.385, lng: 78.4867 },
      fromAccuracyM: 10,
      to: { lat: 18.385, lng: 79.4867 },
    }).suspicious).toBe(true);
  });
});