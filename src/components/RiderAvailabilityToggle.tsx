"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RiderAvailabilityToggle({
  available = false,
  canGoOnline = true,
  onChange,
  onError,
}: {
  available?: boolean;
  canGoOnline?: boolean;
  onChange: (available: boolean) => Promise<string | null>;
  onError?: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !available;
    if (next && !canGoOnline) return;

    setSaving(true);
    const error = await onChange(next);
    setSaving(false);

    if (error) onError?.(error);
  }

  return (
    <Button
      className="max-w-[6.5rem] min-w-0 rounded-full px-2 text-xs sm:max-w-full sm:px-3"
      disabled={saving || (!available && !canGoOnline)}
      onClick={() => void toggle()}
      size="sm"
      variant={available ? "secondary" : "default"}
    >
      <span className="truncate">
        {saving ? "Updating" : available ? "Online" : canGoOnline ? "Go online" : "Verify vehicle"}
      </span>
    </Button>
  );
}