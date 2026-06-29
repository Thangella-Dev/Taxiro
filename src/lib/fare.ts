export const COMPANY_COMMISSION_RATE = 0.07;
export const ACCEPTED_RIDE_CANCELLATION_FINE = 50;

export type FareBreakdown = {
  companyCommission: number | null;
  fare: number | null;
  riderEarning: number | null;
};

export function estimateBikeFare(distanceKm: number | null, durationMin: number | null) {
  if (distanceKm === null || durationMin === null) {
    return null;
  }

  const baseFare = 20;
  const distanceFare = distanceKm * 7;
  const timeFare = durationMin * 0.75;
  return Math.max(35, Math.round(baseFare + distanceFare + timeFare));
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

export function getUserCancellationFine(previousCancelledRideCount: number, rideWasAccepted: boolean) {
  if (!rideWasAccepted || previousCancelledRideCount < 2) {
    return 0;
  }

  return ACCEPTED_RIDE_CANCELLATION_FINE;
}