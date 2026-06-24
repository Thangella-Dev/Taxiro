import { Check, Circle, KeyRound, MapPin, Radio, Route } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RideRequest, RideStatus } from "@/types/database";

const steps: Array<{
  icon: typeof Circle;
  label: string;
  status: RideStatus;
}> = [
  { icon: Circle, label: "Scheduled", status: "scheduled" },
  { icon: Radio, label: "Ready", status: "ready" },
  { icon: MapPin, label: "Rider assigned", status: "assigned" },
  { icon: KeyRound, label: "Code verified", status: "started" },
  { icon: Route, label: "Completed", status: "completed" },
];

const stepOrder = steps.map((step) => step.status);

export function RideProgress({ ride }: { ride: RideRequest }) {
  const activeIndex = Math.max(stepOrder.indexOf(ride.status), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Ride flow</p>
          <p className="text-xs text-muted-foreground">
            Code is shown only to the user after rider acceptance.
          </p>
        </div>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
          Live
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {steps.map(({ icon: Icon, label }, index) => {
          const isDone = index < activeIndex || ride.status === "completed";
          const isCurrent = index === activeIndex && ride.status !== "completed";
          return (
            <div className="grid gap-2" key={label}>
              <div
                className={cn(
                  "flex h-10 items-center justify-center rounded-md border text-muted-foreground transition",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-secondary text-primary",
                )}
              >
                {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <p
                className={cn(
                  "text-center text-[11px] leading-tight text-muted-foreground",
                  (isCurrent || isDone) && "font-medium text-foreground",
                )}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
