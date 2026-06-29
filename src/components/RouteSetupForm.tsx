"use client";

import { useState } from "react";
import { ChevronDown, Route } from "lucide-react";

import { LocationSearch } from "@/components/LocationSearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRouteSummary } from "@/lib/maps";
import { getSupabase } from "@/lib/supabase";
import type { LatLng } from "@/types/database";

export function RouteSetupForm({ riderId }: { riderId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [from, setFrom] = useState<LatLng | null>(null);
  const [message, setMessage] = useState("");
  const [to, setTo] = useState<LatLng | null>(null);

  async function saveRoute() {
    if (!from || !to) {
      setMessage("Choose both route endpoints.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Add Supabase env variables to save routes.");
      return;
    }
    const summary = await getRouteSummary(from, to);
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const { error } = await supabase.from("rider_routes").insert({
      end_time: end.toISOString(),
      from_address: from.address ?? "Selected start",
      from_lat: from.lat,
      from_lng: from.lng,
      rider_id: riderId,
      route_polyline: summary.polyline,
      start_time: now.toISOString(),
      status: "active",
      to_address: to.address ?? "Selected destination",
      to_lat: to.lat,
      to_lng: to.lng,
    });
    setMessage(error ? error.message : "On-The-Way route saved.");
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden p-4">
      <button
        aria-expanded={expanded}
        className="flex w-full min-w-0 items-center gap-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Route className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">On-The-Way route</span>
          <span className="block truncate text-sm text-muted-foreground">
            Find trips along your planned direction
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
        <div className="animate-in mt-4 grid min-w-0 max-w-full gap-3 border-t border-border pt-4">
          <LocationSearch label="From" onSelect={setFrom} />
          <LocationSearch label="To" onSelect={setTo} />
          <Button className="h-12" onClick={() => void saveRoute()}>
            Save route
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
