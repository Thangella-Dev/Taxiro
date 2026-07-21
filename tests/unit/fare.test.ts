import { describe, expect, it } from "vitest";

import { calculateFareBreakdown, getUserCancellationFine, getVehicleFareQuote } from "@/lib/fare";

describe("fare display helpers", () => {
  it("does not embed business fare rates in the client fallback", () => {
    const departure = "2026-07-03T06:30:00.000Z";
    const quote = getVehicleFareQuote(10, departure, "bike");

    expect(quote.fare).toBeNull();
    expect(quote.ratePerKm).toBe(0);
    expect(quote.periodLabel).toBe("Admin pricing required");
  });

  it("still labels peak windows for UI context without calculating fare", () => {
    const departure = "2026-07-03T04:00:00.000Z";
    const quote = getVehicleFareQuote(10, departure, "auto");

    expect(quote.isPeak).toBe(true);
    expect(quote.period).toBe("morning_peak");
    expect(quote.fare).toBeNull();
  });

  it("calculates a split only when an explicit commission rate is provided", () => {
    expect(calculateFareBreakdown(200)).toEqual({ companyCommission: null, fare: 200, riderEarning: null });
    expect(calculateFareBreakdown(200, 0.07)).toEqual({ companyCommission: 14, fare: 200, riderEarning: 186 });
  });

  it("does not hardcode cancellation penalties in the client helper", () => {
    expect(getUserCancellationFine(1, true)).toBe(0);
    expect(getUserCancellationFine(2, false)).toBe(0);
    expect(getUserCancellationFine(2, true)).toBe(0);
  });
});