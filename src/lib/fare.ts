import { getVehicleSurcharge } from "@/lib/vehicles";
import type { VehicleType } from "@/types/database";

export const COMPANY_COMMISSION_RATE = 0.07;
export const ACCEPTED_RIDE_CANCELLATION_FINE = 50;
export const STANDARD_RATE_PER_KM = 7;
export const PEAK_RATE_PER_KM = 8;
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
  const isPeak = period !== "standard";
  const baseRatePerKm = isPeak ? PEAK_RATE_PER_KM : STANDARD_RATE_PER_KM;
  const vehicleSurchargePerKm = getVehicleSurcharge(vehicleType);
  const ratePerKm = baseRatePerKm + vehicleSurchargePerKm;

  return {
    fare: distanceKm === null ? null : Math.round(distanceKm * ratePerKm),
    baseRatePerKm,
    isPeak,
    period,
    periodLabel: getPricingPeriodLabel(period),
    ratePerKm,
    vehicleSurchargePerKm,
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

export function calculateFareBreakdown(fare: number | null): FareBreakdown {
  if (fare === null) {
    return {
      companyCommission: null,
      fare: null,
      riderEarning: null,
    };
  }

  const companyCommission = Math.round(fare * COMPANY_COMMISSION_RATE);
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
  if (!period) return "Fare rate";
  return getPricingPeriodLabel(period);
}

export function getUserCancellationFine(
  previousCancelledRideCount: number,
  rideWasAccepted: boolean,
) {
  if (!rideWasAccepted || previousCancelledRideCount < 2) {
    return 0;
  }

  return ACCEPTED_RIDE_CANCELLATION_FINE;
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
