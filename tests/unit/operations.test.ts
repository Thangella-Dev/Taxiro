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
  supported_vehicle_types: ["bike", "auto", "car"],
  updated_at: "2026-07-06T00:00:00.000Z",
};

const rule: PricingRule = {
  base_fare: 10,
  company_commission_rate: 0.07,
  created_at: "2026-07-06T00:00:00.000Z",
  effective_from: "2026-07-01T00:00:00.000Z",
  effective_until: null,
  id: "bike-hyd",
  is_active: true,
  minimum_fare: 40,
  peak_windows: [],
  per_km_rate: 7,
  per_minute_rate: 0.5,
  service_area_id: area.id,
  vehicle_type: "bike",
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
