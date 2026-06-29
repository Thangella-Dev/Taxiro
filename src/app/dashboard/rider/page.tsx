"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bike,
  Clock3,
  Gauge,
  LocateFixed,
  Menu,
  MapPinned,
  Navigation,
  Radio,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CancelRideDialog } from "@/components/CancelRideDialog";
import { DemandSignals } from "@/components/DemandSignals";
import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { RideChatPanel } from "@/components/RideChatPanel";
import { RideProgress } from "@/components/RideProgress";
import { RiderAvailabilityToggle } from "@/components/RiderAvailabilityToggle";
import { RiderMenu } from "@/components/RiderMenu";
import { RouteSetupForm } from "@/components/RouteSetupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProfile, getCurrentUser, getProfile } from "@/lib/auth";
import { getRoutePath, getRouteSummary } from "@/lib/maps";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { watchRiderLocation, type RiderTrackingUpdate } from "@/lib/tracking";
import { getSupabase } from "@/lib/supabase";
import { useLiveResync } from "@/lib/useLiveResync";
import type { LatLng, Profile, RideRequest, RiderLocation } from "@/types/database";

export default function RiderDashboard() {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<RideRequest | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<LatLng>({ lat: 17.385, lng: 78.4867 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("GPS starting...");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number | null; durationMin: number | null } | null>(null);

  const loadRiderData = useCallback(async (riderId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const [rideResult, riderResult, myLocationResult] = await Promise.all([
      supabase
        .from("ride_requests")
        .select("*")
        .or(`status.in.(scheduled,ready),assigned_rider_id.eq.${riderId}`)
        .order("created_at", { ascending: false }),
      supabase.from("rider_locations").select("*"),
      supabase.from("rider_locations").select("*").eq("rider_id", riderId).maybeSingle(),
    ]);

    if (rideResult.error) {
      setMessage(rideResult.error.message);
    } else {
      setRides((rideResult.data as RideRequest[]) ?? []);
    }
    if (riderResult.data) {
      setRiders(riderResult.data as RiderLocation[]);
    }
    if (myLocationResult.data) {
      const current = myLocationResult.data as RiderLocation;
      setRiderLocation(current);
      setLocation({ lat: current.lat, lng: current.lng });
      setGpsStatus(current.last_seen_at ? `Last live update ${formatTrackingAge(current.last_seen_at)}` : "Tap refresh or allow GPS tracking.");
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      queueMicrotask(() => {
        setMessage("Supabase is not configured.");
        setLoading(false);
      });
      return;
    }

    let riderId: string | null = null;
    void getCurrentUser(supabase).then(async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      await ensureProfile(supabase, user, "rider");
      const currentProfile = await getProfile(supabase, user.id);
      riderId = user.id;
      setProfile(currentProfile);
      await loadRiderData(user.id);
      setLoading(false);
    });

    const channel = supabase
      .channel("rider-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        (payload) => {
          if (!riderId) return;

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideRequest>;
            if (deleted.id) {
              setRides((current) => current.filter((ride) => ride.id !== deleted.id));
            }
            return;
          }

          const incoming = payload.new as RideRequest;
          const visibleToRider = ["scheduled", "ready"].includes(incoming.status) || incoming.assigned_rider_id === riderId;
          setRides((current) => {
            if (!visibleToRider) return current.filter((ride) => ride.id !== incoming.id);
            return sortRides(upsertById(current, incoming));
          });
          void loadRiderData(riderId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_locations" },
        (payload) => {
          if (!riderId) return;

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderLocation>;
            if (deleted.rider_id) {
              setRiders((current) => current.filter((rider) => rider.rider_id !== deleted.rider_id));
              if (deleted.rider_id === riderId) setRiderLocation(null);
            }
            return;
          }

          const incoming = payload.new as RiderLocation;
          setRiders((current) => upsertRiderLocation(current, incoming));
          if (incoming.rider_id === riderId) {
            setRiderLocation(incoming);
            setLocation({ lat: incoming.lat, lng: incoming.lng });
            setGpsStatus(incoming.last_seen_at ? `Live GPS ${formatTrackingAge(incoming.last_seen_at)}` : "Location updated.");
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage("Live rider updates are reconnecting. Keep Taxiro open for instant jobs and tracking.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRiderData]);


  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !profile || profile.role !== "rider") return;

    const stop = watchRiderLocation({
      isAvailable: riderLocation?.is_available ?? true,
      onError: (trackingError) => {
        setGpsStatus(`${trackingError} Search or choose on map if needed.`);
      },
      onUpdate: (liveLocation: RiderTrackingUpdate) => {
        const now = new Date().toISOString();
        setLocation({ lat: liveLocation.lat, lng: liveLocation.lng });
        setRiderLocation((current) => ({
          accuracy_m: liveLocation.accuracy_m,
          heading: liveLocation.heading,
          is_available: current?.is_available ?? true,
          last_seen_at: now,
          lat: liveLocation.lat,
          lng: liveLocation.lng,
          rider_id: profile.id,
          speed: liveLocation.speed,
          updated_at: now,
        }));
        setGpsStatus(`Live GPS on${liveLocation.accuracy_m ? ` • +/-${Math.round(liveLocation.accuracy_m)}m` : ""}`);
      },
      riderId: profile.id,
      supabase,
    });

    return () => {
      stop?.();
    };
  }, [profile, riderLocation?.is_available]);
  const resyncRiderData = useCallback(async () => {
    if (profile?.id) {
      await loadRiderData(profile.id);
    }
  }, [loadRiderData, profile]);

  useLiveResync({
    enabled: Boolean(profile?.id),
    intervalMs: 5000,
    onResync: resyncRiderData,
  });
  async function updateLocation(point: LatLng & Partial<RiderTrackingUpdate>) {
    if (!profile) {
      setMessage("Please sign in as a rider.");
      return;
    }
    setLocation(point);
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("rider_locations").upsert({
      is_available: riderLocation?.is_available ?? true,
      lat: point.lat,
      lng: point.lng,
      rider_id: profile.id,
      accuracy_m: point.accuracy_m ?? riderLocation?.accuracy_m ?? null,
      heading: point.heading ?? riderLocation?.heading ?? null,
      last_seen_at: new Date().toISOString(),
      speed: point.speed ?? riderLocation?.speed ?? null,
      updated_at: new Date().toISOString(),
    });
    setGpsStatus(error ? "Manual location update failed." : `Manual location updated${point.accuracy_m ? ` • +/-${Math.round(point.accuracy_m)}m` : ""}.`);
    setMessage(error ? error.message : "Location updated.");
    await loadRiderData(profile.id);
  }

  async function acceptRide(ride: RideRequest) {
    if (!profile) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("accept_ready_ride", {
      p_ride_id: ride.id,
    });
    setMessage(error ? error.message : "Ride accepted. Go to pickup.");
    await loadRiderData(profile.id);
  }

  async function verifyAndStart(ride: RideRequest) {
    if (!profile) {
      return;
    }
    const code = codes[ride.id]?.trim();
    if (!code || code.length !== 4) {
      setMessage("Enter the 4-digit code shown to the user.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("verify_ride_code", {
      p_code: code,
      p_ride_id: ride.id,
    });
    setMessage(error ? error.message : "Code verified. Ride started.");
    await loadRiderData(profile.id);
  }

  async function cancelRide(ride: RideRequest, reason: string) {
    if (!profile) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("cancel_ride", {
      p_reason: reason,
      p_ride_id: ride.id,
    });
    setMessage(error ? error.message : "Ride cancelled and released.");
    if (!error) {
      setCancelTarget(null);
    }
    await loadRiderData(profile.id);
  }

  async function markReachedDrop(ride: RideRequest) {
    if (!profile) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("mark_ride_reached_drop", {
      p_ride_id: ride.id,
    });
    setMessage(error ? error.message : "Drop reached. Collect payment, then confirm payment received.");
    await loadRiderData(profile.id);
  }

  async function confirmPaymentAndComplete(ride: RideRequest) {
    if (!profile) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("confirm_ride_payment_and_complete", {
      p_ride_id: ride.id,
    });
    setMessage(error ? error.message : "Payment received. Ride completed and you are available again.");
    await loadRiderData(profile.id);
  }

  async function signOut() {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/auth");
    router.refresh();
  }

  function directionsUrl(from: LatLng, to: LatLng) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.lat}%2C${from.lng}%3B${to.lat}%2C${to.lng}`;
  }

  const readyRides = rides
    .filter((ride) => ride.status === "ready")
    .sort((a, b) => approxDistanceKm(location, a) - approxDistanceKm(location, b));
  const demandMapRides = rides
    .filter((ride) => ["ready", "scheduled"].includes(ride.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "ready" ? -1 : 1;
      return approxDistanceKm(location, a) - approxDistanceKm(location, b);
    })
    .slice(0, 18);
  const activeRide = rides.find(
    (ride) =>
      ride.assigned_rider_id === profile?.id &&
      ["assigned", "started"].includes(ride.status),
  );
  const mapDrop = useMemo(
    () =>
      activeRide
        ? { address: activeRide.drop_address, lat: activeRide.drop_lat, lng: activeRide.drop_lng }
        : null,
    [activeRide],
  );
  const mapPickup = useMemo(
    () =>
      activeRide
        ? {
            address: activeRide.pickup_address,
            lat: activeRide.pickup_lat,
            lng: activeRide.pickup_lng,
          }
        : location,
    [activeRide, location],
  );

  useEffect(() => {
    let ignore = false;

    async function loadRoutePath() {
      if (!activeRide) {
        setRoutePath([]);
        setRouteSummary(null);
        return;
      }

      const from = { lat: location.lat, lng: location.lng };
      const to = activeRide.status === "assigned"
        ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }
        : { lat: activeRide.drop_lat, lng: activeRide.drop_lng };
      const [path, summary] = await Promise.all([getRoutePath(from, to), getRouteSummary(from, to)]);
      if (!ignore) {
        setRoutePath(path);
        setRouteSummary(summary);
      }
    }

    void loadRoutePath();

    return () => {
      ignore = true;
    };
  }, [activeRide, location.lat, location.lng]);

  if (!loading && (!profile || profile.role !== "rider")) {
    return (
      <AppShell title="Rider app">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle>{profile ? "Rider account required" : "Sign in required"}</CardTitle>
            <CardDescription>
              {profile
                ? "This app area is only for riders. Customers use the booking app."
                : "Create a rider account or sign in to manage real rides."}
            </CardDescription>
          </CardHeader>
          <Button asChild>
            <Link href="/auth">Go to sign in</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell immersive title="Rider app">
      <div className="relative min-h-0 min-w-0 w-full max-w-full overflow-x-clip bg-muted sm:min-h-[100svh] [contain:inline-size] sm:overflow-hidden">
        <DynamicMapPicker
          className="h-[38svh] min-h-[16rem] overflow-hidden sm:h-[100svh] sm:min-h-[100svh]"
          demandRides={activeRide ? [] : demandMapRides}
          drop={mapDrop}
          onPick={(point) => void updateLocation(point)}
          pickup={mapPickup}
          riders={riders}
          route={routePath}
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3 sm:gap-3">
          <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-2.5 shadow-2xl backdrop-blur-xl sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Taxiro rider</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-tight sm:gap-2 sm:text-lg">
              <Bike className="size-4 sm:size-5" />
              {activeRide ? riderHeadline(activeRide.status) : "Find nearby work"}
            </p>
          </div>
          <div className="pointer-events-auto flex min-w-0 shrink items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1 shadow-2xl backdrop-blur-xl sm:gap-2">
            <span className="hidden pl-3 text-xs font-semibold text-muted-foreground sm:inline">
              {riderLocation?.is_available ? "Online" : "Offline"}
            </span>
            {profile ? (
              <RiderAvailabilityToggle
                initial={riderLocation?.is_available ?? false}
                location={location}
                onChanged={(isAvailable) =>
                  setRiderLocation((current) => ({
                    is_available: isAvailable,
                    lat: current?.lat ?? location.lat,
                    lng: current?.lng ?? location.lng,
                    rider_id: profile.id,
                    accuracy_m: current?.accuracy_m ?? null,
                    heading: current?.heading ?? null,
                    last_seen_at: current?.last_seen_at ?? new Date().toISOString(),
                    speed: current?.speed ?? null,
                    updated_at: new Date().toISOString(),
                  }))
                }
                riderId={profile.id}
              />
            ) : null}
            <button
              aria-label="Open rider menu"
              className="flex size-9 items-center justify-center rounded-full text-primary transition hover:bg-muted"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        <div className="absolute right-2 top-20 z-[1200] grid max-w-[calc(100%-1rem)] justify-items-end gap-2 sm:right-4 sm:top-24">
          <div className="max-w-[14rem] rounded-2xl border border-white/70 bg-white/95 px-3 py-2 text-right text-[11px] font-bold text-muted-foreground shadow-xl backdrop-blur">
            {gpsStatus}
          </div>
          <button
            aria-label="Refresh rider location"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card/95 shadow-xl backdrop-blur sm:size-11"
            onClick={() => void updateLocation(location)}
            type="button"
          >
            <LocateFixed className="size-4 text-primary sm:size-5" />
          </button>
        </div>

        <section className="relative z-[1200] mx-auto -mt-8 w-[calc(100%-1rem)] min-w-0 max-w-full overflow-x-clip pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:absolute sm:inset-x-0 sm:bottom-0 sm:mx-auto sm:-mt-0 sm:w-full sm:max-w-[36rem] sm:px-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 max-w-full overflow-x-clip rounded-t-[2rem] border border-white/80 bg-white/95 p-3 shadow-[0_24px_90px_rgb(0_0_0_/_0.22)] backdrop-blur-2xl sm:max-h-[76dvh] sm:overflow-y-auto sm:rounded-[2rem] sm:p-4">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            {activeRide ? (
              <ActiveRiderJob
                code={codes[activeRide.id] ?? ""}
                currentUserId={profile?.id ?? null}
                directionsUrl={directionsUrl}
                location={location}
                routeSummary={routeSummary}
                riderLocation={riderLocation}
                onCodeChange={(value) =>
                  setCodes((current) => ({
                    ...current,
                    [activeRide.id]: value.replace(/\D/g, ""),
                  }))
                }
                onCancel={() => setCancelTarget(activeRide)}
                onReachedDrop={() => void markReachedDrop(activeRide)}
                onPaymentReceived={() => void confirmPaymentAndComplete(activeRide)}
                onStart={() => void verifyAndStart(activeRide)}
                ride={activeRide}
              />
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-xl font-black tracking-tight sm:text-3xl">Ready ride requests</h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Nearby requests update live while you are online.
                    </p>
                  </div>
                  <Badge className="bg-secondary text-secondary-foreground">
                    {readyRides.length} ready
                  </Badge>
                </div>
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                  <MiniStat icon={Radio} label="Ready" value={readyRides.length} />
                  <MiniStat
                    icon={Clock3}
                    label="Scheduled"
                    value={rides.filter((ride) => ride.status === "scheduled").length}
                  />
                  <MiniStat
                    icon={Gauge}
                    label="Riders"
                    value={riders.filter((rider) => rider.is_available).length}
                  />
                </div>
                <div className="max-h-[36svh] overflow-y-auto overflow-x-hidden">
                  <div className="grid gap-3">
                    {readyRides.length ? (
                      readyRides.map((ride) => (
                        <RequestCard
                          currentLocation={location}
                          key={ride.id}
                          onAccept={() => void acceptRide(ride)}
                          ride={ride}
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                        No ready requests right now. Go online and keep location fresh.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {message ? <p className="mt-3 text-center text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </section>
        {activeRide ? (
          <div className="absolute left-2 right-2 top-20 z-[1200] mx-auto hidden max-w-xl grid-cols-3 gap-1.5 sm:left-3 sm:right-3 sm:top-24 sm:grid sm:gap-2">
            <FloatingStat label="Job" value={activeRide.status} />
            <FloatingStat label="ETA" value={`${activeRide.estimated_duration_min ?? "--"}m`} />
            <FloatingStat label="KM" value={`${activeRide.distance_km ?? "--"}`} />
          </div>
        ) : null}
        {cancelTarget ? (
          <CancelRideDialog
            onClose={() => setCancelTarget(null)}
            onConfirm={(reason) => void cancelRide(cancelTarget, reason)}
            penaltyAmount={0}
            ride={cancelTarget}
          />
        ) : null}
        {menuOpen ? (
          <RiderMenu
            onClose={() => setMenuOpen(false)}
            onProfileSaved={setProfile}
            onSignOut={() => void signOut()}
            profile={profile}
            rides={rides.filter((ride) => ride.assigned_rider_id === profile?.id)}
          />
        ) : null}
      </div>

      <section className="grid w-full min-w-0 max-w-full gap-3 overflow-x-clip bg-background px-2 py-3 pb-24 sm:px-4 sm:py-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pb-5">
        <div className="min-w-0 max-w-full overflow-hidden" id="demand">
          <DemandSignals rides={rides} />
        </div>
        <div className="min-w-0 max-w-full overflow-hidden" id="route">{profile ? <RouteSetupForm riderId={profile.id} /> : null}</div>
      </section>
    </AppShell>
  );
}

function FloatingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-center shadow-2xl backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black capitalize">{value}</p>
    </div>
  );
}

function riderHeadline(status: RideRequest["status"]) {
  if (status === "started") {
    return "Ride in progress";
  }
  if (status === "assigned") {
    return "Go to pickup";
  }
  return "Find nearby work";
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bike;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted p-2 sm:p-3">
      <Icon className="mb-2 size-4 text-primary" />
      <p className="truncate text-base font-semibold leading-none sm:text-lg">{value}</p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-[11px]">{label}</p>
    </div>
  );
}

function approxDistanceKm(from: LatLng, ride: RideRequest) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(ride.pickup_lat - from.lat);
  const dLng = toRad(ride.pickup_lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(ride.pickup_lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function RequestCard({
  currentLocation,
  onAccept,
  ride,
}: {
  currentLocation: LatLng;
  onAccept: () => void;
  ride: RideRequest;
}) {
  const fareBreakdown = calculateFareBreakdown(ride.fare_estimate);
  const riderEarning = ride.rider_earning ?? fareBreakdown.riderEarning;
  const companyCommission = ride.company_commission ?? fareBreakdown.companyCommission;
  const pickupDistance = approxDistanceKm(currentLocation, ride);

  return (
    <div className="min-w-0 rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge className="bg-secondary text-secondary-foreground">Ready now</Badge>
          <p className="mt-2 font-black">Ride #{ride.id.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pickupDistance} km away from you</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:min-w-48">
          <div className="rounded-2xl bg-muted p-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Fare</p>
            <p className="font-black">{formatMoney(ride.fare_estimate)}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-2">
            <p className="text-[10px] font-bold uppercase text-secondary-foreground/70">You earn</p>
            <p className="font-black text-secondary-foreground">{formatMoney(riderEarning)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <p className="flex gap-2">
          <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2">{ride.pickup_address}</span>
        </p>
        <p className="flex gap-2">
          <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2">{ride.drop_address}</span>
        </p>
      </div>
      {ride.rider_note ? (
        <p className="mt-3 rounded-2xl bg-secondary/80 p-3 text-sm font-semibold">
          Pickup note: {ride.rider_note}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-muted p-2">
          <p className="font-black">{ride.distance_km ?? "--"}</p>
          <p className="text-muted-foreground">km trip</p>
        </div>
        <div className="rounded-2xl bg-muted p-2">
          <p className="font-black">{ride.estimated_duration_min ?? "--"}</p>
          <p className="text-muted-foreground">min</p>
        </div>
        <div className="rounded-2xl bg-muted p-2">
          <p className="font-black uppercase">{ride.payment_method ?? "cash"}</p>
          <p className="text-muted-foreground">pay</p>
        </div>
        <div className="rounded-2xl bg-muted p-2">
          <p className="font-black">{formatMoney(companyCommission)}</p>
          <p className="text-muted-foreground">Taxiro</p>
        </div>
      </div>
      <Button className="mt-4 h-12 w-full rounded-full bg-[#101713] text-base font-black text-white hover:bg-[#101713]/90" onClick={onAccept}>
        Accept ride - earn {formatMoney(riderEarning)}
      </Button>
    </div>
  );
}

function ActiveRiderJob({
  code,
  currentUserId,
  onCancel,
  directionsUrl,
  location,
  riderLocation,
  routeSummary,
  onCodeChange,
  onPaymentReceived,
  onReachedDrop,
  onStart,
  ride,
}: {
  code: string;
  currentUserId: string | null;
  onCancel: () => void;
  directionsUrl: (from: LatLng, to: LatLng) => string;
  location: LatLng;
  riderLocation: RiderLocation | null;
  routeSummary: { distanceKm: number | null; durationMin: number | null } | null;
  onCodeChange: (value: string) => void;
  onPaymentReceived: () => void;
  onReachedDrop: () => void;
  onStart: () => void;
  ride: RideRequest;
}) {
  const destination = ride.status === "assigned" ? "pickup" : "drop";
  const currentTask = ride.status === "assigned"
    ? "Reach pickup and verify code"
    : "Navigate to drop and complete ride";
  const taskHelp = ride.status === "assigned"
    ? "Keep Taxiro open so the customer can see your live arrival. Ask for the 4 digit code only after reaching pickup."
    : "The customer code is verified. Live tracking now follows the trip to the destination.";
  const liveEta = routeSummary?.durationMin ?? ride.estimated_duration_min;
  const liveDistance = routeSummary?.distanceKm ?? ride.distance_km;
  const fareBreakdown = calculateFareBreakdown(ride.fare_estimate);
  const companyCommission = ride.company_commission ?? fareBreakdown.companyCommission;
  const riderEarning = ride.rider_earning ?? fareBreakdown.riderEarning;
  const primaryDirections = ride.status === "assigned"
    ? directionsUrl(location, { lat: ride.pickup_lat, lng: ride.pickup_lng })
    : directionsUrl(location, { lat: ride.drop_lat, lng: ride.drop_lng });

  return (
    <div className="grid gap-3">
      <div className="min-w-0">
        <Badge className="bg-primary text-primary-foreground">Active job</Badge>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{riderHeadline(ride.status)}</h1>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {ride.pickup_address} to {ride.drop_address}
        </p>
      </div>
      <RideProgress ride={ride} />
      <div className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black">{currentTask}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{taskHelp}</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] font-black capitalize text-secondary-foreground">
            {destination}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
          <div className="min-w-0 rounded-2xl bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">ETA</p>
            <p className="mt-1 text-lg font-black">{liveEta ? `${liveEta}m` : "--"}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Route</p>
            <p className="mt-1 text-lg font-black">{liveDistance ? `${liveDistance}km` : "--"}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">GPS</p>
            <p className="mt-1 truncate text-xs font-black">
              {riderLocation?.last_seen_at ? formatTrackingAge(riderLocation.last_seen_at) : "manual"}
            </p>
          </div>
        </div>
        <Button asChild className="mt-3 h-12 w-full rounded-full bg-[#101713] text-white hover:bg-[#101713]/90">
          <a href={primaryDirections} rel="noreferrer" target="_blank">
            {ride.status === "assigned" ? "Navigate to pickup" : "Navigate to drop"}
          </a>
        </Button>
      </div>
      {ride.status === "assigned" ? (
        <div className="rounded-2xl border border-border bg-muted p-3">
          <Label htmlFor={`active-code-${ride.id}`}>Ask user for 4-digit code</Label>
          <div className="mt-2 grid gap-2 sm:flex">
            <Input
              className="h-12 rounded-full bg-card text-center font-mono text-lg tracking-[0.4em]"
              id={`active-code-${ride.id}`}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="0000"
              value={code}
            />
            <Button className="h-12 rounded-full sm:shrink-0" onClick={onStart}>
              Start
            </Button>
          </div>
          <Button className="mt-3 h-11 w-full rounded-full" onClick={onCancel} variant="destructive">
            Cancel accepted ride
          </Button>
        </div>
      ) : null}
      <RideChatPanel currentUserId={currentUserId} ride={ride} />
      {ride.status === "started" ? (
        <div className="rounded-[1.5rem] bg-[#101713] p-4 text-white">
          <p className="text-sm font-semibold text-white/60">Payment collection</p>
          <p className="mt-1 text-xl font-black">Collect fare before completing</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Total fare {formatMoney(ride.fare_estimate)}. Company gets {formatMoney(companyCommission)} (7%); you earn {formatMoney(riderEarning)}.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[#101713]">
            <div className="rounded-2xl bg-white/90 p-2"><p className="text-[10px] font-bold uppercase">Fare</p><p className="font-black">{formatMoney(ride.fare_estimate)}</p></div>
            <div className="rounded-2xl bg-white/90 p-2"><p className="text-[10px] font-bold uppercase">Taxiro</p><p className="font-black">{formatMoney(companyCommission)}</p></div>
            <div className="rounded-2xl bg-secondary p-2"><p className="text-[10px] font-bold uppercase">You</p><p className="font-black">{formatMoney(riderEarning)}</p></div>
          </div>
          {ride.payment_status === "awaiting_payment" ? (
            <Button className="mt-4 h-14 w-full rounded-full bg-secondary text-base font-black text-[#101713] hover:bg-secondary/90" onClick={onPaymentReceived}>
              Payment received - complete ride
            </Button>
          ) : (
            <Button className="mt-4 h-14 w-full rounded-full bg-secondary text-base font-black text-[#101713] hover:bg-secondary/90" onClick={onReachedDrop}>
              Reached drop - collect payment
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}







function upsertById<T extends { id: string }>(items: T[], incoming: T) {
  const exists = items.some((item) => item.id === incoming.id);
  if (!exists) return [incoming, ...items];
  return items.map((item) => (item.id === incoming.id ? incoming : item));
}

function upsertRiderLocation(items: RiderLocation[], incoming: RiderLocation) {
  const exists = items.some((item) => item.rider_id === incoming.rider_id);
  if (!exists) return [incoming, ...items];
  return items.map((item) => (item.rider_id === incoming.rider_id ? incoming : item));
}

function sortRides(items: RideRequest[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function formatTrackingAge(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}



























