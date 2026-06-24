"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RideRequest } from "@/types/database";

const reasons = [
  "Plans changed",
  "Booked by mistake",
  "Rider is taking too long",
  "Pickup location changed",
];

export function CancelRideDialog({
  onClose,
  onConfirm,
  ride,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  ride: RideRequest;
}) {
  const [customReason, setCustomReason] = useState("");
  const [selectedReason, setSelectedReason] = useState(reasons[0]);

  return (
    <div className="absolute inset-0 z-[1600] grid place-items-end bg-[#101713]/45 p-2 backdrop-blur-sm sm:place-items-center">
      <section className="w-full max-w-md rounded-[1.75rem] bg-card p-4 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Ride #{ride.id.slice(0, 8)}
            </p>
            <h2 className="mt-1 text-2xl font-black">Cancel this ride?</h2>
          </div>
          <button
            aria-label="Close cancellation"
            className="flex size-10 items-center justify-center rounded-full bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="mt-4 grid gap-2">
          {reasons.map((reason) => (
            <button
              className={selectedReason === reason ? "rounded-2xl bg-primary p-3 text-left text-sm font-bold text-primary-foreground" : "rounded-2xl bg-muted p-3 text-left text-sm font-bold"}
              key={reason}
              onClick={() => setSelectedReason(reason)}
              type="button"
            >
              {reason}
            </button>
          ))}
        </div>
        <Input
          className="mt-3"
          maxLength={160}
          onChange={(event) => setCustomReason(event.target.value)}
          placeholder="Add another reason (optional)"
          value={customReason}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="rounded-full" onClick={onClose} variant="outline">
            Keep ride
          </Button>
          <Button
            className="rounded-full"
            onClick={() => onConfirm(customReason.trim() || selectedReason)}
            variant="destructive"
          >
            Cancel ride
          </Button>
        </div>
      </section>
    </div>
  );
}
