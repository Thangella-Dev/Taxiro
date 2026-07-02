import type { ReactNode } from "react";
import Link from "next/link";
import { Clock, MapPin, Navigation, UserRound } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { formatMoney, getFarePricingLabel } from "@/lib/fare";
import { getVehicleLabel } from "@/lib/vehicles";
import type { RideRequest } from "@/types/database";

export function RideCard({
  action,
  ride,
}: {
  action?: ReactNode;
  ride: RideRequest;
}) {
  const passengerName =
    ride.passenger_name ||
    (ride.booking_for === "other" ? "Guest passenger" : "Self ride");
  const passengerContext =
    ride.booking_for === "other"
      ? "Booked for someone else"
      : "Booked for customer";
  const effectiveRate = (ride.fare_rate_per_km ?? 0) + (ride.vehicle_surcharge_per_km ?? 0);
  const fareRate = effectiveRate
    ? `${getFarePricingLabel(ride.fare_pricing_period)}: Rs ${effectiveRate}/km ${getVehicleLabel(ride.vehicle_type)}`
    : null;

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg p-3">
      <div className="mb-2.5 grid gap-2 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StatusBadge status={ride.status} />
          <p className="mt-1.5 truncate text-sm font-semibold">
            Ride #{ride.id.slice(0, 8)}
          </p>
        </div>
        {action ? <div className="min-w-0 sm:shrink-0">{action}</div> : null}
      </div>

      <div className="mb-2.5 flex min-w-0 items-center gap-2 rounded-lg bg-muted p-2 text-xs">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-primary">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-black">{passengerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {passengerContext}
            {ride.passenger_phone ? ` | ${ride.passenger_phone}` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs leading-5">
        <p className="flex min-w-0 gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 break-words">
            {ride.pickup_address}
          </span>
        </p>
        <p className="flex min-w-0 gap-2">
          <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 break-words">{ride.drop_address}</span>
        </p>
        <p className="flex min-w-0 gap-2 text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {new Date(ride.scheduled_time).toLocaleString()}
          </span>
        </p>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {ride.distance_km ? <span>{ride.distance_km} km</span> : null}
        {ride.estimated_duration_min ? (
          <span>{ride.estimated_duration_min} min ETA</span>
        ) : null}
        {ride.fare_estimate ? (
          <span>{formatMoney(ride.fare_estimate)} fare</span>
        ) : null}
        {fareRate ? <span>{fareRate}</span> : null}
        <span>{ride.payment_status ?? "pending"}</span>
        <span className="uppercase">{ride.payment_method ?? "cash"}</span>
        {ride.cancellation_fee ? (
          <span>Fine {formatMoney(ride.cancellation_fee)}</span>
        ) : null}
        {ride.assigned_rider_id ? (
          <span>Rider {ride.assigned_rider_id.slice(0, 8)}</span>
        ) : null}
        {ride.accepted_at ? (
          <span>
            Accepted {new Date(ride.accepted_at).toLocaleTimeString()}
          </span>
        ) : null}
        {ride.started_at ? (
          <span>Started {new Date(ride.started_at).toLocaleTimeString()}</span>
        ) : null}
        {ride.completed_at ? (
          <span>
            Completed {new Date(ride.completed_at).toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      {ride.cancellation_reason ? (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          Cancelled: {ride.cancellation_reason}
          {ride.cancellation_fee
            ? ` Fine: ${formatMoney(ride.cancellation_fee)}`
            : ""}
        </p>
      ) : null}

      <Link
        className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-bold transition hover:bg-secondary"
        href={`/rides/${ride.id}`}
      >
        View ride details
      </Link>
    </Card>
  );
}
