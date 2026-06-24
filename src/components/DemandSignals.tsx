import { Clock3, Flame, MapPinned } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { RideRequest } from "@/types/database";

export function DemandSignals({ rides }: { rides: RideRequest[] }) {
  const scheduled = rides.filter((ride) => ride.status === "scheduled");
  const zones = Object.entries(
    scheduled.reduce<Record<string, number>>((counts, ride) => {
      const zone = ride.pickup_address.split(",")[0]?.trim() || "Selected area";
      counts[zone] = (counts[zone] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <Card className="min-w-0 max-w-full overflow-hidden rounded-2xl p-4">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Demand signals</p>
          <p className="text-sm text-muted-foreground">Where scheduled pickups are building</p>
        </div>
        <Flame className="size-5 shrink-0 text-amber-500" />
      </div>
      <div className="grid gap-3">
        {zones.length ? (
          zones.map(([zone, count]) => (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted p-3" key={zone}>
              <div className="flex min-w-0 items-center gap-3">
                <MapPinned className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{zone}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" /> upcoming demand
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-card px-2 py-1 text-sm font-semibold">
                {count}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No scheduled demand signals yet.</p>
        )}
      </div>
    </Card>
  );
}




