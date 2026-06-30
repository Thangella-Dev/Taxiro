"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/fare";
import type { RideRequest } from "@/types/database";

const userReasons = [
  "Plans changed",
  "Booked by mistake",
  "Rider is taking too long",
  "Pickup location changed",
];

const riderReasons = [
  "Passenger is not at pickup",
  "Passenger asked for an unsafe route",
  "Unable to contact passenger",
  "Vehicle or safety issue",
];

export function CancelRideDialog({
  actor = "user",
  onClose,
  onConfirm,
  penaltyAmount = 0,
  ride,
}: {
  actor?: "rider" | "user";
  onClose: () => void;
  onConfirm: (reason: string) => Promise<string | null>;
  penaltyAmount?: number;
  ride: RideRequest;
}) {
  const reasons = actor === "rider" ? riderReasons : userReasons;
  const [busy, setBusy] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState("");
  const [selectedReason, setSelectedReason] = useState(reasons[0]);

  async function confirmCancellation() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const actionError = await onConfirm(customReason.trim() || selectedReason);
      if (actionError) setError(actionError);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Cancellation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1600] grid place-items-end bg-[#101713]/48 backdrop-blur-sm sm:place-items-center sm:p-3">
      <section aria-labelledby="cancel-ride-title" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-xl sm:p-5" role="dialog">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Ride #{ride.id.slice(0, 8)}
            </p>
            <h2 className="mt-1 text-2xl font-black" id="cancel-ride-title">{actor === "rider" ? "Release this job?" : "Cancel this ride?"}</h2>
          </div>
          <button
            aria-label="Close cancellation"
            className="flex size-11 items-center justify-center rounded-lg bg-muted"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        {penaltyAmount > 0 ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-black">Cancellation fine applies: {formatMoney(penaltyAmount)}</p>
            <p className="mt-1 leading-5">
              This is your 3rd or later user cancellation and a rider has already accepted this ride.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {reasons.map((reason) => (
            <button
              className={selectedReason === reason ? "rounded-lg bg-primary p-3 text-left text-sm font-bold text-primary-foreground" : "rounded-lg bg-muted p-3 text-left text-sm font-bold"}
              disabled={busy}
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
          disabled={busy}
          maxLength={160}
          onChange={(event) => setCustomReason(event.target.value)}
          placeholder="Add another reason (optional)"
          value={customReason}
        />
        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={onClose} variant="outline">
            Keep ride
          </Button>
          <Button
            disabled={busy}
            onClick={() => void confirmCancellation()}
            variant="destructive"
          >
            {busy ? "Cancelling..." : "Cancel ride"}
          </Button>
        </div>
      </section>
    </div>
  );
}
