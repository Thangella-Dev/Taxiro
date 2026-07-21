"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
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
import { AppNotificationBell } from "@/components/AppNotificationBell";
import { CancelRideDialog } from "@/components/CancelRideDialog";
import { DemandSignals } from "@/components/DemandSignals";
import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { RideChatPanel } from "@/components/RideChatPanel";
import { RideProgress } from "@/components/RideProgress";
import { ResponsiveRideSheet } from "@/components/ResponsiveRideSheet";
import { RiderAvailabilityToggle } from "@/components/RiderAvailabilityToggle";
import { RiderMenu } from "@/components/RiderMenu";
import { RiderVehicleSwitcher } from "@/components/RiderVehicleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RouteSetupForm } from "@/components/RouteSetupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProfile, getCurrentUser, getProfile } from "@/lib/auth";
import { getRoutePath, getRouteSummary } from "@/lib/maps";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getPreciseCurrentLocation, watchRiderLocation, type RiderTrackingUpdate } from "@/lib/tracking";
import { getSupabase } from "@/lib/supabase";
import { useLiveResync } from "@/lib/useLiveResync";
import { getVehicleLabel } from "@/lib/vehicles";
import type { LatLng, Profile, RideRequest, RiderLocation, RiderProfile, RiderVehicle, VehicleType } from "@/types/database";

const DEMAND_RADIUS_KM = 2;
const SCHEDULED_DEMAND_LOOKAHEAD_HOURS = 6;

export default function RiderDashboard() {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<RideRequest | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<LatLng>({ lat: 17.385, lng: 78.4867 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("GPS starting...");
  const [message, setMessage] = useState("");
  const [riderHomeView, setRiderHomeView] = useState<"ready" | "advance" | "route">("ready");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [riderVehicles, setRiderVehicles] = useState<RiderVehicle[]>([]);
  const [switchingVehicle, setSwitchingVehicle] = useState(false);
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number | null; durationMin: number | null } | null>(null);
  const availabilityRef = useRef(false);
  const manualOfflineRef = useRef(false);
  const autoOnlineForRef = useRef<string | null>(null);

  const loadRiderData = useCallback(async (riderId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    await supabase.rpc("expire_ready_signals");

    const [rideResult, riderResult, myLocationResult, riderProfileResult, riderVehicleResult] = await Promise.all([
      supabase
        .from("ride_requests")
        .select("*")
        .or(`status.in.(scheduled,ready),assigned_rider_id.eq.${riderId}`)
        .order("created_at", { ascending: false }),
      supabase.from("rider_locations").select("*"),
      supabase.from("rider_locations").select("*").eq("rider_id", riderId).maybeSingle(),
      supabase.from("rider_profiles").select("*").eq("rider_id", riderId).maybeSingle(),
      supabase.from("rider_vehicles").select("*").eq("rider_id", riderId).order("vehicle_type"),
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
    let loadedRiderProfile = (riderProfileResult.data as RiderProfile | null) ?? null;
    const loadedVehicles = (riderVehicleResult.data as RiderVehicle[]) ?? [];
    if (riderVehicleResult.error) {
      setMessage(riderVehicleResult.error.message);
    } else {
      setRiderVehicles(loadedVehicles);
    }

    const verifiedVehicles = loadedVehicles.filter((vehicle) => vehicle.verification_status === "verified");
    const activeVehicleIsVerified = verifiedVehicles.some(
      (vehicle) => vehicle.vehicle_type === loadedRiderProfile?.active_vehicle_type,
    );
    const hasActiveJob = ((rideResult.data as RideRequest[] | null) ?? []).some(
      (ride) => ride.assigned_rider_id === riderId && ["assigned", "started"].includes(ride.status),
    );
    if (
      loadedRiderProfile?.verification_status === "verified" &&
      verifiedVehicles.length > 0 &&
      !activeVehicleIsVerified &&
      !hasActiveJob
    ) {
      const preferredVehicle = verifiedVehicles.find((vehicle) => vehicle.vehicle_type === "bike") ?? verifiedVehicles[0];
      const { data: activatedProfile, error: activationError } = await supabase.rpc("set_active_rider_vehicle", {
        p_vehicle_type: preferredVehicle.vehicle_type,
      });
      if (!activationError && activatedProfile) {
        loadedRiderProfile = activatedProfile as RiderProfile;
        setMessage(`${getVehicleLabel(preferredVehicle.vehicle_type)} verified and activated for matching.`);
      } else if (activationError) {
        setMessage(`Vehicle is verified but could not be activated: ${activationError.message}`);
      }
    }
    setRiderProfile(loadedRiderProfile);
  }, []);

  useEffect(() => {
    availabilityRef.current = riderLocation?.is_available ?? false;
  }, [riderLocation?.is_available]);

  const persistAvailability = useCallback(
    async (available: boolean) => {
      if (!profile) return "Please sign in again.";
      const supabase = getSupabase();
      if (!supabase) return "Supabase is not configured.";

      const now = new Date().toISOString();
      availabilityRef.current = available;
      setRiderLocation((current) => ({
        accuracy_m: current?.accuracy_m ?? null,
        heading: current?.heading ?? null,
        is_available: available,
        last_seen_at: current?.last_seen_at ?? now,
        lat: current?.lat ?? location.lat,
        lng: current?.lng ?? location.lng,
        rider_id: profile.id,
        speed: current?.speed ?? null,
        updated_at: now,
      }));

      const { error } = await supabase.from("rider_locations").upsert({
        is_available: available,
        lat: location.lat,
        lng: location.lng,
        rider_id: profile.id,
        updated_at: now,
      });
      return error?.message ?? null;
    },
    [location.lat, location.lng, profile],
  );

  const changeAvailability = useCallback(
    async (available: boolean) => {
      const previousManualOffline = manualOfflineRef.current;
      manualOfflineRef.current = !available;
      const error = await persistAvailability(available);
      if (error) {
        manualOfflineRef.current = previousManualOffline;
        setMessage(error);
        return error;
      }
      setMessage(available ? "You are online and visible for matching." : "You are offline for this app session.");
      return null;
    },
    [persistAvailability],
  );

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_vehicles" },
        (payload) => {
          if (!riderId) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderVehicle>;
            if (deleted.id) setRiderVehicles((current) => current.filter((vehicle) => vehicle.id !== deleted.id));
            return;
          }
          const incoming = payload.new as RiderVehicle;
          if (incoming.rider_id === riderId) setRiderVehicles((current) => upsertById(current, incoming));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rider_profiles" },
        (payload) => {
          if (!riderId) return;
          const incoming = payload.new as RiderProfile;
          if (incoming.rider_id === riderId) setRiderProfile(incoming);
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
      getIsAvailable: () => availabilityRef.current,
      onError: (trackingError) => {
        setGpsStatus(trackingError);
      },
      onUpdate: (liveLocation: RiderTrackingUpdate) => {
        const now = new Date().toISOString();
        setLocation({ lat: liveLocation.lat, lng: liveLocation.lng });
        setRiderLocation((current) => ({
          accuracy_m: liveLocation.accuracy_m,
          heading: liveLocation.heading,
          is_available: current?.is_available ?? false,
          last_seen_at: now,
          lat: liveLocation.lat,
          lng: liveLocation.lng,
          rider_id: profile.id,
          speed: liveLocation.speed,
          updated_at: now,
        }));
        setGpsStatus(`Live GPS on${liveLocation.accuracy_m ? ` - +/-${Math.round(liveLocation.accuracy_m)}m` : ""}`);
      },
      riderId: profile.id,
      supabase,
    });

    return () => {
      stop?.();
    };
  }, [profile]);
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

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const expireAndRefresh = async () => {
      await supabase.rpc("expire_ready_signals");
      await loadRiderData(profile.id);
    };

    const interval = window.setInterval(() => {
      void expireAndRefresh();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadRiderData, profile?.id]);
  async function updateLocation(point: LatLng & Partial<RiderTrackingUpdate>, source: "gps" | "manual" = "manual") {
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
      is_available: availabilityRef.current,
      lat: point.lat,
      lng: point.lng,
      rider_id: profile.id,
      accuracy_m: point.accuracy_m ?? null,
      heading: point.heading ?? null,
      last_seen_at: new Date().toISOString(),
      speed: point.speed ?? null,
      updated_at: new Date().toISOString(),
    });
    setGpsStatus(
      error
        ? `${source === "gps" ? "GPS" : "Manual"} location update failed.`
        : `${source === "gps" ? "GPS refreshed" : "Manual location updated"}${point.accuracy_m ? ` - +/-${Math.round(point.accuracy_m)}m` : ""}.`,
    );
    setMessage(error ? error.message : "Location updated.");
    await loadRiderData(profile.id);
  }

  async function detectRiderLocation() {
    if (!profile) {
      setMessage("Please sign in as a rider.");
      return;
    }

    setDetectingLocation(true);
    setGpsStatus("Finding a precise GPS fix...");
    try {
      const position = await getPreciseCurrentLocation((accuracyM) => {
        setGpsStatus(`Confirming fresh GPS samples... +/-${accuracyM}m`);
      });
      await updateLocation(
        {
          accuracy_m: Math.round(position.coords.accuracy),
          heading: position.coords.heading,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed,
        },
        "gps",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "GPS detection failed. Choose your location on the map.";
      setGpsStatus(errorMessage);
      setMessage(errorMessage);
    } finally {
      setDetectingLocation(false);
    }
  }

  async function switchVehicle(vehicleType: VehicleType) {
    if (!profile || switchingVehicle) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setSwitchingVehicle(true);
    setMessage(`Switching to ${vehicleType}...`);
    const { data, error } = await supabase.rpc("set_active_rider_vehicle", {
      p_vehicle_type: vehicleType,
    });
    setSwitchingVehicle(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRiderProfile(data as RiderProfile);
    setMessage(`${vehicleType[0].toUpperCase()}${vehicleType.slice(1)} is now active for matching.`);
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

  async function cancelRide(ride: RideRequest, reason: string): Promise<string | null> {
    if (!profile) {
      return "Please sign in again before cancelling this ride.";
    }
    const supabase = getSupabase();
    if (!supabase) {
      return "Supabase is not configured.";
    }
    const { error } = await supabase.rpc("cancel_ride", {
      p_reason: reason,
      p_ride_id: ride.id,
    });
    setMessage(error ? `Could not cancel: ${error.message}` : "Ride cancelled and released.");
    if (!error) {
      setCancelTarget(null);
    }
    await loadRiderData(profile.id);
    return error?.message ?? null;
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

  const activeVehicleType = riderProfile?.active_vehicle_type ?? null;
  const hasVerifiedActiveVehicle = Boolean(
    riderProfile?.verification_status === "verified" &&
    activeVehicleType &&
    riderVehicles.some((vehicle) => vehicle.vehicle_type === activeVehicleType && vehicle.verification_status === "verified"),
  );
  const riderHasActiveJob = rides.some(
    (ride) => ride.assigned_rider_id === profile?.id && ["assigned", "started"].includes(ride.status),
  );

  useEffect(() => {
    if (!profile || !hasVerifiedActiveVehicle || riderHasActiveJob) return;
    if (autoOnlineForRef.current === profile.id) return;

    autoOnlineForRef.current = profile.id;
    manualOfflineRef.current = false;
    void persistAvailability(true).then((error) => {
      if (error) setMessage("Could not go online automatically: " + error);
    });
  }, [hasVerifiedActiveVehicle, persistAvailability, profile, riderHasActiveJob]);

  useEffect(() => {
    if (!profile || !hasVerifiedActiveVehicle) return;

    const updateForVisibility = () => {
      if (document.visibilityState === "hidden") {
        void persistAvailability(false);
      } else if (!manualOfflineRef.current && !riderHasActiveJob) {
        void persistAvailability(true);
      }
    };
    const markOffline = () => {
      void persistAvailability(false);
    };

    document.addEventListener("visibilitychange", updateForVisibility);
    window.addEventListener("pagehide", markOffline);
    return () => {
      document.removeEventListener("visibilitychange", updateForVisibility);
      window.removeEventListener("pagehide", markOffline);
    };
  }, [hasVerifiedActiveVehicle, persistAvailability, profile, riderHasActiveJob]);

  const visibleDemandRides = rides
    .filter((ride) =>
      isRideDemandVisibleNearRider(ride, location, activeVehicleType, DEMAND_RADIUS_KM),
    )
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "ready" ? -1 : 1;
      const distanceDelta = approxDistanceKm(location, a) - approxDistanceKm(location, b);
      if (distanceDelta !== 0) return distanceDelta;
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    });
  const readyRides = visibleDemandRides.filter((ride) => ride.status === "ready");
  const scheduledRides = visibleDemandRides.filter((ride) => ride.status === "scheduled");
  const demandMapRides = visibleDemandRides.slice(0, 18);
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
  const mapRiders = useMemo(
    () => (riderLocation ? [{ ...riderLocation, lat: location.lat, lng: location.lng }] : []),
    [location.lat, location.lng, riderLocation],
  );
  const mapRiderVehicleTypes: Partial<Record<string, VehicleType>> =
    profile?.id && activeVehicleType ? { [profile.id]: activeVehicleType } : {};

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

  if (loading) {
    return <LoadingRiderShell />;
  }
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
      <div className="taxiro-immersive-stage taxiro-responsive-stage relative min-w-0 w-full max-w-full overflow-x-clip bg-muted [contain:inline-size]">
        <DynamicMapPicker
          className="taxiro-map-canvas overflow-hidden"
          demandRides={activeRide ? [] : demandMapRides}
          drop={mapDrop}
          focusPoint={!activeRide ? location : null}
          onPick={(point) => void updateLocation(point)}
          pickup={mapPickup}
          riders={mapRiders}
          riderVehicleTypes={mapRiderVehicleTypes}
          route={routePath}
        />

        <div className="taxiro-overlay-bar pointer-events-none absolute inset-x-2 top-0 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 sm:gap-3 lg:inset-x-4">
          <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-xl border border-white/80 bg-white/94 p-2.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:max-w-sm sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Taxiro rider</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-tight sm:gap-2 sm:text-lg">
              <Bike className="size-4 sm:size-5" />
              {activeRide ? riderHeadline(activeRide.status) : "Find nearby work"}
            </p>
          </div>
          <div className="pointer-events-auto flex min-w-0 shrink items-center gap-1 rounded-xl border border-white/80 bg-white/94 p-1 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:gap-1.5">
            {profile ? (
              <RiderAvailabilityToggle
                available={riderLocation?.is_available ?? false}
                canGoOnline={hasVerifiedActiveVehicle}
                onChange={changeAvailability}
                onError={setMessage}
              />
            ) : null}
            <AppNotificationBell profileId={profile?.id ?? null} />
            <ThemeToggle compact />
            <button
              aria-label="Refresh rider location"
              aria-busy={detectingLocation}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur transition active:scale-95 disabled:cursor-wait disabled:opacity-70 sm:size-11"
              disabled={detectingLocation}
              onClick={() => void detectRiderLocation()}
              type="button"
            >
              <LocateFixed className={`size-4 text-primary sm:size-5 ${detectingLocation ? "animate-pulse" : ""}`} />
            </button>
            <button
              aria-label="Open rider menu"
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card/95 text-primary shadow-[var(--shadow-soft)] backdrop-blur transition active:scale-95 sm:size-11"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        <div className="absolute left-2 top-[calc(max(0.5rem,env(safe-area-inset-top))+4.35rem)] z-[1100] max-w-[calc(100%-1rem)] sm:left-4 sm:top-20">
          <div className="max-w-[13rem] truncate rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-left text-[11px] font-bold text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur sm:max-w-[16rem]">
            {gpsStatus}
          </div>
        </div>

        <ResponsiveRideSheet
          className={`taxiro-rider-sheet ${activeRide ? "" : "taxiro-rider-workbench"}`}
          desktopSide="right"
          mobileLabel={activeRide ? "active ride" : "rider work"}
        >
            {activeRide ? (
              <ActiveRiderJob
                code={codes[activeRide.id] ?? ""}
                currentUserId={profile?.id ?? null}
                directionsUrl={directionsUrl}
                location={location}
                routeSummary={routeSummary}
                riderLocation={riderLocation}
                riderProfile={riderProfile}
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
                    <h1 className="text-xl font-black tracking-tight sm:text-3xl">Rider home</h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Accept ready jobs, watch advance demand, or set an On-The-Way route.
                    </p>
                  </div>
                  <Badge className="bg-secondary text-secondary-foreground">
                    {riderLocation?.is_available ? "Online" : "Offline"}
                  </Badge>
                </div>
                <RiderVehicleSwitcher
                  activeType={activeVehicleType}
                  busy={switchingVehicle}
                  disabled={Boolean(activeRide)}
                  onSwitch={(type) => void switchVehicle(type)}
                  vehicles={riderVehicles}
                />
                {!hasVerifiedActiveVehicle ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800" role="status">
                    {riderProfile?.verification_status !== "verified"
                      ? "Identity verification is still pending. Demand appears after admin approval."
                      : riderVehicles.some((vehicle) => vehicle.verification_status === "verified")
                        ? "Activating your verified vehicle for matching. Keep this screen open for a moment."
                        : "Add a vehicle and wait for admin verification to receive matching demand."}
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                  <MiniStat icon={Radio} label="Ready" value={readyRides.length} />
                  <MiniStat icon={Clock3} label="Advance" value={scheduledRides.length} />
                  <MiniStat icon={Gauge} label="Riders" value={riders.filter((rider) => rider.is_available).length} />
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:hidden">
                  {(["ready", "advance", "route"] as const).map((view) => (
                    <button
                      className={`rounded-md px-2 py-2.5 text-xs font-black transition sm:text-sm ${riderHomeView === view ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                      key={view}
                      onClick={() => setRiderHomeView(view)}
                      type="button"
                    >
                      {view === "ready" ? `Ready (${readyRides.length})` : view === "advance" ? `Demand (${scheduledRides.length})` : "Route"}
                    </button>
                  ))}
                </div>
                <div className="max-h-[42svh] overflow-y-auto overflow-x-hidden pr-1 lg:hidden">
                  {riderHomeView === "ready" ? (
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
                        <RiderEmptyState
                          title="No ready jobs right now"
                          text="Stay online with live GPS on. Ready requests within 2 km will appear here instantly and pulse on the map."
                        />
                      )}
                    </div>
                  ) : null}
                  {riderHomeView === "advance" ? (
                    <div className="grid gap-3">
                      <DemandSignals compact rides={demandMapRides} />
                      {scheduledRides.length ? (
                        scheduledRides.map((ride) => (
                          <ScheduledRequestCard currentLocation={location} key={ride.id} ride={ride} />
                        ))
                      ) : (
                        <RiderEmptyState
                          title="No advance bookings yet"
                          text="Scheduled pickup demand within 2 km will appear here before it becomes ready. Use it to plan where to wait."
                        />
                      )}
                    </div>
                  ) : null}
                  {riderHomeView === "route" ? (
                    <div className="grid gap-3">
                      <RiderRouteIntro />
                      {profile ? <RouteSetupForm defaultExpanded riderId={profile.id} /> : null}
                    </div>
                  ) : null}
                </div>
                <div className="hidden gap-3 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1fr)] xl:grid-cols-3">
                  <RiderWorkbenchPanel badge={`${readyRides.length} live`} title="Ready jobs">
                    <div className="grid max-h-[calc(100dvh-19rem)] gap-3 overflow-y-auto overflow-x-hidden pr-1">
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
                        <RiderEmptyState
                          title="No ready jobs right now"
                          text="Keep live GPS on. Timed ready signals within 2 km appear here and pulse on the map until they expire."
                        />
                      )}
                    </div>
                  </RiderWorkbenchPanel>
                  <RiderWorkbenchPanel badge={`${scheduledRides.length} advance`} title="Demand signals">
                    <div className="grid max-h-[calc(100dvh-19rem)] gap-3 overflow-y-auto overflow-x-hidden pr-1">
                      <DemandSignals rides={demandMapRides} />
                      {scheduledRides.length ? (
                        scheduledRides.slice(0, 2).map((ride) => (
                          <ScheduledRequestCard currentLocation={location} key={ride.id} ride={ride} />
                        ))
                      ) : (
                        <RiderEmptyState
                          title="No advance demand yet"
                          text="Nearby scheduled pickup demand appears here before riders can accept it."
                        />
                      )}
                    </div>
                  </RiderWorkbenchPanel>
                  <RiderWorkbenchPanel badge="Route" title="On-The-Way">
                    <div className="grid max-h-[calc(100dvh-19rem)] gap-3 overflow-y-auto overflow-x-hidden pr-1">
                      <RiderRouteIntro />
                      {profile ? <RouteSetupForm defaultExpanded riderId={profile.id} /> : null}
                    </div>
                  </RiderWorkbenchPanel>
                </div>
              </div>
            )}
            {message ? <p className="mt-3 text-center text-sm text-muted-foreground">{message}</p> : null}
        </ResponsiveRideSheet>
        {activeRide ? (
          <div className="absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[1210] hidden w-[28rem] -translate-x-1/2 grid-cols-3 gap-1.5 xl:grid">
            <FloatingStat label="Job" value={activeRide.status} />
            <FloatingStat label="ETA" value={`${activeRide.estimated_duration_min ?? "--"}m`} />
            <FloatingStat label="KM" value={`${activeRide.distance_km ?? "--"}`} />
          </div>
        ) : null}
        {cancelTarget ? (
          <CancelRideDialog
            actor="rider"
            onClose={() => setCancelTarget(null)}
            onConfirm={(reason) => cancelRide(cancelTarget, reason)}
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


    </AppShell>
  );
}

function isReadyRideVisible(ride: RideRequest) {
  if (ride.status !== "ready") return false;
  if (!ride.ready_expires_at) return true;
  return new Date(ride.ready_expires_at).getTime() > Date.now();
}

function isScheduledDemandVisible(ride: RideRequest) {
  if (ride.status !== "scheduled") return false;
  const scheduledAt = new Date(ride.scheduled_time).getTime();
  const now = Date.now();
  const lookaheadMs = SCHEDULED_DEMAND_LOOKAHEAD_HOURS * 60 * 60 * 1000;
  return scheduledAt >= now && scheduledAt <= now + lookaheadMs;
}

function isRideDemandVisibleNearRider(
  ride: RideRequest,
  location: LatLng,
  activeVehicleType: VehicleType | null,
  radiusKm: number,
) {
  if (!activeVehicleType || ride.vehicle_type !== activeVehicleType) return false;
  if (!isReadyRideVisible(ride) && !isScheduledDemandVisible(ride)) return false;
  return approxDistanceKm(location, ride) <= radiusKm;
}

function formatReadySignalTimeLeft(value: string | null) {
  if (!value) return "live now";
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) return "expired";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes <= 1) return "under 1 min left";
  return `${minutes} min left`;
}

function RiderWorkbenchPanel({
  badge,
  children,
  title,
}: {
  badge: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h2 className="truncate text-sm font-black uppercase tracking-[0.12em]">{title}</h2>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-black text-muted-foreground">
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}
function RiderEmptyState({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-sm">
      <p className="font-black text-foreground">{title}</p>
      <p className="mt-1 leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function RiderRouteIntro() {
  return (
    <div className="rounded-lg bg-[#101713] p-4 text-white">
      <p className="text-sm font-semibold text-white/60">On-The-Way matching</p>
      <p className="mt-1 text-xl font-black">Get rides along your direction</p>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Add where you are starting and where you are going. Taxiro can use this route to surface pickups that fit your travel direction.
      </p>
    </div>
  );
}

function ScheduledRequestCard({ currentLocation, ride }: { currentLocation: LatLng; ride: RideRequest }) {
  const fareBreakdown = calculateFareBreakdown(ride.fare_estimate);
  const riderEarning = ride.rider_earning ?? fareBreakdown.riderEarning;
  const pickupDistance = approxDistanceKm(currentLocation, ride);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge className="bg-muted text-foreground">Advance</Badge>
          <p className="mt-2 font-black">{new Date(ride.scheduled_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pickup is about {pickupDistance} km from your current area.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black">{formatMoney(ride.fare_estimate)}</p>
          <p className="text-xs font-bold text-muted-foreground">earn {formatMoney(riderEarning)}</p>
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
      <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
        This is a demand signal. It becomes acceptable when the customer taps I&apos;m Ready.
      </p>
    </div>
  );
}
function LoadingRiderShell() {
  return (
    <AppShell immersive title="Rider app">
      <div className="taxiro-immersive-stage relative min-w-0 w-full max-w-full overflow-x-clip bg-muted [contain:inline-size]">
        <DynamicMapPicker className="taxiro-map-canvas overflow-hidden" />
        <div className="taxiro-overlay-bar pointer-events-none absolute inset-x-2 top-0 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 lg:inset-x-4">
          <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-xl border border-white/80 bg-white/94 p-2.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:max-w-sm sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Taxiro rider</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-tight sm:gap-2 sm:text-lg">
              <Bike className="size-4 sm:size-5" />
              Finding nearby work
            </p>
          </div>
        </div>
        <section className="taxiro-sheet-shell taxiro-rider-sheet min-w-0 max-w-full overflow-x-clip">
          <div className="taxiro-sheet-surface min-w-0 max-w-full">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border lg:hidden" />
            <div className="grid gap-3" aria-busy="true" aria-live="polite">
              <div className="h-8 w-4/5 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-full animate-pulse rounded-lg bg-muted" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
function FloatingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/70 bg-white/94 px-2 py-1.5 text-center shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-black capitalize">{value}</p>
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
    <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
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
  const readyTimeLeft = formatReadySignalTimeLeft(ride.ready_expires_at);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge className="bg-secondary text-secondary-foreground">Ready now</Badge>
          <p className="mt-2 font-black">Ride #{ride.id.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pickupDistance} km away from you - {readyTimeLeft}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:min-w-48">
          <div className="rounded-lg bg-muted p-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Fare</p>
            <p className="font-black">{formatMoney(ride.fare_estimate)}</p>
          </div>
          <div className="rounded-lg bg-secondary p-2">
            <p className="text-[10px] font-bold uppercase text-secondary-foreground/70">You earn</p>
            <p className="font-black text-secondary-foreground">{formatMoney(riderEarning)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <p className="rounded-lg bg-secondary/70 px-3 py-2 text-xs font-bold">
          {ride.booking_for === "other" ? `Picking up ${ride.passenger_name || "another passenger"}` : "Customer is riding"}
          {ride.fare_rate_per_km ? ` - ${getVehicleLabel(ride.vehicle_type)} Rs ${(ride.fare_rate_per_km ?? 0) + (ride.vehicle_surcharge_per_km ?? 0)}/km` : ""}
        </p>
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
        <p className="mt-3 rounded-lg bg-secondary/80 p-3 text-sm font-semibold">
          Pickup note: {ride.rider_note}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2">
          <p className="font-black">{ride.distance_km ?? "--"}</p>
          <p className="text-muted-foreground">km trip</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <p className="font-black">{ride.estimated_duration_min ?? "--"}</p>
          <p className="text-muted-foreground">min</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <p className="font-black uppercase">{ride.payment_method ?? "cash"}</p>
          <p className="text-muted-foreground">pay</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <p className="font-black">{formatMoney(companyCommission)}</p>
          <p className="text-muted-foreground">Taxiro</p>
        </div>
      </div>
      <Button className="mt-4 h-12 w-full rounded-lg bg-[#101713] text-base font-black text-white hover:bg-[#101713]/90" onClick={onAccept}>
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
  riderProfile,
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
  riderProfile: RiderProfile | null;
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
        <Badge className="bg-primary text-primary-foreground">Active {getVehicleLabel(ride.vehicle_type)} job</Badge>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{riderHeadline(ride.status)}</h1>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {ride.pickup_address} to {ride.drop_address}
        </p>
      </div>
      <RideProgress ride={ride} />
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-secondary/60 p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Passenger</p>
          <p className="truncate font-black">{ride.passenger_name || (ride.booking_for === "other" ? "Guest passenger" : "Customer")}</p>
          <p className="text-xs text-muted-foreground">{ride.booking_for === "other" ? "Booked by someone else" : "Self booking"}</p>
        </div>
        {ride.passenger_phone ? (
          <Button asChild className="shrink-0" size="sm" variant="outline">
            <a href={`tel:${ride.passenger_phone}`}>Call passenger</a>
          </Button>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black">{currentTask}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{taskHelp}</p>
          </div>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-black capitalize text-secondary-foreground">
            {destination}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
          <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">ETA</p>
            <p className="mt-1 text-lg font-black">{liveEta ? `${liveEta}m` : "--"}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Route</p>
            <p className="mt-1 text-lg font-black">{liveDistance ? `${liveDistance}km` : "--"}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">GPS</p>
            <p className="mt-1 truncate text-xs font-black">
              {riderLocation?.last_seen_at ? formatTrackingAge(riderLocation.last_seen_at) : "manual"}
            </p>
          </div>
        </div>
        <Button asChild className="mt-3 h-12 w-full rounded-lg bg-[#101713] text-white hover:bg-[#101713]/90">
          <a href={primaryDirections} rel="noreferrer" target="_blank">
            {ride.status === "assigned" ? "Navigate to pickup" : "Navigate to drop"}
          </a>
        </Button>
      </div>
      {ride.status === "assigned" ? (
        <div className="rounded-lg border border-border bg-muted p-3">
          <Label htmlFor={`active-code-${ride.id}`}>Ask user for 4-digit code</Label>
          <div className="mt-2 grid gap-2 sm:flex">
            <Input
              className="h-12 bg-card text-center font-mono text-lg tracking-[0.4em]"
              id={`active-code-${ride.id}`}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="0000"
              value={code}
            />
            <Button className="h-12 sm:shrink-0" onClick={onStart}>
              Start
            </Button>
          </div>
          <Button className="mt-3 h-11 w-full rounded-lg" onClick={onCancel} variant="destructive">
            Cancel accepted ride
          </Button>
        </div>
      ) : null}
      <RideChatPanel currentUserId={currentUserId} ride={ride} />
      {ride.status === "started" ? (
        <div className="rounded-lg bg-[#101713] p-4 text-white">
          <p className="text-sm font-semibold text-white/60">Payment collection</p>
          <p className="mt-1 text-xl font-black">Collect fare before completing</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Total fare {formatMoney(ride.fare_estimate)}. Taxiro commission is {formatMoney(companyCommission)}; you earn {formatMoney(riderEarning)}.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[#101713]">
            <div className="rounded-lg bg-white/90 p-2"><p className="text-[10px] font-bold uppercase">Fare</p><p className="font-black">{formatMoney(ride.fare_estimate)}</p></div>
            <div className="rounded-lg bg-white/90 p-2"><p className="text-[10px] font-bold uppercase">Taxiro</p><p className="font-black">{formatMoney(companyCommission)}</p></div>
            <div className="rounded-lg bg-secondary p-2"><p className="text-[10px] font-bold uppercase">You</p><p className="font-black">{formatMoney(riderEarning)}</p></div>
          </div>
          {ride.payment_status === "awaiting_payment" ? (
            <div className="mt-4 rounded-lg bg-white p-3 text-[#101713]">
              {ride.payment_method === "upi" ? (
                <div className="grid gap-3 text-center">
                  <div>
                    <p className="font-black">Show this QR to the customer</p>
                    <p className="mt-1 text-xs text-black/60">Keep this screen open while they scan and pay {formatMoney(ride.fare_estimate)}.</p>
                  </div>
                  {riderProfile?.upi_qr_image_url ? (
                    <Image alt="Your UPI QR code" className="mx-auto max-h-64 w-full rounded-xl border border-border bg-white object-contain p-2" height={512} src={riderProfile.upi_qr_image_url} unoptimized width={512} />
                  ) : (
                    <p className="rounded-xl bg-muted p-3 text-sm">Upload your UPI QR from the rider menu, or collect cash for this ride.</p>
                  )}
                  {riderProfile?.upi_id ? <p className="text-sm font-semibold">UPI ID: {riderProfile.upi_id}</p> : null}
                </div>
              ) : (
                <p className="text-center text-sm font-semibold">Collect {formatMoney(ride.fare_estimate)} in cash from the customer.</p>
              )}
              <Button className="mt-4 h-14 w-full rounded-lg bg-secondary text-base font-black text-[#101713] hover:bg-secondary/90" onClick={onPaymentReceived}>
                Payment received - complete ride
              </Button>
            </div>
          ) : (
            <Button className="mt-4 h-14 w-full rounded-lg bg-secondary text-base font-black text-[#101713] hover:bg-secondary/90" onClick={onReachedDrop}>
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
