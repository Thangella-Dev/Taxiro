"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";

export function RiderAvailabilityToggle({
  canGoOnline = true,
  initial = false,
  location,
  onChanged,
  onError,
  riderId,
}: {
  canGoOnline?: boolean;
  initial?: boolean;
  location?: { lat: number; lng: number };
  onChanged?: (available: boolean) => void;
  onError?: (message: string) => void;
  riderId: string;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !initial;
    if (next && !canGoOnline) return;
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("rider_locations").upsert({
      is_available: next,
      lat: location?.lat ?? 17.385,
      lng: location?.lng ?? 78.4867,
      rider_id: riderId,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      onError?.(error.message);
      return;
    }
    onChanged?.(next);
  }

  return (
    <Button
      className="max-w-[6.5rem] min-w-0 rounded-full px-2 text-xs sm:max-w-full sm:px-3 sm:text-sm"
      disabled={saving || (!initial && !canGoOnline)}
      onClick={() => void toggle()}
      size="sm"
      variant={initial ? "secondary" : "default"}
    >
      <span className="truncate">{saving ? "Updating" : initial ? "Online" : canGoOnline ? "Go online" : "Verify vehicle"}</span>
    </Button>
  );
}

