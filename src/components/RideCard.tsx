import Link from "next/link";
import { Clock, MapPin, Navigation } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import type { RideRequest } from "@/types/database";

export function RideCard({
  action,
  ride,
}: {
  action?: React.ReactNode;
  ride: RideRequest;
}) {
  const breakdown = calculateFareBreakdown(ride.fare_estimate);
  const companyCommission = ride.company_commission ?? breakdown.companyCommission;
  const riderEarning = ride.rider_earning ?? breakdown.riderEarning;

  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl p-4">
      <div className="mb-4 grid gap-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <StatusBadge status={ride.status} />
          <p className="mt-2 truncate font-semibold">Ride #{ride.id.slice(0, 8)}</p>
        </div>
        {action ? <div className="min-w-0 sm:shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-3 text-sm">
        <p className="flex min-w-0 gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 break-words">{ride.pickup_address}</span>
        </p>
        <p className="flex min-w-0 gap-2">
          <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 break-words">{ride.drop_address}</span>
        </p>
        <p className="flex min-w-0 gap-2 text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{new Date(ride.scheduled_time).toLocaleString()}</span>
        </p>
      </div>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
        {ride.distance_km ? <span>{ride.distance_km} km</span> : null}
        {ride.estimated_duration_min ? (
          <span>{ride.estimated_duration_min} min ETA</span>
        ) : null}
        {ride.fare_estimate ? <span>{formatMoney(ride.fare_estimate)} fare</span> : null}
        {companyCommission ? <span>Taxiro {formatMoney(companyCommission)}</span> : null}
        {riderEarning ? <span>Rider earns {formatMoney(riderEarning)}</span> : null}
        <span>{ride.payment_status ?? "pending"}</span>
        <span className="uppercase">{ride.payment_method ?? "cash"}</span>
        {ride.cancellation_fee ? <span>Fine {formatMoney(ride.cancellation_fee)}</span> : null}
        {ride.assigned_rider_id ? (
          <span>Rider {ride.assigned_rider_id.slice(0, 8)}</span>
        ) : null}
        {ride.accepted_at ? <span>Accepted {new Date(ride.accepted_at).toLocaleTimeString()}</span> : null}
        {ride.started_at ? <span>Started {new Date(ride.started_at).toLocaleTimeString()}</span> : null}
        {ride.completed_at ? <span>Completed {new Date(ride.completed_at).toLocaleTimeString()}</span> : null}
      </div>
      {ride.cancellation_reason ? (
        <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          Cancelled: {ride.cancellation_reason}{ride.cancellation_fee ? ` Fine: ${formatMoney(ride.cancellation_fee)}` : ""}
        </p>
      ) : null}
      <Link
        className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-bold transition hover:bg-secondary"
        href={`/rides/${ride.id}`}
      >
        View ride details
      </Link>
    </Card>
  );
}


