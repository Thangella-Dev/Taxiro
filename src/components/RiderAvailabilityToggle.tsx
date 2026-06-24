"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";

export function RiderAvailabilityToggle({
  initial = false,
  location,
  onChanged,
  riderId,
}: {
  initial?: boolean;
  location?: { lat: number; lng: number };
  onChanged?: (available: boolean) => void;
  riderId: string;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !initial;
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

    if (!error) {
      onChanged?.(next);
    }
  }

  return (
    <Button
      className="max-w-[6.5rem] min-w-0 rounded-full px-2 text-xs sm:max-w-full sm:px-3 sm:text-sm"
      disabled={saving}
      onClick={() => void toggle()}
      size="sm"
      variant={initial ? "secondary" : "default"}
    >
      <span className="truncate">{saving ? "Updating" : initial ? "Online" : "Go online"}</span>
    </Button>
  );
}

