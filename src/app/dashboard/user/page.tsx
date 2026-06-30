"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  ChevronDown,
  Clock3,
  HelpCircle,
  Info,
  ListChecks,
  LocateFixed,
  LogOut,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AppNotifications } from "@/components/AppNotifications";
import { CancelRideDialog } from "@/components/CancelRideDialog";
import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { RideChatPanel } from "@/components/RideChatPanel";
import { LocationSearch } from "@/components/LocationSearch";
import { ProfileSettings } from "@/components/ProfileSettings";
import { RideCard } from "@/components/RideCard";
import { RideProgress } from "@/components/RideProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProfile, getCurrentUser, getProfile } from "@/lib/auth";
import { getRoutePath, getRouteSummary, reverseGeocode } from "@/lib/maps";
import { calculateFareBreakdown, estimateBikeFare, formatMoney, getUserCancellationFine } from "@/lib/fare";
import { createSafetyAlert, usePanicTrigger, useRideSafetyMonitor } from "@/lib/safety";
import { getSupabase } from "@/lib/supabase";
import { getPromptedCurrentLocation, MAX_USABLE_LOCATION_ACCURACY_M } from "@/lib/tracking";
import { useLiveResync } from "@/lib/useLiveResync";
import type {
  LatLng,
  Profile,
  RideConfirmationCode,
  RideRequest,
  RiderLocation,
  RiderProfile,
  SafetyAlertType,
} from "@/types/database";

export default function UserDashboard() {
  const router = useRouter();
  const [bookingMode, setBookingMode] = useState<"now" | "advance">("now");
  const [cancelTarget, setCancelTarget] = useState<RideRequest | null>(null);
  const [clickTarget, setClickTarget] = useState<"pickup" | "drop">("pickup");
  const [confirmationCodes, setConfirmationCodes] = useState<Record<string, string>>({});
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [detectingPickup, setDetectingPickup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapPickMode, setMapPickMode] = useState<"pickup" | "drop" | null>(null);
  const [mapCandidate, setMapCandidate] = useState<LatLng | null>(null);
  const [mapSelectionStart, setMapSelectionStart] = useState<LatLng | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [panelView, setPanelView] = useState<"book" | "rides">("book");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [pickupAccuracy, setPickupAccuracy] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<Record<string, RiderProfile>>({});
  const [readySignalMinutes, setReadySignalMinutes] = useState<15 | 30 | 60>(30);
  const [rideNote, setRideNote] = useState("");
  const [sosBusy, setSosBusy] = useState(false);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number | null; durationMin: number | null } | null>(null);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showRideOptions, setShowRideOptions] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(() =>
    new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16),
  );

  const loadRides = useCallback(async (currentUserId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    await supabase.rpc("expire_ready_signals");

    const { data, error } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const userRides = (data as RideRequest[]) ?? [];
    setRides(userRides);
    const rideIds = userRides.map((ride) => ride.id);

    if (!rideIds.length) {
      setConfirmationCodes({});
      setRiderLocations([]);
      setRiderProfiles({});
      return;
    }

    const assignedRiderIds = Array.from(new Set(userRides.map((ride) => ride.assigned_rider_id).filter(Boolean) as string[]));
    const [riderResult, riderProfileResult] = await Promise.all([
      supabase.from("rider_locations").select("*"),
      assignedRiderIds.length
        ? supabase.from("rider_profiles").select("*").in("rider_id", assignedRiderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const activeCodeRides = userRides.filter((ride) => ["assigned", "started"].includes(ride.status));
    const nextCodes: Record<string, string> = {};

    if (activeCodeRides.length) {
      const codeResults = await Promise.all(
        activeCodeRides.map(async (ride) => {
          const { data: code, error: codeError } = await supabase.rpc("get_or_create_ride_confirmation_code", {
            p_ride_id: ride.id,
          });
          return {
            code: typeof code === "string" ? code : null,
            error: codeError?.message ?? null,
            rideId: ride.id,
          };
        }),
      );

      codeResults.forEach((item) => {
        if (item.code) nextCodes[item.rideId] = item.code;
      });

      const firstCodeError = codeResults.find((item) => item.error)?.error;
      if (firstCodeError) {
        setMessage(firstCodeError);
      }
    }

    setConfirmationCodes(nextCodes);
    if (riderResult.data) {
      setRiderLocations(riderResult.data as RiderLocation[]);
    }
    if (riderProfileResult.error) {
      setMessage(riderProfileResult.error.message);
    } else if (riderProfileResult.data) {
      const nextProfiles = ((riderProfileResult.data as RiderProfile[]) ?? []).reduce<Record<string, RiderProfile>>((profiles, item) => {
        profiles[item.rider_id] = item;
        return profiles;
      }, {});
      setRiderProfiles(nextProfiles);
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

    let activeUserId: string | null = null;
    void getCurrentUser(supabase).then(async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      activeUserId = user.id;
      setUserId(user.id);
      await ensureProfile(supabase, user, "user");
      setProfile(await getProfile(supabase, user.id));
      await loadRides(user.id);
      setLoading(false);
    });

    const channel = supabase
      .channel("user-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        (payload) => {
          if (!activeUserId) return;

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideRequest>;
            if (deleted.id) {
              setRides((current) => current.filter((ride) => ride.id !== deleted.id));
            }
            return;
          }

          const incoming = payload.new as RideRequest;
          if (incoming.user_id !== activeUserId) return;

          setRides((current) => sortRides(upsertById(current, incoming)));
          void loadRides(activeUserId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_confirmation_codes" },
        (payload) => {
          if (!activeUserId) return;

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideConfirmationCode>;
            if (deleted.ride_id) {
              setConfirmationCodes((current) => {
                const next = { ...current };
                delete next[deleted.ride_id as string];
                return next;
              });
            }
            return;
          }

          const incoming = payload.new as RideConfirmationCode;
          if (incoming.user_id !== activeUserId) return;
          setConfirmationCodes((current) => ({
            ...current,
            [incoming.ride_id]: incoming.code,
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_profiles" },
        (payload) => {
          if (!activeUserId) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderProfile>;
            if (deleted.rider_id) {
              setRiderProfiles((current) => {
                const next = { ...current };
                delete next[deleted.rider_id as string];
                return next;
              });
            }
            return;
          }
          const incoming = payload.new as RiderProfile;
          setRiderProfiles((current) => ({ ...current, [incoming.rider_id]: incoming }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_locations" },
        (payload) => {
          if (!activeUserId) return;

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderLocation>;
            if (deleted.rider_id) {
              setRiderLocations((current) => current.filter((rider) => rider.rider_id !== deleted.rider_id));
            }
            return;
          }

          setRiderLocations((current) => upsertRiderLocation(current, payload.new as RiderLocation));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage("Live updates are reconnecting. Keep this page open for instant ride updates.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRides]);

  function startMapPick(target: "pickup" | "drop") {
    const start = target === "pickup"
      ? pickup ?? { lat: 17.385, lng: 78.4867 }
      : drop ?? pickup ?? { lat: 17.385, lng: 78.4867 };
    setClickTarget(target);
    setMapCandidate(start);
    setMapSelectionStart(start);
    setMapPickMode(target);
    setMessage(`Move the map until the pin is exactly over your ${target}, then confirm.`);
  }

  async function confirmMapPick() {
    if (!mapCandidate || !mapPickMode) return;
    setMessage("Confirming the selected address...");
    const address = await reverseGeocode(mapCandidate);
    const selected = {
      ...mapCandidate,
      address: address ?? `Pinned location ${mapCandidate.lat.toFixed(5)}, ${mapCandidate.lng.toFixed(5)}`,
    };
    if (mapPickMode === "pickup") {
      setPickup(selected);
      setPickupAccuracy(null);
    } else setDrop(selected);
    setMapPickMode(null);
    setMapCandidate(null);
    setMapSelectionStart(null);
    setMessage(`${clickTarget === "pickup" ? "Pickup" : "Drop"} pinned on the map.`);
  }
  async function detectPickupLocation() {
    if (!navigator.geolocation) {
      setMessage("Location detection is not supported in this browser.");
      return;
    }

    setDetectingPickup(true);
    setPickupAccuracy(null);
    setMessage("Finding your precise GPS location...");
    try {
      const position = await getPromptedCurrentLocation((accuracy) => {
        setPickupAccuracy(accuracy);
        setMessage(`Improving GPS accuracy... currently +/-${accuracy}m`);
      });
      const detected = {
        address: `Detected location (${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)})`,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setPickupAccuracy(Math.round(position.coords.accuracy));
      setPickup(detected);
      setClickTarget("drop");
      setMapPickMode(null);
      const address = await reverseGeocode(detected);
      setPickup({ ...detected, address: address ?? detected.address });
      setMessage(
        position.coords.accuracy > 100
          ? `Pickup detected with +/-${Math.round(position.coords.accuracy)}m accuracy. Please fine-tune the pin on the map.`
          : `Pickup detected within about ${Math.round(position.coords.accuracy)}m.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Location permission denied. Search or choose on map.");
    } finally {
      setDetectingPickup(false);
    }
  }

  async function createRide() {
    if (!userId) {
      setMessage("Please sign in before creating a ride.");
      return;
    }
    if (!pickup || !drop) {
      setMessage("Choose pickup and drop first.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (bookingMode === "advance" && new Date(scheduledTime).getTime() <= Date.now()) {
      setMessage("Choose a future date and time for an advance booking.");
      return;
    }

    const rideTime =
      bookingMode === "now"
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        : new Date(scheduledTime).toISOString();

    setMessage("Finding route...");
    const summary = await getRouteSummary(pickup, drop);
    const fareEstimate = estimateBikeFare(summary.distanceKm, summary.durationMin);
    const fareBreakdown = calculateFareBreakdown(fareEstimate);
    const { error } = await supabase.from("ride_requests").insert({
      assigned_rider_id: null,
      distance_km: summary.distanceKm,
      drop_address: drop.address ?? "Selected destination",
      drop_lat: drop.lat,
      drop_lng: drop.lng,
      estimated_duration_min: summary.durationMin,
      fare_estimate: fareEstimate,
      company_commission: fareBreakdown.companyCommission,
      rider_earning: fareBreakdown.riderEarning,
      payment_status: "pending",
      passenger_count: 1,
      payment_method: paymentMethod,
      pickup_address: pickup.address ?? "Selected pickup",
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      rider_note: rideNote.trim() || null,
      scheduled_time: rideTime,
      status: "scheduled",
      user_id: userId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      bookingMode === "now"
        ? "Ride created for now. Tap I'm Ready when you are at pickup."
        : "Advance ride scheduled. Tap I'm Ready when you want riders to see it.",
    );
    await loadRides(userId);
  }

  async function markReady(ride: RideRequest) {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.rpc("mark_ride_ready_and_assign", {
      p_ride_id: ride.id,
      p_signal_minutes: readySignalMinutes,
    });
    setMessage(error ? error.message : "Searching nearby riders now.");
    if (userId) {
      await loadRides(userId);
    }
  }

  async function cancelRide(ride: RideRequest, reason: string) {
    if (!userId) {
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
    setMessage(error ? error.message : "Ride cancelled.");
    if (!error) {
      setCancelTarget(null);
    }
    await loadRides(userId);
  }
  const resyncUserData = useCallback(async () => {
    if (userId) {
      await loadRides(userId);
    }
  }, [loadRides, userId]);

  useLiveResync({
    enabled: Boolean(userId),
    intervalMs: 5000,
    onResync: resyncUserData,
  });
  async function signOut() {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/auth");
  }

  const activeRide =
    rides.find((ride) => ["assigned", "started", "ready"].includes(ride.status)) ??
    rides.find((ride) => ride.status === "scheduled");
  const mapPickup = useMemo(
    () =>
      activeRide
        ? {
            address: activeRide.pickup_address,
            lat: activeRide.pickup_lat,
            lng: activeRide.pickup_lng,
          }
        : pickup,
    [activeRide, pickup],
  );
  const mapDrop = useMemo(
    () =>
      activeRide
        ? {
            address: activeRide.drop_address,
            lat: activeRide.drop_lat,
            lng: activeRide.drop_lng,
          }
        : drop,
    [activeRide, drop],
  );
  const assignedRiderLocation = activeRide
    ? riderLocations.find((rider) => rider.rider_id === activeRide.assigned_rider_id)
    : null;
  const mapRiders = useMemo(
    () => (assignedRiderLocation ? [assignedRiderLocation] : []),
    [assignedRiderLocation],
  );
  const assignedRiderProfile = activeRide?.assigned_rider_id ? riderProfiles[activeRide.assigned_rider_id] ?? null : null;
  const routeFrom = useMemo(() => {
    if (activeRide?.assigned_rider_id && assignedRiderLocation && ["assigned", "started"].includes(activeRide.status)) {
      return { lat: assignedRiderLocation.lat, lng: assignedRiderLocation.lng };
    }
    return mapPickup;
  }, [activeRide, assignedRiderLocation, mapPickup]);
  const routeTo = useMemo(() => {
    if (activeRide?.status === "assigned") {
      return mapPickup;
    }
    return mapDrop;
  }, [activeRide, mapDrop, mapPickup]);
  const activeRides = rides.filter((ride) =>
    ["ready", "assigned", "started"].includes(ride.status),
  );
  const upcomingRides = rides.filter((ride) => ride.status === "scheduled");
  const completedRides = rides.filter((ride) =>
    ["completed", "cancelled"].includes(ride.status),
  );
  const userCancelledRideCount = rides.filter((ride) => ride.status === "cancelled" && (!ride.cancelled_by || ride.cancelled_by === userId)).length;
  const safetyLocation = useMemo(
    () =>
      assignedRiderLocation
        ? {
            accuracy_m: assignedRiderLocation.accuracy_m,
            lat: assignedRiderLocation.lat,
            lng: assignedRiderLocation.lng,
          }
        : mapPickup,
    [assignedRiderLocation, mapPickup],
  );

  useEffect(() => {
    let ignore = false;

    async function loadRoutePath() {
      if (!routeFrom || !routeTo) {
        setRoutePath([]);
        return;
      }

      const [path, summary] = await Promise.all([
        getRoutePath(routeFrom, routeTo),
        getRouteSummary(routeFrom, routeTo),
      ]);
      if (!ignore) {
        setRoutePath(path);
        setRouteSummary(summary);
      }
    }

    void loadRoutePath();

    return () => {
      ignore = true;
    };
  }, [routeFrom, routeTo]);

  const triggerSafetyAlert = useCallback(async (alertType: SafetyAlertType, alertMessage: string) => {
    if (!activeRide || !["assigned", "started"].includes(activeRide.status)) {
      setMessage("Safety alerts are available after a rider is assigned.");
      return;
    }

    setSosBusy(alertType === "sos");
    const { error } = await createSafetyAlert({
      alertType,
      location: safetyLocation,
      message: alertMessage,
      rideId: activeRide.id,
    });
    setSosBusy(false);
    setMessage(error ?? "Safety alert saved. Emergency contact notified in Taxiro if they have an account.");
  }, [activeRide, safetyLocation]);

  usePanicTrigger({
    enabled: Boolean(activeRide && ["assigned", "started"].includes(activeRide.status)),
    onPanic: () => void triggerSafetyAlert("sos", "SOS triggered by triple volume-up while Taxiro was open."),
  });

  useRideSafetyMonitor({
    enabled: Boolean(activeRide && activeRide.status === "started"),
    location: safetyLocation,
    onStatus: setMessage,
    ride: activeRide ?? null,
    routeSummary,
  });

  if (loading) {
    return <LoadingRideShell label="Taxiro" title="Preparing your ride app" />;
  }
  if (!loading && (!userId || profile?.role !== "user")) {
    return (
      <AppShell title="Book Taxiro">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle>{profile ? "User account required" : "Sign in required"}</CardTitle>
            <CardDescription>
              {profile
                ? "This area is only for customers. Rider accounts use the driver app."
                : "Create an account or sign in to book real Taxiro rides."}
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
    <AppShell immersive title="Book Taxiro">
      <div className="taxiro-immersive-stage relative min-w-0 w-full max-w-full overflow-x-clip bg-muted [contain:inline-size]">
        <DynamicMapPicker
          className="taxiro-map-canvas overflow-hidden"
          drop={mapDrop}
          focusPoint={!activeRide ? pickup : null}
          onSelectionChange={setMapCandidate}
          pickup={mapPickup}
          riders={mapRiders}
          route={routePath}
          selectionCenter={mapSelectionStart}
          selectionMode={mapPickMode}
        />

        {!mapPickMode ? (
        <div className="taxiro-overlay-bar pointer-events-none absolute inset-x-2 top-0 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 sm:gap-3 lg:inset-x-4">
          <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-xl border border-white/80 bg-white/94 p-2.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:max-w-sm sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Taxiro</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-tight sm:gap-2 sm:text-lg">
              <Bike className="size-4 sm:size-5" />
              {activeRide ? rideHeadline(activeRide.status) : "Where to?"}
            </p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              aria-label="Detect pickup location"
              aria-busy={detectingPickup}
              className="flex size-11 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur disabled:cursor-wait disabled:opacity-70"
              disabled={detectingPickup}
              onClick={detectPickupLocation}
              type="button"
            >
              <LocateFixed className={`size-4 text-primary sm:size-5 ${detectingPickup ? "animate-pulse" : ""}`} />
            </button>
            <button
              aria-label="Open menu"
              className="flex size-11 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="size-4 text-primary sm:size-5" />
            </button>
          </div>
        </div>
        ) : null}

        {!mapPickMode ? (
        <section className="taxiro-sheet-shell min-w-0 max-w-full overflow-x-clip">
          <div className="taxiro-sheet-surface min-w-0 max-w-full">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border lg:hidden" />
            {activeRide ? (
              <ActiveUserRide
                code={confirmationCodes[activeRide.id]}
                onCancel={() => setCancelTarget(activeRide)}
                onReady={() => void markReady(activeRide)}
                onReadySignalMinutesChange={setReadySignalMinutes}
                onSos={() => void triggerSafetyAlert("sos", "SOS button pressed by the user during a Taxiro ride.")}
                readySignalMinutes={readySignalMinutes}
                riderLocation={assignedRiderLocation}
                riderProfile={assignedRiderProfile}
                routeSummary={routeSummary}
                ride={activeRide}
                sosBusy={sosBusy}
                userId={userId}
              />
            ) : (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["book", "rides"] as const).map((view) => (
                    <button
                      className={`rounded-md px-3 py-2.5 text-sm font-black transition ${
                        panelView === view
                          ? "bg-[#101713] text-white shadow-sm"
                          : "text-muted-foreground"
                      }`}
                      key={view}
                      onClick={() => setPanelView(view)}
                      type="button"
                    >
                      <span className="block truncate">{view === "book" ? "Book" : `My rides (${rides.length})`}</span>
                    </button>
                  ))}
                </div>
                {panelView === "book" ? (
                  <>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Where are you going?</h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">Bike taxi - quick pickup</p>
                </div>
                <div className="hidden min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:grid">
                  <ModeMetric icon={Bike} label="Bike" />
                  <ModeMetric icon={Clock3} label="Fast" />
                  <ModeMetric icon={Radio} label="Ready" />
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["now", "advance"] as const).map((mode) => (
                    <button
                      className={`rounded-md px-3 py-2.5 text-sm font-black transition ${
                        bookingMode === mode
                          ? "bg-[#101713] text-white shadow-sm"
                          : "text-muted-foreground"
                      }`}
                      key={mode}
                      onClick={() => setBookingMode(mode)}
                      type="button"
                    >
                      <span className="block truncate">{mode === "now" ? "Ride now" : "Advance booking"}</span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
                  <div className="min-w-0 rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                        From
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          className="h-8 min-w-0 rounded-lg px-3 text-xs"
                          disabled={detectingPickup}
                          onClick={detectPickupLocation}
                          size="sm"
                          variant="outline"
                        >
                          {detectingPickup ? "Detecting..." : "Detect"}
                        </Button>
                        <Button
                          className="h-8 min-w-0 rounded-lg px-3 text-xs"
                          onClick={() => startMapPick("pickup")}
                          size="sm"
                          variant={mapPickMode === "pickup" ? "default" : "secondary"}
                        >
                          <span className="sm:hidden">Map</span>
                          <span className="hidden sm:inline">Choose on map</span>
                        </Button>
                      </div>
                    </div>
                    {pickupAccuracy ? (
                      <p
                        className={`mb-2 text-xs font-semibold ${!detectingPickup && pickupAccuracy > MAX_USABLE_LOCATION_ACCURACY_M ? "text-amber-700" : "text-muted-foreground"}`}
                      >
                        {detectingPickup
                          ? `Improving GPS accuracy... +/-${pickupAccuracy}m`
                          : `${pickupAccuracy > MAX_USABLE_LOCATION_ACCURACY_M ? "GPS fix rejected" : "GPS accuracy"} +/-${pickupAccuracy}m`}
                      </p>
                    ) : null}
                    <LocationSearch
                      hideLabel
                      key={`pickup-${pickup?.address ?? "empty"}`}
                      label="Pickup"
                      onSelect={(selected) => {
                        setPickup(selected);
                        setPickupAccuracy(null);
                      }}
                      selectedValue={pickup?.address}
                    />
                  </div>

                  <div className="min-w-0 rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                        To
                      </p>
                      <Button
                        className="h-8 min-w-0 rounded-lg px-3 text-xs"
                        onClick={() => startMapPick("drop")}
                        size="sm"
                        variant={mapPickMode === "drop" ? "default" : "secondary"}
                      >
                        <span className="sm:hidden">Map</span>
                        <span className="hidden sm:inline">Choose on map</span>
                      </Button>
                    </div>
                    <LocationSearch
                      hideLabel
                      key={`drop-${drop?.address ?? "empty"}`}
                      label="Drop"
                      onSelect={setDrop}
                      selectedValue={drop?.address}
                    />
                  </div>
                </div>
                {mapPickMode ? (
                  <div className="rounded-lg border border-[#101713]/20 bg-secondary p-3 text-sm font-semibold text-secondary-foreground">
                    Tap the map to set {mapPickMode === "pickup" ? "From / pickup" : "To / drop"}.
                  </div>
                ) : null}
                {bookingMode === "advance" ? (
                  <div className="grid gap-3 rounded-lg bg-muted p-3">
                    <div>
                      <Label htmlFor="scheduled">Advance pickup date and time</Label>
                      <Input
                        className="mt-1 h-12 bg-card"
                        id="scheduled"
                        min={new Date().toISOString().slice(0, 16)}
                        onChange={(event) => setScheduledTime(event.target.value)}
                        type="datetime-local"
                        value={scheduledTime}
                      />
                    </div>
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                      <TimePreset
                        label="+30 min"
                        onClick={() => setScheduledTime(offsetDateTime(30))}
                      />
                      <TimePreset
                        label="+1 hour"
                        onClick={() => setScheduledTime(offsetDateTime(60))}
                      />
                      <TimePreset
                        label="Tomorrow"
                        onClick={() => setScheduledTime(tomorrowMorning())}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                    Book now, then tap I&apos;m Ready when you are at the pickup point.
                  </p>
                )}
                <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
                    <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                      <p className="text-xs text-muted-foreground">Fare</p>
                      <p className="mt-1 font-black">{formatMoney(estimateBikeFare(routeSummary?.distanceKm ?? null, routeSummary?.durationMin ?? null))}</p>
                    </div>
                    <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="mt-1 font-black">{routeSummary?.distanceKm ?? "--"} km</p>
                    </div>
                    <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                      <p className="text-xs text-muted-foreground">ETA</p>
                      <p className="mt-1 font-black">{routeSummary?.durationMin ?? "--"} min</p>
                    </div>
                  </div>
                  <div>
                    <Label>Payment preference</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["cash", "upi"] as const).map((method) => (
                        <button
                          className={paymentMethod === method ? "rounded-lg bg-primary px-3 py-3 text-sm font-black text-primary-foreground" : "rounded-lg bg-muted px-3 py-3 text-sm font-black"}
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          type="button"
                        >
                          {method === "cash" ? "Cash" : "UPI after ride"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-left text-sm font-bold"
                    onClick={() => setShowRideOptions((current) => !current)}
                    type="button"
                  >
                    <span>{rideNote ? "Pickup note added" : "Add pickup note"}</span>
                    <ChevronDown className={`size-4 transition ${showRideOptions ? "rotate-180" : ""}`} />
                  </button>
                  {showRideOptions ? (
                    <div className="animate-in">
                      <Label htmlFor="rider-note">Note for rider</Label>
                      <Input
                        className="mt-1"
                        id="rider-note"
                        maxLength={180}
                        onChange={(event) => setRideNote(event.target.value)}
                        placeholder="Gate, landmark, or pickup instruction"
                        value={rideNote}
                      />
                    </div>
                  ) : null}
                </div>
                <Button className="sticky bottom-2 z-10 h-14 rounded-lg text-base font-bold shadow-[0_12px_32px_rgb(16_23_19_/_0.24)]" onClick={() => void createRide()}>
                  {bookingMode === "now" ? "Book ride now" : "Schedule advance ride"}
                </Button>
                  </>
                ) : (
                  <RideHistoryPanel
                    activeRides={activeRides}
                    onCancel={setCancelTarget}
                    completedRides={completedRides}
                    onReady={(ride) => void markReady(ride)}
                    upcomingRides={upcomingRides}
                  />
                )}
              </div>
            )}
            {message ? <p className="mt-3 text-center text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </section>
        ) : null}
        {activeRide ? (
          <div className="absolute left-2 right-2 top-20 z-[1200] mx-auto hidden max-w-xl grid-cols-3 gap-1.5 sm:left-3 sm:right-3 sm:top-24 sm:grid sm:gap-2">
            <FloatingStat label="Status" value={activeRide.status} />
            <FloatingStat label="ETA" value={`${activeRide.estimated_duration_min ?? "--"}m`} />
            <FloatingStat label="KM" value={`${activeRide.distance_km ?? "--"}`} />
          </div>
        ) : null}
        {mapPickMode ? (
          <div
            className="absolute inset-x-2 top-3 z-[1300] rounded-lg bg-[#101713] px-4 py-3 text-center text-sm font-black text-white shadow-[var(--shadow-soft)] sm:left-1/2 sm:right-auto sm:w-[24rem] sm:max-w-[calc(100%-0.75rem)] sm:-translate-x-1/2"
          >
            Move the map under the pin to set {mapPickMode === "pickup" ? "your pickup" : "your drop"}.
          </div>
        ) : null}
        {mapPickMode ? (
          <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[1300] mx-auto max-w-sm rounded-lg border border-white/70 bg-white/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <p className="text-sm font-black">Is the pin exactly where you need it?</p>
            <p className="mt-1 text-xs text-muted-foreground">Zoom and move the map for a precise entrance or pickup point.</p>
            <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-2">
              <Button onClick={() => {
                setMapPickMode(null);
                setMapCandidate(null);
                setMapSelectionStart(null);
              }} variant="outline">
                Cancel
              </Button>
              <Button disabled={!mapCandidate} onClick={() => void confirmMapPick()}>
                Confirm {mapPickMode === "pickup" ? "pickup" : "drop"}
              </Button>
            </div>
          </div>
        ) : null}
        {cancelTarget ? (
          <CancelRideDialog
            onClose={() => setCancelTarget(null)}
            onConfirm={(reason) => void cancelRide(cancelTarget, reason)}
            penaltyAmount={getUserCancellationFine(userCancelledRideCount, Boolean(cancelTarget.assigned_rider_id))}
            ride={cancelTarget}
          />
        ) : null}
        {menuOpen ? (
          <UserMenu
            completedCount={completedRides.length}
            onClose={() => setMenuOpen(false)}
            onOpenRides={() => {
              setPanelView("rides");
              setMenuOpen(false);
            }}
            onProfileSaved={setProfile}
            onSignOut={() => void signOut()}
            profile={profile}
            ridesCount={rides.length}
            upcomingCount={upcomingRides.length}
          />
        ) : null}
      </div>

    </AppShell>
  );
}

function LoadingRideShell({ label, title }: { label: string; title: string }) {
  return (
    <AppShell immersive title={title}>
      <div className="taxiro-immersive-stage relative min-w-0 w-full max-w-full overflow-x-clip bg-muted [contain:inline-size]">
        <DynamicMapPicker className="taxiro-map-canvas overflow-hidden" />
        <div className="taxiro-overlay-bar pointer-events-none absolute inset-x-2 top-0 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 lg:inset-x-4">
          <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-xl border border-white/80 bg-white/94 p-2.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:max-w-sm sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-tight sm:gap-2 sm:text-lg">
              <Bike className="size-4 sm:size-5" />
              {title}
            </p>
          </div>
        </div>
        <section className="taxiro-sheet-shell min-w-0 max-w-full overflow-x-clip">
          <div className="taxiro-sheet-surface min-w-0 max-w-full">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border lg:hidden" />
            <div className="grid gap-3" aria-busy="true" aria-live="polite">
              <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded-lg bg-muted" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-28 animate-pulse rounded-lg bg-muted" />
              <div className="h-14 animate-pulse rounded-lg bg-primary/15" />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
function ModeMetric({ icon: Icon, label }: { icon: typeof Bike; label: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted p-2 text-center sm:p-3">
      <Icon className="mx-auto mb-1.5 size-4 text-primary sm:mb-2" />
      <p className="truncate text-xs font-black">{label}</p>
    </div>
  );
}

function offsetDateTime(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString().slice(0, 16);
}

function tomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function TimePreset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="rounded-lg bg-card px-3 py-2 text-xs font-bold shadow-sm"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function RideHistoryPanel({
  activeRides,
  completedRides,
  onCancel,
  onReady,
  upcomingRides,
}: {
  activeRides: RideRequest[];
  completedRides: RideRequest[];
  onCancel: (ride: RideRequest) => void;
  onReady: (ride: RideRequest) => void;
  upcomingRides: RideRequest[];
}) {
  return (
    <div className="grid max-h-[56dvh] gap-4 overflow-y-auto overflow-x-hidden pr-1">
      <div>
        <h1 className="text-2xl font-black tracking-tight">My rides</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Active, advance, and completed trips in one place.
        </p>
      </div>
      <RideSection
        actionForRide={(ride) =>
          ["scheduled", "ready", "assigned"].includes(ride.status) ? (
            <Button onClick={() => onCancel(ride)} size="sm" variant="destructive">
              Cancel
            </Button>
          ) : null
        }
        emptyText="No active rides right now."
        rides={activeRides}
        title="Active rides"
      />
      <RideSection
        actionForRide={(ride) =>
          ride.status === "scheduled" ? (
            <Button onClick={() => onReady(ride)} size="sm">
              I&apos;m Ready
            </Button>
          ) : null
        }
        secondaryActionForRide={(ride) =>
          ride.status === "scheduled" ? (
            <Button onClick={() => onCancel(ride)} size="sm" variant="destructive">
              Cancel
            </Button>
          ) : null
        }
        emptyText="No advance bookings yet."
        rides={upcomingRides}
        title="Upcoming"
      />
      <RideSection
        emptyText="Completed and cancelled rides will appear here."
        rides={completedRides}
        title="Completed"
      />
    </div>
  );
}

function RideSection({
  actionForRide,
  emptyText,
  rides,
  secondaryActionForRide,
  title,
}: {
  actionForRide?: (ride: RideRequest) => ReactNode;
  emptyText: string;
  rides: RideRequest[];
  secondaryActionForRide?: (ride: RideRequest) => ReactNode;
  title: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <span className="rounded-md bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
          {rides.length}
        </span>
      </div>
      {rides.length ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {rides.map((ride) => (
            <RideCard
              action={
                <div className="flex flex-wrap gap-2">
                  {actionForRide?.(ride)}
                  {secondaryActionForRide?.(ride)}
                </div>
              }
              key={ride.id}
              ride={ride}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function FloatingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-center shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black capitalize">{value}</p>
    </div>
  );
}

function rideHeadline(status: RideRequest["status"]) {
  if (status === "started") {
    return "Trip in progress";
  }
  if (status === "assigned") {
    return "Rider is arriving";
  }
  if (status === "ready") {
    return "Finding rider";
  }
  return "Ride scheduled";
}

function isReadySignalExpired(ride: RideRequest) {
  return ride.status === "ready" && Boolean(ride.ready_expires_at) && new Date(ride.ready_expires_at as string).getTime() <= Date.now();
}

function formatReadySignalTimeLeft(value: string | null) {
  if (!value) return "no expiry set";
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) return "expired";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes <= 1) return "under 1 min left";
  return `${minutes} min left`;
}

function ActiveUserRide({
  code,
  onCancel,
  onReady,
  onReadySignalMinutesChange,
  onSos,
  readySignalMinutes,
  riderLocation,
  riderProfile,
  routeSummary,
  ride,
  sosBusy,
  userId,
}: {
  code?: string;
  onCancel: () => void;
  onReady: () => void;
  onReadySignalMinutesChange: (minutes: 15 | 30 | 60) => void;
  onSos: () => void;
  readySignalMinutes: 15 | 30 | 60;
  riderLocation?: RiderLocation | null;
  riderProfile?: RiderProfile | null;
  routeSummary: { distanceKm: number | null; durationMin: number | null } | null;
  ride: RideRequest;
  sosBusy: boolean;
  userId: string | null;
}) {
  const hasLivePhase = ["assigned", "started"].includes(ride.status);
  const trackingTitle = ride.status === "assigned" ? "Rider is coming to pickup" : "Tracking trip to destination";
  const trackingText = ride.status === "assigned"
    ? "After the rider reaches you, share the private code to start the trip."
    : "Code verified. The live route now follows the trip toward your drop location.";
  const liveEta = routeSummary?.durationMin ?? ride.estimated_duration_min;
  const liveDistance = routeSummary?.distanceKm ?? ride.distance_km;
  const readyExpired = isReadySignalExpired(ride);
  const canPublishReady = ride.status === "scheduled" || readyExpired;
  const readyLocked = ride.status === "ready" && !readyExpired;
  const readyTimeLeft = formatReadySignalTimeLeft(ride.ready_expires_at);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge className="bg-primary text-primary-foreground">{ride.status}</Badge>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{rideHeadline(ride.status)}</h1>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {ride.pickup_address} to {ride.drop_address}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {canPublishReady ? (
            <Button className="rounded-lg" onClick={onReady}>
              {readyExpired ? "Publish again" : "I'm Ready"}
            </Button>
          ) : null}
          {["scheduled", "ready", "assigned"].includes(ride.status) ? (
            <Button className="rounded-lg" onClick={onCancel} variant="destructive">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {ride.status === "started" ? (
        <div className="rounded-lg bg-[#101713] p-4 text-white">
          <p className="text-sm font-semibold text-white/60">Trip live</p>
          <p className="mt-1 text-xl font-black">You are on your way</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            The ride can be completed from the rider app after reaching the drop point.
          </p>
        </div>
      ) : null}
      {ride.status === "scheduled" || ride.status === "ready" ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">Ready signal duration</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Choose how long nearby riders can see this request after you publish it.
              </p>
            </div>
            <Badge className="shrink-0 bg-secondary text-secondary-foreground">
              {ride.status === "ready" ? (readyExpired ? "Expired" : readyTimeLeft) : `${readySignalMinutes} min`}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([15, 30, 60] as const).map((minutes) => (
              <button
                className={`rounded-lg px-3 py-2 text-sm font-black transition ${readySignalMinutes === minutes ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"} ${readyLocked ? "cursor-not-allowed opacity-70" : ""}`}
                disabled={readyLocked}
                key={minutes}
                onClick={() => onReadySignalMinutesChange(minutes)}
                type="button"
              >
                {minutes} min
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {ride.status === "ready"
              ? readyExpired
                ? "Signal expired. Publish again when you still need the ride."
                : `Visible to riders now, ${readyTimeLeft}.`
              : "Default is 30 minutes. Use 15 for urgent pickup, 60 when you can wait longer."}
          </p>
        </div>
      ) : null}
      <RideProgress ride={ride} />
      {hasLivePhase ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">{trackingTitle}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{trackingText}</p>
            </div>
            <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-black text-secondary-foreground">
              {ride.status === "assigned" ? "Pickup" : "Drop"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Live ETA</p>
              <p className="mt-1 text-lg font-black">{liveEta ? `${liveEta} min` : "--"}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Route</p>
              <p className="mt-1 text-lg font-black">{liveDistance ? `${liveDistance} km` : "--"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {riderLocation
              ? `Rider GPS ${formatTrackingAge(riderLocation.last_seen_at ?? riderLocation.updated_at)}${riderLocation.accuracy_m ? ` - accuracy +/-${Math.round(riderLocation.accuracy_m)}m` : ""}`
              : "Waiting for the rider app to send live GPS. Ask the rider to keep Taxiro open."}
          </p>
        </div>
      ) : null}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">Your fare</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              This is the customer fare saved when the ride was booked. Rider earning and Taxiro share are shown only in the rider/admin views.
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-black uppercase text-secondary-foreground">
            {ride.payment_status ?? "pending"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="min-w-0 rounded-lg bg-muted p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Fare</p>
            <p className="mt-1 font-black">{formatMoney(ride.fare_estimate)}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-muted p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pay by</p>
            <p className="mt-1 font-black uppercase">{ride.payment_method ?? "cash"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {ride.payment_status === "awaiting_payment"
            ? "Pay the rider at drop. The ride completes after the rider confirms payment received."
            : ride.payment_status === "paid"
              ? "Payment confirmed. Ride is completed."
              : "No payment is due until the trip reaches the drop point."}
        </p>
        {ride.payment_status === "awaiting_payment" ? (
          <div className="mt-3 rounded-lg bg-secondary p-3">
            <p className="text-sm font-black">Pay your rider</p>
            {ride.payment_method === "upi" ? (
              <div className="mt-2 grid gap-2">
                <p className="rounded-xl bg-card p-3 text-sm font-semibold">
                  Ask the rider to show their Taxiro UPI QR, then scan it with your payment app and pay {formatMoney(ride.fare_estimate)}.
                </p>
                {riderProfile?.upi_id ? (
                  <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground">UPI ID fallback: {riderProfile.upi_id}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-card p-3 text-sm font-semibold">Cash selected. Pay {formatMoney(ride.fare_estimate)} directly to the rider.</p>
            )}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            ETA
          </p>
          <p className="mt-1 font-semibold">{ride.estimated_duration_min ?? "--"} min</p>
        </div>
        <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3" />
            Distance
          </p>
          <p className="mt-1 font-semibold">{ride.distance_km ?? "--"} km</p>
        </div>
      </div>
      {ride.status === "assigned" ? (
        <div className="rounded-lg border border-primary/25 bg-secondary p-4">
          <p className="text-sm font-semibold">Show this code only to your rider</p>
          <div className="mt-2 grid gap-3 sm:flex sm:items-end sm:justify-between">
            <p className="text-xs text-muted-foreground">Required before the ride starts.</p>
            <span className="font-mono text-3xl font-semibold tracking-[0.28em] text-primary sm:tracking-[0.35em]">
              {code ?? "Loading..."}
            </span>
          </div>
        </div>
      ) : ride.status === "started" ? (
        <div className="rounded-lg border border-primary/20 bg-secondary p-4">
          <p className="text-sm font-black">Code verified</p>
          <p className="mt-1 text-xs text-muted-foreground">The rider entered the private code. Destination tracking is now active.</p>
        </div>
      ) : (
        <div className="rounded-lg bg-muted p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 text-primary" />
            Tap I&apos;m Ready when you are at pickup.
          </p>
        </div>
      )}
      {hasLivePhase ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-black">Safety alert</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Use SOS if you feel unsafe. Taxiro saves your current ride location and notifies your emergency contact in-app if that phone number has a Taxiro account.
              </p>
            </div>
          </div>
          <Button className="mt-3 h-12 w-full rounded-lg" disabled={sosBusy} onClick={onSos} variant="destructive">
            {sosBusy ? "Sending SOS..." : "SOS - notify emergency contact"}
          </Button>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            Triple volume-up is best-effort only in browsers. Keep the visible SOS button as the reliable safety action.
          </p>
        </div>
      ) : null}
      <RideChatPanel currentUserId={userId} ride={ride} />
    </div>
  );
}

function UserMenu({
  completedCount,
  onClose,
  onOpenRides,
  onProfileSaved,
  onSignOut,
  profile,
  ridesCount,
  upcomingCount,
}: {
  completedCount: number;
  onClose: () => void;
  onOpenRides: () => void;
  onProfileSaved: (profile: Profile) => void;
  onSignOut: () => void;
  profile: Profile | null;
  ridesCount: number;
  upcomingCount: number;
}) {
  return (
    <div className="fixed inset-0 z-[1500] bg-[#101713]/48 backdrop-blur-sm">
      <aside className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] grid gap-3 overflow-y-auto overflow-x-clip rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-soft)] sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[27rem] sm:max-w-[calc(100%-1.5rem)] sm:gap-4 sm:rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Taxiro menu
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              {profile?.full_name ?? "Your account"}
            </h2>
          </div>
          <button
            aria-label="Close menu"
            className="flex size-11 items-center justify-center rounded-lg bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <ProfileSettings onSaved={onProfileSaved} profile={profile} />

        <AppNotifications profileId={profile?.id ?? null} />

        <button className="text-left" onClick={onOpenRides} type="button">
          <MenuCard
            icon={ListChecks}
            title="My rides"
            text={`${ridesCount} total rides, ${upcomingCount} upcoming, ${completedCount} completed/cancelled. Tap to open ride history and cancellation options.`}
          />
        </button>
        <MenuCard
          icon={Settings}
          title="Settings"
          text="Manage account details, preferred pickup behavior, location permissions, and notification preferences."
        />
        <MenuLink
          href="/about"
          icon={Info}
          title="About Taxiro"
          text="Product vision, ride flow, live tracking, payments, and current MVP limits."
        />
        <MenuLink
          href="/help"
          icon={HelpCircle}
          title="Help and support"
          text="Location, booking, private code, chat, payment, and support guidance."
        />
        <MenuLink
          href="/privacy"
          icon={ShieldCheck}
          title="Privacy policy"
          text="What data Taxiro stores, who can see it, and MVP privacy limits."
        />
        <MenuLink
          href="/rules"
          icon={ListChecks}
          title="Rules and regulations"
          text="Safety rules, misuse rules, payment rules, and accepted-ride cancellation fine policy."
        />

        <Button className="h-12" onClick={onSignOut} variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </aside>
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  text,
  title,
}: {
  href: string;
  icon: LucideIcon;
  text: string;
  title: string;
}) {
  return (
    <Link className="block rounded-lg border border-border bg-muted p-4 transition hover:border-primary/20 hover:bg-secondary" href={href}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-card">
          <Icon className="size-4" />
        </span>
        <h3 className="font-black">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </Link>
  );
}
function MenuCard({
  icon: Icon,
  text,
  title,
}: {
  icon: LucideIcon;
  text: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-muted p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-card">
          <Icon className="size-4" />
        </span>
        <h3 className="font-black">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </section>
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
  if (seconds < 10) return "live now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}



































