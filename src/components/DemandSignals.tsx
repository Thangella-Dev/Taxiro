import { useEffect, useState } from "react";
import { Clock3, Flame, MapPinned, Radio } from "lucide-react";

import { Card } from "@/components/ui/card";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import type { RideRequest } from "@/types/database";

function isReadySignalVisible(ride: RideRequest, now: number) {
  if (ride.status !== "ready") return false;
  if (!ride.ready_expires_at) return true;
  return new Date(ride.ready_expires_at).getTime() > now;
}

function readySignalLabel(ride: RideRequest, now: number) {
  if (ride.status !== "ready") {
    return new Date(ride.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (!ride.ready_expires_at) return "ready now";
  const minutes = Math.max(0, Math.ceil((new Date(ride.ready_expires_at).getTime() - now) / 60_000));
  return minutes <= 1 ? "ready, under 1 min left" : `ready, ${minutes} min left`;
}

export function DemandSignals({ compact = false, rides }: { compact?: boolean; rides: RideRequest[] }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialTimer = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
  const ready = rides.filter((ride) => isReadySignalVisible(ride, now));
  const scheduled = rides.filter((ride) => ride.status === "scheduled");
  const visibleSignals = [...ready, ...scheduled]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "ready" ? -1 : 1;
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    })
    .slice(0, 6);

  return (
    <Card className={compact ? "min-w-0 max-w-full overflow-hidden border-secondary/50 bg-secondary/20 p-3" : "min-w-0 max-w-full overflow-hidden p-4"}>
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{compact ? "Advance demand signals" : "Demand signals"}</p>
          <p className="text-sm text-muted-foreground">Ready jobs first, then upcoming pickup demand</p>
        </div>
        <Flame className="size-5 shrink-0 text-amber-500" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-secondary p-3 font-black">{ready.length} ready now</div>
        <div className="rounded-lg bg-muted p-3 font-black">{scheduled.length} scheduled</div>
      </div>
      <div className={compact ? "hidden" : "grid gap-3"}>
        {visibleSignals.length ? (
          visibleSignals.map((ride) => {
            const earning = ride.rider_earning ?? calculateFareBreakdown(ride.fare_estimate).riderEarning;
            const readyNow = ride.status === "ready";
            return (
              <div className={readyNow ? "min-w-0 rounded-lg border border-secondary bg-secondary/70 p-3" : "min-w-0 rounded-lg bg-muted p-3"} key={ride.id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {readyNow ? <Radio className="mt-1 size-4 shrink-0 text-primary" /> : <MapPinned className="mt-1 size-4 shrink-0 text-primary" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{ride.pickup_address.split(",")[0] || "Pickup area"}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" /> {readySignalLabel(ride, now)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">{formatMoney(ride.fare_estimate)}</p>
                    <p className="text-xs font-bold text-muted-foreground">earn {formatMoney(earning)}</p>
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">Drop: {ride.drop_address}</p>
              </div>
            );
          })
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No ready or scheduled demand signals yet.</p>
        )}
      </div>
    </Card>
  );
}