"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle, Route } from "lucide-react";

import { LocationSearch } from "@/components/LocationSearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRoutePath, getRouteSummary } from "@/lib/maps";
import { getSupabase } from "@/lib/supabase";
import type { LatLng } from "@/types/database";

type RoutePreview = {
  distanceKm: number | null;
  durationMin: number | null;
  from: LatLng;
  path: LatLng[];
  to: LatLng;
};

export function RouteSetupForm({
  defaultExpanded = false,
  onRoutePreview,
  riderId,
}: {
  defaultExpanded?: boolean;
  onRoutePreview?: (preview: RoutePreview) => void;
  riderId: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [from, setFrom] = useState<LatLng | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [to, setTo] = useState<LatLng | null>(null);

  async function previewRoute(nextFrom: LatLng | null, nextTo: LatLng | null) {
    if (!nextFrom || !nextTo) return;
    setLoadingPreview(true);
    setMessage("Drawing your route on the map...");
    const [summary, path] = await Promise.all([
      getRouteSummary(nextFrom, nextTo),
      getRoutePath(nextFrom, nextTo),
    ]);
    const nextPreview = {
      distanceKm: summary.distanceKm,
      durationMin: summary.durationMin,
      from: nextFrom,
      path,
      to: nextTo,
    };
    setPreview(nextPreview);
    onRoutePreview?.(nextPreview);
    setMessage(path.length ? "Route preview is visible on the map." : "Route saved points selected. Map route preview is unavailable right now.");
    setLoadingPreview(false);
  }

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
    setMessage(error ? error.message : "On-The-Way route saved. Keep Taxiro open for matching jobs.");
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
            Preview a route line, then save your direction
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
        <div className="animate-in mt-4 grid min-w-0 max-w-full gap-3 border-t border-border pt-4">
          <LocationSearch
            label="From"
            onSelect={(selected) => {
              setFrom(selected);
              void previewRoute(selected, to);
            }}
            selectedValue={from?.address}
          />
          <LocationSearch
            label="To"
            onSelect={(selected) => {
              setTo(selected);
              void previewRoute(from, selected);
            }}
            selectedValue={to?.address}
          />
          {preview ? (
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="mt-1 font-black">{preview.distanceKm ?? "--"} km</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">ETA</p>
                <p className="mt-1 font-black">{preview.durationMin ?? "--"} min</p>
              </div>
            </div>
          ) : null}
          <Button className="h-12" disabled={loadingPreview} onClick={() => void saveRoute()}>
            {loadingPreview ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save route
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}