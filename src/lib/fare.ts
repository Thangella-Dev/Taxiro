import type { VehicleType } from "@/types/database";

export const FARE_TIME_ZONE = "Asia/Kolkata";

export type FarePricingPeriod =
  "standard" | "morning_peak" | "evening_peak" | "night_peak";

export type VehicleFareQuote = {
  fare: number | null;
  isPeak: boolean;
  period: FarePricingPeriod;
  periodLabel: string;
  ratePerKm: number;
  baseRatePerKm: number;
  vehicleSurchargePerKm: number;
  vehicleType: VehicleType;
};

export type FareBreakdown = {
  companyCommission: number | null;
  fare: number | null;
  riderEarning: number | null;
};

export function getVehicleFareQuote(
  distanceKm: number | null,
  departureAt: Date | string = new Date(),
  vehicleType: VehicleType = "bike",
): VehicleFareQuote {
  const minutes = getIndiaMinutesOfDay(departureAt);
  const period = getPricingPeriod(minutes);
  return {
    fare: distanceKm === null ? null : null,
    baseRatePerKm: 0,
    isPeak: period !== "standard",
    period,
    periodLabel: "Admin pricing required",
    ratePerKm: 0,
    vehicleSurchargePerKm: 0,
    vehicleType,
  };
}

export function getBikeFareQuote(
  distanceKm: number | null,
  departureAt: Date | string = new Date(),
) {
  return getVehicleFareQuote(distanceKm, departureAt, "bike");
}
export function estimateBikeFare(
  distanceKm: number | null,
  departureAt?: Date | string,
) {
  return getBikeFareQuote(distanceKm, departureAt).fare;
}

export function calculateFareBreakdown(
  fare: number | null,
  commissionRate?: number | null,
): FareBreakdown {
  if (fare === null || fare === undefined) {
    return {
      companyCommission: null,
      fare: null,
      riderEarning: null,
    };
  }

  if (commissionRate === null || commissionRate === undefined) {
    return {
      companyCommission: null,
      fare,
      riderEarning: null,
    };
  }

  const companyCommission = Math.round(fare * commissionRate);
  return {
    companyCommission,
    fare,
    riderEarning: fare - companyCommission,
  };
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Rs --";
  }

  return `Rs ${Math.round(value)}`;
}

export function getFarePricingLabel(
  period: FarePricingPeriod | null | undefined,
) {
  if (!period) return "Configured fare";
  return getPricingPeriodLabel(period);
}

export function getUserCancellationFine(
  previousCancelledRideCount: number,
  rideWasAccepted: boolean,
) {
  void previousCancelledRideCount;
  void rideWasAccepted;
  return 0;
}

function getIndiaMinutesOfDay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;

  const parts = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: FARE_TIME_ZONE,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

function getPricingPeriod(minutes: number): FarePricingPeriod {
  if (minutes >= 9 * 60 && minutes < 10 * 60 + 30) return "morning_peak";
  if (minutes >= 17 * 60 && minutes < 18 * 60) return "evening_peak";
  if (minutes >= 22 * 60) return "night_peak";
  return "standard";
}

function getPricingPeriodLabel(period: FarePricingPeriod) {
  if (period === "morning_peak") return "Morning peak";
  if (period === "evening_peak") return "Evening peak";
  if (period === "night_peak") return "Night peak";
  return "Standard fare";
}