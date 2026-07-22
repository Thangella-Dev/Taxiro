"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  CarFront,
  CarTaxiFront,
  ChevronDown,
  Clock3,
  HelpCircle,
  Info,
  ListChecks,
  LocateFixed,
  LogOut,
  Menu,
  Phone,
  Star,
  Radio,
  Settings,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AppNotificationBell } from "@/components/AppNotificationBell";
import { CancelRideDialog } from "@/components/CancelRideDialog";
import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { RideChatPanel } from "@/components/RideChatPanel";
import { LocationSearch } from "@/components/LocationSearch";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ResponsiveRideSheet } from "@/components/ResponsiveRideSheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RideCard } from "@/components/RideCard";
import { RideProgress } from "@/components/RideProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProfile, getCurrentUser, getProfile, isAuthOrPermissionError } from "@/lib/auth";
import { getRoutePath, getRouteSummary, reverseGeocode } from "@/lib/maps";
import {
  formatMoney,
  getUserCancellationFine,
  getVehicleFareQuote,
} from "@/lib/fare";
import {
  calculateConfiguredFare,
  findEffectivePricingRule,
  findServiceAreaForTrip,
} from "@/lib/operations";
import {
  createSafetyAlert,
  usePanicTrigger,
  useRideSafetyMonitor,
} from "@/lib/safety";
import { calculateTaxiroFareEstimate } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase";
import { createSafeSignedUrl } from "@/lib/storage";
import { buildNearbyRiderLookupPlan } from "@/lib/riderPresence";
import {
  getPromptedCurrentLocation,
  MAX_USABLE_LOCATION_ACCURACY_M,
  PRECISE_TARGET_ACCURACY_M,
} from "@/lib/tracking";
import { useLiveResync } from "@/lib/useLiveResync";
import {
  normalizePhone,
  validateFullName,
  validatePhone,
} from "@/lib/validation";
import { VEHICLE_OPTIONS, getVehicleLabel } from "@/lib/vehicles";
import type {
  AssignedRiderDetails,
  FareCalculationBreakdown,
  LatLng,
  NearbyRiderPreview,
  PaymentMethod,
  PricingRule,
  Profile,
  RideConfirmationCode,
  RideRequest,
  RiderLocation,
  RiderProfile,
  SafetyAlertType,
  ServiceArea,
  VehicleType,
} from "@/types/database";

export default function UserDashboard() {
  const router = useRouter();
  const [bookingMode, setBookingMode] = useState<"now" | "advance">("now");
  const [assignedRiderDetails, setAssignedRiderDetails] = useState<
    Record<string, AssignedRiderDetails>
  >({});
  const [bookingFor, setBookingFor] = useState<"self" | "other" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RideRequest | null>(null);
  const [clickTarget, setClickTarget] = useState<"pickup" | "drop">("pickup");
  const [confirmationCodes, setConfirmationCodes] = useState<
    Record<string, string>
  >({});
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<LatLng | null>(null);
  const [detectingPickup, setDetectingPickup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapPickMode, setMapPickMode] = useState<"pickup" | "drop" | null>(
    null,
  );
  const [mapCandidate, setMapCandidate] = useState<LatLng | null>(null);
  const [mapSelectionStart, setMapSelectionStart] = useState<LatLng | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [panelView, setPanelView] = useState<"book" | "rides">("book");
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [pickupAccuracy, setPickupAccuracy] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [nearbyRiders, setNearbyRiders] = useState<NearbyRiderPreview[]>([]);
  const [nearbyRiderPreviewUnavailable, setNearbyRiderPreviewUnavailable] =
    useState(false);
  const [riderProfiles, setRiderProfiles] = useState<
    Record<string, RiderProfile>
  >({});
  const [riderPhotoUrls, setRiderPhotoUrls] = useState<Record<string, string>>(
    {},
  );
  const [readySignalMinutes, setReadySignalMinutes] = useState<15 | 30 | 60>(
    30,
  );
  const [readyRideId, setReadyRideId] = useState<string | null>(null);
  const [rideNote, setRideNote] = useState("");
  const [sosBusy, setSosBusy] = useState(false);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number | null;
    durationMin: number | null;
  } | null>(null);
  const [liveFareEstimate, setLiveFareEstimate] =
    useState<FareCalculationBreakdown | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [operationalConfigUnavailable, setOperationalConfigUnavailable] =
    useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [showRideOptions, setShowRideOptions] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(() =>
    toDateTimeLocalInput(new Date(Date.now() + 30 * 60 * 1000)),
  );

  const loadNearbyRiders = useCallback(
    async (point: LatLng | null) => {
      const supabase = getSupabase();
      if (!supabase || !point || nearbyRiderPreviewUnavailable) {
        setNearbyRiders([]);
        return;
      }

      const lookupPlan = buildNearbyRiderLookupPlan(vehicleType, 8);
      let merged: NearbyRiderPreview[] = [];

      for (const candidate of lookupPlan) {
        const { data, error } = await supabase.rpc(
          "get_nearby_available_riders",
          {
            p_lat: point.lat,
            p_lng: point.lng,
            p_radius_km: candidate.p_radius_km,
            p_vehicle_type: candidate.p_vehicle_type,
          },
        );

        if (isMissingSupabaseObject(error)) {
          setNearbyRiderPreviewUnavailable(true);
          setNearbyRiders([]);
          return;
        }

        const rows = (data as NearbyRiderPreview[]) ?? [];
        if (rows.length) {
          merged = [...merged, ...rows];
          break;
        }
      }

      if (!merged.length && lookupPlan.length > 1) {
        const fallback = await supabase.rpc("get_nearby_available_riders", {
          p_lat: point.lat,
          p_lng: point.lng,
          p_radius_km: 20,
          p_vehicle_type: null,
        });
        if (!fallback.error) {
          merged = (fallback.data as NearbyRiderPreview[]) ?? [];
        }
      }

      setNearbyRiders(merged);
    },
    [nearbyRiderPreviewUnavailable, vehicleType],
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
      setAssignedRiderDetails({});
      setConfirmationCodes({});
      setRiderLocations([]);
      setRiderProfiles({});
      setRiderPhotoUrls({});
      return;
    }

    const assignedRiderIds = Array.from(
      new Set(
        userRides
          .map((ride) => ride.assigned_rider_id)
          .filter(Boolean) as string[],
      ),
    );
    const [riderResult, riderProfileResult] = await Promise.all([
      supabase.from("rider_locations").select("*"),
      assignedRiderIds.length
        ? supabase
            .from("rider_profiles")
            .select("*")
            .in("rider_id", assignedRiderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const activeCodeRides = userRides.filter((ride) =>
      ["assigned", "started"].includes(ride.status),
    );
    const nextCodes: Record<string, string> = {};

    if (activeCodeRides.length) {
      const codeResults = await Promise.all(
        activeCodeRides.map(async (ride) => {
          const { data: code, error: codeError } = await supabase.rpc(
            "get_or_create_ride_confirmation_code",
            {
              p_ride_id: ride.id,
            },
          );
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

    const nextRiderDetails: Record<string, AssignedRiderDetails> = {};
    const nextPhotoUrls: Record<string, string> = {};
    if (activeCodeRides.length) {
      const detailResults = await Promise.all(
        activeCodeRides.map(async (ride) => {
          const { data: detailRows, error: detailError } = await supabase.rpc(
            "get_assigned_rider_details",
            {
              p_ride_id: ride.id,
            },
          );
          const detail = (
            Array.isArray(detailRows) ? detailRows[0] : detailRows
          ) as AssignedRiderDetails | null;
          let photoUrl = "";
          if (detail?.photo_path) {
            photoUrl = await createSafeSignedUrl(
              supabase,
              "rider-verification",
              detail.photo_path,
              900,
            );
          }
          return {
            detail,
            error: detailError?.message ?? null,
            photoUrl,
            rideId: ride.id,
          };
        }),
      );
      detailResults.forEach((item) => {
        if (item.detail) nextRiderDetails[item.rideId] = item.detail;
        if (item.photoUrl) nextPhotoUrls[item.rideId] = item.photoUrl;
      });
      const detailError = detailResults.find((item) => item.error)?.error;
      if (detailError) setMessage(detailError);
    }
    setAssignedRiderDetails(nextRiderDetails);
    setRiderPhotoUrls(nextPhotoUrls);
    setConfirmationCodes(nextCodes);
    if (riderResult.data) {
      setRiderLocations(riderResult.data as RiderLocation[]);
    }
    if (riderProfileResult.error) {
      setMessage(riderProfileResult.error.message);
    } else if (riderProfileResult.data) {
      const nextProfiles = (
        (riderProfileResult.data as RiderProfile[]) ?? []
      ).reduce<Record<string, RiderProfile>>((profiles, item) => {
        profiles[item.rider_id] = item;
        return profiles;
      }, {});
      setRiderProfiles(nextProfiles);
    }
  }, []);

  const loadOperationalConfig = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const [areasResult, rulesResult] = await Promise.all([
      supabase.from("service_areas").select("*").eq("is_active", true),
      supabase.from("pricing_rules").select("*").eq("is_active", true),
    ]);

    if (
      isMissingSupabaseObject(areasResult.error) ||
      isMissingSupabaseObject(rulesResult.error)
    ) {
      setOperationalConfigUnavailable(true);
      setServiceAreas([]);
      setPricingRules([]);
      return;
    }
    setOperationalConfigUnavailable(false);
    if (!areasResult.error)
      setServiceAreas((areasResult.data as ServiceArea[]) ?? []);
    if (!rulesResult.error)
      setPricingRules((rulesResult.data as PricingRule[]) ?? []);
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
      await Promise.all([loadRides(user.id), loadOperationalConfig()]);
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
              setRides((current) =>
                current.filter((ride) => ride.id !== deleted.id),
              );
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
          setRiderProfiles((current) => ({
            ...current,
            [incoming.rider_id]: incoming,
          }));
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
              setRiderLocations((current) =>
                current.filter((rider) => rider.rider_id !== deleted.rider_id),
              );
            }
            return;
          }

          setRiderLocations((current) =>
            upsertRiderLocation(current, payload.new as RiderLocation),
          );
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage(
            "Live updates are reconnecting. Keep this page open for instant ride updates.",
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadOperationalConfig, loadRides]);

  useEffect(() => {
    if (!pickup) return;
    const initial = window.setTimeout(() => void loadNearbyRiders(pickup), 0);
    const interval = window.setInterval(
      () => void loadNearbyRiders(pickup),
      12000,
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadNearbyRiders, pickup]);

  function startMapPick(target: "pickup" | "drop") {
    const start =
      target === "pickup"
        ? (pickup ?? { lat: 17.385, lng: 78.4867 })
        : (drop ?? pickup ?? { lat: 17.385, lng: 78.4867 });
    setClickTarget(target);
    setMapCandidate(start);
    setMapSelectionStart(start);
    setMapPickMode(target);
    setMessage(
      `Move the map until the pin is exactly over your ${target}, then confirm.`,
    );
  }

  async function confirmMapPick() {
    if (!mapCandidate || !mapPickMode) return;
    setMessage("Confirming the selected address...");
    const address = await reverseGeocode(mapCandidate);
    const selected = {
      ...mapCandidate,
      address:
        address ??
        `Pinned location ${mapCandidate.lat.toFixed(5)}, ${mapCandidate.lng.toFixed(5)}`,
    };
    if (mapPickMode === "pickup") {
      setPickup(selected);
      setPickupAccuracy(null);
    } else setDrop(selected);
    setMapPickMode(null);
    setMapCandidate(null);
    setMapSelectionStart(null);
    setMessage(
      `${clickTarget === "pickup" ? "Pickup" : "Drop"} pinned on the map.`,
    );
  }
  async function detectPickupLocation() {
    if (!activeRide && bookingFor === "other") {
      setMessage(
        "For another passenger, search their pickup or pin it on the map.",
      );
      return;
    }
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
        setMessage(`Confirming fresh GPS samples... currently +/-${accuracy}m`);
      });
      const detected = {
        address: `Detected location (${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)})`,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setDeviceLocation(detected);
      if (activeRide) {
        setPickupAccuracy(Math.round(position.coords.accuracy));
        setMessage(
          "Current location updated with +/-" +
            Math.round(position.coords.accuracy) +
            "m accuracy.",
        );
        return;
      }
      setPickupAccuracy(Math.round(position.coords.accuracy));
      if (position.coords.accuracy > PRECISE_TARGET_ACCURACY_M) {
        setClickTarget("pickup");
        setMapCandidate(detected);
        setMapSelectionStart(detected);
        setMapPickMode("pickup");
        setMessage(
          "GPS is confirmed within +/-" +
            Math.round(position.coords.accuracy) +
            "m. Move the map to the exact pickup entrance, then confirm.",
        );
        return;
      }
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
      setMessage(
        error instanceof Error
          ? error.message
          : "Location permission denied. Search or choose on map.",
      );
    } finally {
      setDetectingPickup(false);
    }
  }

  async function createRide() {
    if (!userId) {
      setMessage("Please sign in before creating a ride.");
      return;
    }
    if (!bookingFor) {
      setMessage("Choose whether this ride is for you or another passenger.");
      return;
    }
    if (!pickup || !drop) {
      setMessage("Choose pickup and drop first.");
      return;
    }
    const cleanPassengerName =
      bookingFor === "self"
        ? (profile?.full_name?.trim() ?? "")
        : passengerName.trim().replace(/\s+/g, " ");
    const rawPassengerPhone =
      bookingFor === "self"
        ? (profile?.phone?.trim() ?? "")
        : passengerPhone.trim();
    const passengerValidationError =
      validateFullName(cleanPassengerName, "Passenger name") ??
      validatePhone(rawPassengerPhone, "Passenger phone");
    if (passengerValidationError) {
      setMessage(passengerValidationError);
      return;
    }
    const cleanPassengerPhone = normalizePhone(rawPassengerPhone);

    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (
      bookingMode === "advance" &&
      new Date(scheduledTime).getTime() <= Date.now()
    ) {
      setMessage("Choose a future date and time for an advance booking.");
      return;
    }

    const rideTime =
      bookingMode === "now"
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        : new Date(scheduledTime).toISOString();

    const serviceDecision = findServiceAreaForTrip(
      serviceAreas,
      pickup,
      drop,
      vehicleType,
    );
    if (serviceDecision.reason) {
      setMessage(serviceDecision.reason);
      return;
    }

    setMessage("Finding route and fare...");
    const summary = await getRouteSummary(pickup, drop);
    let fareBreakdown: FareCalculationBreakdown;
    try {
      fareBreakdown = await calculateTaxiroFareEstimate({
        at: rideTime,
        distanceKm: summary.distanceKm,
        drop,
        durationMin: summary.durationMin,
        pickup,
        profileId: userId,
        vehicleType,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Pricing engine is unavailable.";
      setMessage(
        `Could not calculate fare: ${message}. Apply the latest Supabase pricing migration and try again.`,
      );
      return;
    }
    setLiveFareEstimate(fareBreakdown);
    const fareEstimate = fareBreakdown.final_fare;
    const { data: createdRide, error } = await supabase
      .from("ride_requests")
      .insert({
        assigned_rider_id: null,
        distance_km: summary.distanceKm,
        drop_address: drop.address ?? "Selected destination",
        drop_lat: drop.lat,
        drop_lng: drop.lng,
        estimated_duration_min: summary.durationMin,
        fare_estimate: fareEstimate,
        fare_rate_per_km: null,
        vehicle_surcharge_per_km: 0,
        vehicle_type: vehicleType,
        service_area_id:
          fareBreakdown.service_area_id ?? serviceDecision.area?.id ?? null,
        pricing_rule_id: fareBreakdown.pricing_rule_id,
        fare_pricing_period: null,
        company_commission: fareBreakdown.platform_commission,
        rider_earning: fareBreakdown.driver_earning,
        booking_for: bookingFor,
        passenger_name: cleanPassengerName || null,
        passenger_phone: cleanPassengerPhone || null,
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
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (createdRide?.id) {
      await supabase.rpc("attach_ride_fare_breakdown", {
        p_breakdown: fareBreakdown,
        p_ride_id: createdRide.id,
      });
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
    if (!supabase || readyRideId === ride.id) {
      return;
    }
    setReadyRideId(ride.id);
    setMessage("Publishing your ready signal...");
    try {
      const { error } = await supabase.rpc("mark_ride_ready_and_assign", {
        p_ride_id: ride.id,
        p_signal_minutes: readySignalMinutes,
      });
      setMessage(
        error
          ? `Could not publish: ${error.message}`
          : "You are live. Nearby riders can accept this ride now.",
      );
      if (userId) {
        await loadRides(userId);
      }
    } finally {
      setReadyRideId(null);
    }
  }

  async function cancelRide(
    ride: RideRequest,
    reason: string,
  ): Promise<string | null> {
    if (!userId) {
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
    const recoveryMessage = isAuthOrPermissionError(error)
      ? "Could not cancel because your session or ride permission is out of sync. Refresh once or sign in again, then try cancel again."
      : error?.message;
    setMessage(
      error ? `Could not cancel: ${recoveryMessage}` : "Ride cancelled.",
    );
    if (!error) {
      setCancelTarget(null);
    }
    await loadRides(userId);
    return recoveryMessage ?? null;
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
    rides.find((ride) =>
      ["assigned", "started", "ready"].includes(ride.status),
    ) ?? rides.find((ride) => ride.status === "scheduled");
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
    ? riderLocations.find(
        (rider) => rider.rider_id === activeRide.assigned_rider_id,
      )
    : null;
  const mapRiders = useMemo(
    () =>
      assignedRiderLocation
        ? [assignedRiderLocation]
        : activeRide && ["assigned", "started"].includes(activeRide.status)
          ? []
          : nearbyRiders,
    [activeRide, assignedRiderLocation, nearbyRiders],
  );
  const assignedRiderProfile = activeRide?.assigned_rider_id
    ? (riderProfiles[activeRide.assigned_rider_id] ?? null)
    : null;
  const assignedRiderDetail = activeRide
    ? (assignedRiderDetails[activeRide.id] ?? null)
    : null;
  const AssignedVehicleIcon =
    assignedRiderDetail?.vehicle_type === "auto"
      ? CarTaxiFront
      : assignedRiderDetail?.vehicle_type &&
          ["car", "hatchback", "sedan", "suv"].includes(
            assignedRiderDetail.vehicle_type,
          )
        ? CarFront
        : Bike;
  const mapRiderVehicleTypes: Partial<Record<string, VehicleType>> = {
    ...Object.fromEntries(
      nearbyRiders.map((rider) => [
        rider.rider_id,
        rider.vehicle_type ?? vehicleType,
      ]),
    ),
    ...(activeRide?.assigned_rider_id && assignedRiderDetail
      ? { [activeRide.assigned_rider_id]: assignedRiderDetail.vehicle_type }
      : {}),
  };
  const assignedRiderPhotoUrl = activeRide
    ? (riderPhotoUrls[activeRide.id] ?? null)
    : null;
  const routeFrom = useMemo(() => {
    if (
      activeRide?.assigned_rider_id &&
      assignedRiderLocation &&
      ["assigned", "started"].includes(activeRide.status)
    ) {
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
  const userCancelledRideCount = rides.filter(
    (ride) =>
      ride.status === "cancelled" &&
      (!ride.cancelled_by || ride.cancelled_by === userId),
  ).length;
  const displayedFare = useMemo(() => {
    const departure = bookingMode === "advance" ? scheduledTime : undefined;
    const fallbackFare = getVehicleFareQuote(
      routeSummary?.distanceKm ?? null,
      departure,
      vehicleType,
    );
    if (liveFareEstimate) {
      return {
        ...fallbackFare,
        baseRatePerKm: routeSummary?.distanceKm
          ? liveFareEstimate.distance_charge / routeSummary.distanceKm
          : 0,
        fare: liveFareEstimate.final_fare,
        isPeak: liveFareEstimate.surge_multiplier > 1,
        periodLabel:
          liveFareEstimate.surge_multiplier > 1
            ? `${liveFareEstimate.surge_multiplier.toFixed(2)}x surge applied`
            : "Admin configured fare",
        ratePerKm: routeSummary?.distanceKm
          ? liveFareEstimate.distance_charge / routeSummary.distanceKm
          : 0,
        vehicleSurchargePerKm: 0,
      };
    }
    if (!pickup || !drop) return fallbackFare;
    const serviceDecision = findServiceAreaForTrip(
      serviceAreas,
      pickup,
      drop,
      vehicleType,
    );
    const configuredRule = serviceDecision.area
      ? findEffectivePricingRule(
          pricingRules,
          serviceDecision.area.id,
          vehicleType,
          departure ?? new Date(),
        )
      : null;
    if (!configuredRule) return fallbackFare;
    return {
      ...fallbackFare,
      baseRatePerKm: configuredRule.per_km_rate,
      fare: calculateConfiguredFare(
        routeSummary?.distanceKm ?? null,
        routeSummary?.durationMin ?? null,
        configuredRule,
      ),
      isPeak: false,
      periodLabel: "Admin configured fare",
      ratePerKm: configuredRule.per_km_rate,
      vehicleSurchargePerKm: 0,
    };
  }, [
    bookingMode,
    drop,
    liveFareEstimate,
    pickup,
    pricingRules,
    routeSummary,
    scheduledTime,
    serviceAreas,
    vehicleType,
  ]);
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

  useEffect(() => {
    let ignore = false;

    async function loadLiveFare() {
      if (activeRide || !pickup || !drop || !routeSummary?.distanceKm) {
        setLiveFareEstimate(null);
        return;
      }

      setFareLoading(true);
      try {
        const fare = await calculateTaxiroFareEstimate({
          at: bookingMode === "advance" ? scheduledTime : new Date(),
          distanceKm: routeSummary.distanceKm,
          drop,
          durationMin: routeSummary.durationMin,
          pickup,
          profileId: userId,
          vehicleType,
        });
        if (!ignore) setLiveFareEstimate(fare);
      } catch {
        if (!ignore) setLiveFareEstimate(null);
      } finally {
        if (!ignore) setFareLoading(false);
      }
    }

    void loadLiveFare();

    return () => {
      ignore = true;
    };
  }, [
    activeRide,
    bookingMode,
    drop,
    pickup,
    routeSummary?.distanceKm,
    routeSummary?.durationMin,
    scheduledTime,
    userId,
    vehicleType,
  ]);

  const triggerSafetyAlert = useCallback(
    async (alertType: SafetyAlertType, alertMessage: string) => {
      if (!activeRide || !["assigned", "started"].includes(activeRide.status)) {
        setMessage("Safety alerts are available after a rider is assigned.");
        return;
      }

      setSosBusy(alertType === "sos");
      const { alert, error } = await createSafetyAlert({
        alertType,
        location: safetyLocation,
        message: alertMessage,
        rideId: activeRide.id,
      });
      setSosBusy(false);
      if (error) {
        setMessage(error);
      } else if (alert?.delivery_status === "in_app") {
        setMessage("SOS delivered to your linked emergency contact in Taxiro.");
      } else if (alert?.delivery_status === "no_contact") {
        setMessage(
          "SOS saved, but no emergency contact is configured. Add one in Profile.",
        );
      } else {
        setMessage(
          "SOS saved, but this emergency phone is not linked to a Taxiro account. Use Call or SMS now.",
        );
      }
    },
    [activeRide, safetyLocation],
  );

  usePanicTrigger({
    enabled: Boolean(
      activeRide && ["assigned", "started"].includes(activeRide.status),
    ),
    onPanic: () =>
      void triggerSafetyAlert(
        "sos",
        "SOS triggered by triple volume-up while Taxiro was open.",
      ),
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
            <CardTitle>
              {profile ? "User account required" : "Sign in required"}
            </CardTitle>
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
      <div className="taxiro-immersive-stage taxiro-responsive-stage relative min-w-0 w-full max-w-full overflow-x-clip bg-muted [contain:inline-size]">
        <DynamicMapPicker
          className="taxiro-map-canvas overflow-hidden"
          drop={mapDrop}
          focusPoint={activeRide ? deviceLocation : pickup}
          onSelectionChange={setMapCandidate}
          pickup={mapPickup}
          riders={mapRiders}
          riderVehicleTypes={mapRiderVehicleTypes}
          route={routePath}
          selectionCenter={mapSelectionStart}
          selectionMode={mapPickMode}
        />

        {!mapPickMode ? (
          <div className="taxiro-overlay-bar pointer-events-none absolute inset-x-2 top-0 z-[1200] flex items-start justify-between gap-2 sm:inset-x-3 sm:gap-3 lg:inset-x-4">
            <div className="pointer-events-auto min-w-0 max-w-[calc(100%-10.5rem)] overflow-hidden rounded-xl border border-white/80 bg-white/94 px-2.5 py-2 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:max-w-xs sm:px-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                Taxiro
              </p>
              <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-black tracking-tight sm:text-base">
                <Bike className="size-3.5 shrink-0 sm:size-4" />
                {activeRide ? rideHeadline(activeRide.status) : "Where to?"}
              </p>
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              <AppNotificationBell profileId={profile?.id ?? null} />
              <ThemeToggle compact />
              <button
                aria-label={
                  activeRide
                    ? "Refresh current location"
                    : "Detect pickup location"
                }
                aria-busy={detectingPickup}
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:size-11"
                disabled={
                  detectingPickup || (!activeRide && bookingFor !== "self")
                }
                onClick={() => void detectPickupLocation()}
                title={
                  activeRide
                    ? "Refresh your current location"
                    : bookingFor === "self"
                      ? "Detect pickup location"
                      : "Choose Myself to use current location"
                }
                type="button"
              >
                <LocateFixed
                  className={`size-4 text-primary sm:size-5 ${detectingPickup ? "animate-pulse" : ""}`}
                />
              </button>
              <button
                aria-label="Open menu"
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur transition active:scale-95 sm:size-11"
                onClick={() => setMenuOpen(true)}
                type="button"
              >
                <Menu className="size-4 text-primary sm:size-5" />
              </button>
            </div>
          </div>
        ) : null}

        {!mapPickMode && activeRide && assignedRiderLocation ? (
          <div className="pointer-events-none absolute inset-x-2 top-[calc(max(0.5rem,env(safe-area-inset-top))+4.35rem)] z-[1190] flex justify-center sm:inset-x-3 sm:top-[4.75rem] lg:inset-x-4">
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/80 bg-[#101713]/94 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                <AssignedVehicleIcon className="size-4" />
              </span>
              <span className="min-w-0 truncate">
                {getVehicleLabel(
                  assignedRiderDetail?.vehicle_type ?? activeRide.vehicle_type,
                )}{" "}
                live
                <span className="mx-1.5 text-white/40">|</span>
                {activeRide.status === "assigned"
                  ? "Coming to pickup"
                  : "Heading to destination"}
                {routeSummary?.durationMin
                  ? ` - ${routeSummary.durationMin} min`
                  : ""}
              </span>
            </div>
          </div>
        ) : null}
        {!mapPickMode && !activeRide && pickup ? (
          <div className="pointer-events-none absolute left-2 top-[calc(max(0.5rem,env(safe-area-inset-top))+5.6rem)] z-[1190] sm:left-3 sm:top-[5.85rem] lg:left-4">
            <div className="flex max-w-[calc(100vw-1rem)] items-center gap-2 rounded-full border border-white/80 bg-[#101713]/92 px-3 py-2 text-[11px] font-black text-white shadow-lg backdrop-blur sm:text-xs">
              <Radio className="size-3.5 text-lime-300" />
              <span>
                {nearbyRiderPreviewUnavailable
                  ? "Nearby rider preview unavailable"
                  : nearbyRiders.length > 0
                    ? `${nearbyRiders.length} online ${getVehicleLabel(vehicleType).toLowerCase()} ${nearbyRiders.length === 1 ? "rider" : "riders"} near you`
                    : `No online ${getVehicleLabel(vehicleType).toLowerCase()} riders nearby right now`}
              </span>
            </div>
          </div>
        ) : null}

        {!mapPickMode ? (
          <ResponsiveRideSheet
            desktopSide="left"
            key={panelView}
            mobileLabel="booking and rides"
          >
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["book", "rides"] as const).map((view) => (
                <button
                  aria-pressed={panelView === view}
                  className={`min-w-0 rounded-md px-2.5 py-2 text-xs font-black transition ${panelView === view ? "bg-[#101713] text-white shadow-sm" : "text-muted-foreground"}`}
                  key={view}
                  onClick={() => setPanelView(view)}
                  type="button"
                >
                  <span className="block truncate">
                    {view === "book" ? "Book" : `My rides (${rides.length})`}
                  </span>
                </button>
              ))}
            </div>
            {panelView === "rides" ? (
              <div className="grid gap-3">
                <RideHistoryPanel
                  activeRides={activeRides}
                  onCancel={setCancelTarget}
                  completedRides={completedRides}
                  onReady={(ride) => void markReady(ride)}
                  upcomingRides={upcomingRides}
                />
              </div>
            ) : activeRide ? (
              <ActiveUserRide
                code={confirmationCodes[activeRide.id]}
                emergencyContactName={profile?.emergency_contact_name ?? null}
                emergencyContactPhone={profile?.emergency_contact_phone ?? null}
                onCancel={() => setCancelTarget(activeRide)}
                onReady={() => void markReady(activeRide)}
                onReadySignalMinutesChange={setReadySignalMinutes}
                readyBusy={readyRideId === activeRide.id}
                onSos={() =>
                  void triggerSafetyAlert(
                    "sos",
                    "SOS button pressed by the user during a Taxiro ride.",
                  )
                }
                readySignalMinutes={readySignalMinutes}
                riderDetails={assignedRiderDetail}
                riderLocation={assignedRiderLocation}
                riderPhotoUrl={assignedRiderPhotoUrl}
                riderProfile={assignedRiderProfile}
                routeSummary={routeSummary}
                ride={activeRide}
                sosBusy={sosBusy}
                userId={userId}
              />
            ) : (
              <div className="grid gap-3">
                {panelView === "book" ? (
                  <>
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                        Where are you going?
                      </h1>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {getVehicleLabel(vehicleType)} ride - verified matching
                      </p>
                    </div>
                    <div
                      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                      aria-label="Choose vehicle type"
                    >
                      {VEHICLE_OPTIONS.map((option) => {
                        const Icon =
                          option.type === "bike"
                            ? Bike
                            : option.type === "auto"
                              ? CarTaxiFront
                              : CarFront;
                        return (
                          <button
                            aria-pressed={vehicleType === option.type}
                            className={
                              vehicleType === option.type
                                ? "min-w-0 rounded-lg bg-primary p-3 text-primary-foreground"
                                : "min-w-0 rounded-lg bg-muted p-3"
                            }
                            key={option.type}
                            onClick={() => setVehicleType(option.type)}
                            type="button"
                          >
                            <Icon className="mx-auto size-5" />
                            <span className="mt-1 block truncate text-xs font-black">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] opacity-70">
                              {vehicleType === option.type && liveFareEstimate
                                ? formatMoney(liveFareEstimate.final_fare)
                                : option.description}
                            </span>
                          </button>
                        );
                      })}
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
                          <span className="block truncate">
                            {mode === "now" ? "Ride now" : "Advance booking"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <UserRound className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">Who is riding?</p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            Tell the rider who they should meet at pickup.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["self", "other"] as const).map((passengerType) => (
                          <button
                            className={
                              bookingFor === passengerType
                                ? "rounded-lg bg-primary px-3 py-3 text-sm font-black text-primary-foreground"
                                : "rounded-lg bg-muted px-3 py-3 text-sm font-black"
                            }
                            key={passengerType}
                            onClick={() => {
                              setBookingFor(passengerType);
                              if (passengerType === "other") {
                                setPickup(null);
                                setPickupAccuracy(null);
                                setMessage(
                                  "Choose the passenger's pickup using search or the map.",
                                );
                              }
                            }}
                            type="button"
                          >
                            {passengerType === "self"
                              ? "Myself"
                              : "Someone else"}
                          </button>
                        ))}
                      </div>
                      {!bookingFor ? (
                        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Select one option before choosing pickup.
                        </p>
                      ) : null}
                      {bookingFor === "self" ? (
                        <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-xs font-semibold">
                          Passenger:{" "}
                          {profile?.full_name || "Your Taxiro profile"}
                          {profile?.phone ? ` - ${profile.phone}` : ""}
                        </p>
                      ) : null}
                      {bookingFor === "other" ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="passenger-name">
                              Passenger name
                            </Label>
                            <Input
                              autoComplete="name"
                              id="passenger-name"
                              maxLength={80}
                              onChange={(event) =>
                                setPassengerName(event.target.value)
                              }
                              placeholder="Who will ride?"
                              value={passengerName}
                            />
                          </div>
                          <div>
                            <Label htmlFor="passenger-phone">
                              Passenger phone
                            </Label>
                            <Input
                              autoComplete="tel"
                              id="passenger-phone"
                              inputMode="tel"
                              maxLength={16}
                              onChange={(event) =>
                                setPassengerPhone(event.target.value)
                              }
                              placeholder="Mobile number"
                              value={passengerPhone}
                            />
                          </div>
                          <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                            Current-location detection is off for this booking.
                            Search or pin the passenger&apos;s actual pickup.
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-3">
                      <div className="min-w-0 rounded-lg border border-border bg-card p-3">
                        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                            From
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {bookingFor !== "other" ? (
                              <Button
                                className="h-8 min-w-0 rounded-lg px-3 text-xs"
                                disabled={
                                  detectingPickup || bookingFor !== "self"
                                }
                                onClick={detectPickupLocation}
                                size="sm"
                                variant="outline"
                              >
                                {detectingPickup ? "Detecting..." : "Detect me"}
                              </Button>
                            ) : (
                              <span className="rounded-lg bg-muted px-2 py-1.5 text-[10px] font-bold text-muted-foreground">
                                Passenger pickup
                              </span>
                            )}
                            <Button
                              className="h-8 min-w-0 rounded-lg px-3 text-xs"
                              onClick={() => startMapPick("pickup")}
                              size="sm"
                              variant={
                                mapPickMode === "pickup"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              <span className="sm:hidden">Map</span>
                              <span className="hidden sm:inline">
                                Choose on map
                              </span>
                            </Button>
                          </div>
                        </div>
                        {pickupAccuracy ? (
                          <p
                            className={`mb-2 text-xs font-semibold ${!detectingPickup && pickupAccuracy > MAX_USABLE_LOCATION_ACCURACY_M ? "text-amber-700" : "text-muted-foreground"}`}
                          >
                            {detectingPickup
                              ? `Improving GPS accuracy... +/-${pickupAccuracy}m`
                              : `${pickupAccuracy > MAX_USABLE_LOCATION_ACCURACY_M ? "Low GPS accuracy" : "GPS accuracy"} +/-${pickupAccuracy}m`}
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
                            variant={
                              mapPickMode === "drop" ? "default" : "secondary"
                            }
                          >
                            <span className="sm:hidden">Map</span>
                            <span className="hidden sm:inline">
                              Choose on map
                            </span>
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
                        Tap the map to set{" "}
                        {mapPickMode === "pickup"
                          ? "From / pickup"
                          : "To / drop"}
                        .
                      </div>
                    ) : null}
                    {bookingMode === "advance" ? (
                      <div className="grid gap-3 rounded-lg bg-muted p-3">
                        <div>
                          <Label htmlFor="scheduled">
                            Advance pickup date and time
                          </Label>
                          <Input
                            className="mt-1 h-12 bg-card"
                            id="scheduled"
                            min={toDateTimeLocalInput(new Date())}
                            onChange={(event) =>
                              setScheduledTime(event.target.value)
                            }
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
                        Book now, then tap I&apos;m Ready when you are at the
                        pickup point.
                      </p>
                    )}
                    <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
                        <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                          <p className="text-xs text-muted-foreground">Fare</p>
                          <p className="mt-1 font-black">
                            {formatMoney(displayedFare.fare)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                          <p className="text-xs text-muted-foreground">
                            Distance
                          </p>
                          <p className="mt-1 font-black">
                            {routeSummary?.distanceKm ?? "--"} km
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
                          <p className="text-xs text-muted-foreground">ETA</p>
                          <p className="mt-1 font-black">
                            {routeSummary?.durationMin ?? "--"} min
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-secondary/70 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-black">
                            {displayedFare.periodLabel}
                          </span>
                          <span className="font-semibold">
                            Rs {formatRate(displayedFare.ratePerKm)}/km{" "}
                            {getVehicleLabel(vehicleType)}
                            {displayedFare.isPeak ? " peak" : ""}
                          </span>
                        </div>
                        <p className="mt-1 leading-5 text-muted-foreground">
                          Peak: 9:00-10:30 AM, 5:00-6:00 PM, and 10:00
                          PM-midnight.
                        </p>
                      </div>
                      {fareLoading ? (
                        <p className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
                          Calculating live fare from Taxiro pricing engine...
                        </p>
                      ) : null}
                      {operationalConfigUnavailable ? (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                          Configured service-area pricing is not available yet.
                          Taxiro is using safe fallback per-km pricing for this
                          booking.
                        </p>
                      ) : null}
                      <div>
                        <Label>Payment preference</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {(["cash", "upi", "wallet"] as const).map(
                            (method) => (
                              <button
                                className={
                                  paymentMethod === method
                                    ? "rounded-lg bg-primary px-3 py-3 text-sm font-black text-primary-foreground"
                                    : "rounded-lg bg-muted px-3 py-3 text-sm font-black"
                                }
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                type="button"
                              >
                                {method === "cash"
                                  ? "Cash"
                                  : method === "wallet"
                                    ? "Taxiro wallet"
                                    : "UPI after ride"}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                      <button
                        className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-left text-sm font-bold"
                        onClick={() =>
                          setShowRideOptions((current) => !current)
                        }
                        type="button"
                      >
                        <span>
                          {rideNote ? "Pickup note added" : "Add pickup note"}
                        </span>
                        <ChevronDown
                          className={`size-4 transition ${showRideOptions ? "rotate-180" : ""}`}
                        />
                      </button>
                      {showRideOptions ? (
                        <div className="animate-in">
                          <Label htmlFor="rider-note">Note for rider</Label>
                          <Input
                            className="mt-1"
                            id="rider-note"
                            maxLength={180}
                            onChange={(event) =>
                              setRideNote(event.target.value)
                            }
                            placeholder="Gate, landmark, or pickup instruction"
                            value={rideNote}
                          />
                        </div>
                      ) : null}
                    </div>
                    <Button
                      className="sticky bottom-2 z-10 h-14 rounded-lg text-base font-bold shadow-[0_12px_32px_rgb(16_23_19_/_0.24)]"
                      onClick={() => void createRide()}
                    >
                      {bookingMode === "now"
                        ? "Book ride now"
                        : "Schedule advance ride"}
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
            {message ? (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {message}
              </p>
            ) : null}
          </ResponsiveRideSheet>
        ) : null}
        {activeRide ? (
          <div className="absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[1210] hidden w-[28rem] -translate-x-1/2 grid-cols-3 gap-1.5 xl:grid">
            <FloatingStat label="Status" value={activeRide.status} />
            <FloatingStat
              label="ETA"
              value={`${activeRide.estimated_duration_min ?? "--"}m`}
            />
            <FloatingStat
              label="KM"
              value={`${activeRide.distance_km ?? "--"}`}
            />
          </div>
        ) : null}
        {mapPickMode ? (
          <div className="absolute inset-x-2 top-3 z-[1300] rounded-lg bg-[#101713] px-4 py-3 text-center text-sm font-black text-white shadow-[var(--shadow-soft)] sm:left-1/2 sm:right-auto sm:w-[24rem] sm:max-w-[calc(100%-0.75rem)] sm:-translate-x-1/2">
            Move the map under the pin to set{" "}
            {mapPickMode === "pickup" ? "your pickup" : "your drop"}.
          </div>
        ) : null}
        {mapPickMode ? (
          <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[1300] mx-auto max-w-sm rounded-lg border border-white/70 bg-white/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <p className="text-sm font-black">
              Is the pin exactly where you need it?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Zoom and move the map for a precise entrance or pickup point.
            </p>
            <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-2">
              <Button
                onClick={() => {
                  setMapPickMode(null);
                  setMapCandidate(null);
                  setMapSelectionStart(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!mapCandidate}
                onClick={() => void confirmMapPick()}
              >
                Confirm {mapPickMode === "pickup" ? "pickup" : "drop"}
              </Button>
            </div>
          </div>
        ) : null}
        {cancelTarget ? (
          <CancelRideDialog
            onClose={() => setCancelTarget(null)}
            onConfirm={(reason) => cancelRide(cancelTarget, reason)}
            penaltyAmount={getUserCancellationFine(
              userCancelledRideCount,
              Boolean(cancelTarget.assigned_rider_id),
            )}
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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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

function isMissingSupabaseObject(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    text.includes("404") ||
    text.includes("not found") ||
    text.includes("schema cache") ||
    text.includes("could not find")
  );
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "--";
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.00$/, "");
}
function toDateTimeLocalInput(date: Date) {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localTime.toISOString().slice(0, 16);
}

function offsetDateTime(minutes: number) {
  return toDateTimeLocalInput(new Date(Date.now() + minutes * 60 * 1000));
}

function tomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toDateTimeLocalInput(date);
}

function TimePreset({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
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
    <div className="grid max-h-[calc(72dvh-4rem)] gap-2.5 overflow-y-auto overflow-x-hidden pr-1 lg:max-h-[calc(100dvh-9rem)]">
      <div>
        <h1 className="text-lg font-black tracking-tight">My rides</h1>
        <p className="text-xs leading-5 text-muted-foreground">
          Active, advance, and completed trips in one place.
        </p>
      </div>
      <RideSection
        actionForRide={(ride) =>
          ["scheduled", "ready", "assigned"].includes(ride.status) ? (
            <Button
              className="h-8 px-2.5 text-xs"
              onClick={() => onCancel(ride)}
              size="sm"
              variant="destructive"
            >
              Cancel
            </Button>
          ) : null
        }
        defaultOpen
        emptyText="No active rides right now."
        rides={activeRides}
        title="Active rides"
      />
      <RideSection
        actionForRide={(ride) =>
          ride.status === "scheduled" ? (
            <Button
              className="h-8 px-2.5 text-xs"
              onClick={() => onReady(ride)}
              size="sm"
            >
              I&apos;m Ready
            </Button>
          ) : null
        }
        secondaryActionForRide={(ride) =>
          ride.status === "scheduled" ? (
            <Button
              className="h-8 px-2.5 text-xs"
              onClick={() => onCancel(ride)}
              size="sm"
              variant="destructive"
            >
              Cancel
            </Button>
          ) : null
        }
        defaultOpen
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
  defaultOpen = false,
  emptyText,
  rides,
  secondaryActionForRide,
  title,
}: {
  actionForRide?: (ride: RideRequest) => ReactNode;
  defaultOpen?: boolean;
  emptyText: string;
  rides: RideRequest[];
  secondaryActionForRide?: (ride: RideRequest) => ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group rounded-lg border border-border bg-muted/60 p-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-2">
        <h2 className="text-sm font-black tracking-tight">{title}</h2>
        <span className="ml-auto rounded-md bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground">
          {rides.length}
        </span>
        <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 max-h-[24rem] overflow-y-auto overscroll-contain pr-1">
        {rides.length ? (
          <div className="grid min-w-0 gap-2.5">
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
    </details>
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
  return (
    ride.status === "ready" &&
    Boolean(ride.ready_expires_at) &&
    new Date(ride.ready_expires_at as string).getTime() <= Date.now()
  );
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
  emergencyContactName,
  emergencyContactPhone,
  onCancel,
  onReady,
  onReadySignalMinutesChange,
  onSos,
  readySignalMinutes,
  readyBusy,
  riderDetails,
  riderLocation,
  riderPhotoUrl,
  riderProfile,
  routeSummary,
  ride,
  sosBusy,
  userId,
}: {
  code?: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  onCancel: () => void;
  onReady: () => void;
  onReadySignalMinutesChange: (minutes: 15 | 30 | 60) => void;
  onSos: () => void;
  readySignalMinutes: 15 | 30 | 60;
  readyBusy: boolean;
  riderDetails?: AssignedRiderDetails | null;
  riderLocation?: RiderLocation | null;
  riderPhotoUrl?: string | null;
  riderProfile?: RiderProfile | null;
  routeSummary: {
    distanceKm: number | null;
    durationMin: number | null;
  } | null;
  ride: RideRequest;
  sosBusy: boolean;
  userId: string | null;
}) {
  const hasLivePhase = ["assigned", "started"].includes(ride.status);
  const trackingTitle =
    ride.status === "assigned"
      ? "Rider is coming to pickup"
      : "Tracking trip to destination";
  const trackingText =
    ride.status === "assigned"
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
          <Badge className="bg-primary text-primary-foreground">
            {ride.status}
          </Badge>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {rideHeadline(ride.status)}
          </h1>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {ride.pickup_address} to {ride.drop_address}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {canPublishReady ? (
            <Button
              className="rounded-lg"
              disabled={readyBusy}
              onClick={onReady}
            >
              {readyBusy
                ? "Publishing..."
                : readyExpired
                  ? "Publish again - " + readySignalMinutes + " min"
                  : "I'm Ready - " + readySignalMinutes + " min"}
            </Button>
          ) : null}
          {["scheduled", "ready", "assigned"].includes(ride.status) ? (
            <Button
              className="rounded-lg"
              onClick={onCancel}
              variant="destructive"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {hasLivePhase ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {riderDetails ? (
            <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-3">
              <div className="relative size-16 overflow-hidden rounded-lg bg-secondary">
                {riderPhotoUrl ? (
                  <Image
                    alt={
                      (riderDetails.full_name ?? "Assigned rider") + " profile"
                    }
                    className="object-cover"
                    fill
                    sizes="64px"
                    src={riderPhotoUrl}
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-2xl font-black">
                    {(riderDetails.full_name ?? "R").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">
                      {riderDetails.full_name ?? "Taxiro rider"}
                    </p>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                        <Star className="size-3 fill-current" />
                        {riderDetails.rating && Number(riderDetails.rating) > 0
                          ? Number(riderDetails.rating).toFixed(1) + " rating"
                          : "New rider"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {riderDetails.completed_rides ?? 0} completed rides
                      </span>
                    </div>
                  </div>
                  <Badge className="shrink-0 bg-secondary text-secondary-foreground">
                    {getVehicleLabel(riderDetails.vehicle_type)}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-sm font-semibold leading-5">
                  {riderDetails.vehicle_make} {riderDetails.vehicle_model}
                </p>
                <p className="mt-1 inline-flex max-w-full break-all rounded-md bg-[#101713] px-2.5 py-1 text-sm font-black tracking-[0.12em] text-white">
                  {riderDetails.registration_number}
                </p>
              </div>
              {riderDetails.phone ? (
                <a
                  className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-muted text-sm font-black"
                  href={"tel:" + riderDetails.phone}
                >
                  <Phone className="size-4" /> Call rider
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading your assigned rider and vehicle details...
            </p>
          )}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-secondary/60 p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Passenger
          </p>
          <p className="truncate font-black">
            {ride.passenger_name ||
              (ride.booking_for === "other" ? "Guest passenger" : "You")}
          </p>
          <p className="text-xs text-muted-foreground">
            {ride.booking_for === "other"
              ? "Ride booked for someone else"
              : "Ride booked for yourself"}
          </p>
        </div>
        {ride.passenger_phone ? (
          <span className="max-w-[10rem] shrink-0 truncate rounded-lg bg-card px-3 py-2 text-xs font-bold">
            {ride.passenger_phone}
          </span>
        ) : null}
      </div>
      {ride.status === "started" ? (
        <div className="rounded-lg bg-[#101713] p-4 text-white">
          <p className="text-sm font-semibold text-white/60">Trip live</p>
          <p className="mt-1 text-xl font-black">You are on your way</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            The ride can be completed from the rider app after reaching the drop
            point.
          </p>
        </div>
      ) : null}
      {ride.status === "scheduled" || ride.status === "ready" ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">Ready signal duration</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Choose how long nearby riders can see this request after you
                publish it.
              </p>
            </div>
            <Badge className="shrink-0 bg-secondary text-secondary-foreground">
              {ride.status === "ready"
                ? readyExpired
                  ? "Expired"
                  : readyTimeLeft
                : `${readySignalMinutes} min`}
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
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {trackingText}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-black text-secondary-foreground">
              {ride.status === "assigned" ? "Pickup" : "Drop"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Live ETA
              </p>
              <p className="mt-1 text-lg font-black">
                {liveEta ? `${liveEta} min` : "--"}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted p-2 sm:p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Route
              </p>
              <p className="mt-1 text-lg font-black">
                {liveDistance ? `${liveDistance} km` : "--"}
              </p>
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
              This is the customer fare saved when the ride was booked. Rider
              earning and Taxiro share are shown only in the rider/admin views.
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-black uppercase text-secondary-foreground">
            {ride.payment_status ?? "pending"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="min-w-0 rounded-lg bg-muted p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Fare
            </p>
            <p className="mt-1 font-black">{formatMoney(ride.fare_estimate)}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-muted p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Pay by
            </p>
            <p className="mt-1 font-black uppercase">
              {ride.payment_method ?? "cash"}
            </p>
          </div>
        </div>
        {ride.fare_rate_per_km ? (
          <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-xs font-semibold">
            {getVehicleLabel(ride.vehicle_type)}{" "}
            {ride.fare_pricing_period === "standard"
              ? "standard fare"
              : "peak fare"}
            : Rs{" "}
            {(ride.fare_rate_per_km ?? 0) +
              (ride.vehicle_surcharge_per_km ?? 0)}
            /km
          </p>
        ) : null}
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
            {ride.payment_method === "upi" ||
            ride.payment_method === "driver_direct_upi" ? (
              <div className="mt-2 grid gap-2">
                <p className="rounded-xl bg-card p-3 text-sm font-semibold">
                  Ask the rider to show their Taxiro UPI QR, then scan it with
                  your payment app and pay {formatMoney(ride.fare_estimate)}.
                </p>
                {riderProfile?.upi_id ? (
                  <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground">
                    UPI ID fallback: {riderProfile.upi_id}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-card p-3 text-sm font-semibold">
                Cash selected. Pay {formatMoney(ride.fare_estimate)} directly to
                the rider.
              </p>
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
          <p className="mt-1 font-semibold">
            {ride.estimated_duration_min ?? "--"} min
          </p>
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
          <p className="text-sm font-semibold">
            Show this code only to your rider
          </p>
          <div className="mt-2 grid gap-3 sm:flex sm:items-end sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Required before the ride starts.
            </p>
            <span className="font-mono text-3xl font-semibold tracking-[0.28em] text-primary sm:tracking-[0.35em]">
              {code ?? "Loading..."}
            </span>
          </div>
        </div>
      ) : ride.status === "started" ? (
        <div className="rounded-lg border border-primary/20 bg-secondary p-4">
          <p className="text-sm font-black">Code verified</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The rider entered the private code. Destination tracking is now
            active.
          </p>
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
                Use SOS if you feel unsafe. Taxiro saves your current ride
                location and notifies your emergency contact in-app if that
                phone number has a Taxiro account.
              </p>
            </div>
          </div>
          <Button
            className="mt-3 h-12 w-full rounded-lg"
            disabled={sosBusy}
            onClick={onSos}
            variant="destructive"
          >
            {sosBusy ? "Sending SOS..." : "SOS - notify emergency contact"}
          </Button>
          {emergencyContactPhone ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                className="flex h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-xs font-black text-red-800"
                href={"tel:" + emergencyContactPhone}
              >
                <Phone className="size-3.5" /> Call{" "}
                {emergencyContactName || "contact"}
              </a>
              <a
                className="flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-2 text-center text-xs font-black text-red-800"
                href={
                  "sms:" +
                  emergencyContactPhone +
                  "?body=" +
                  encodeURIComponent(
                    "Taxiro SOS: I may need help. Please open Taxiro to view my ride alert.",
                  )
                }
              >
                Prepare SOS SMS
              </a>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            Triple volume-up is best-effort only in browsers. Keep the visible
            SOS button as the reliable safety action.
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
  const swipeStartX = useRef<number | null>(null);

  return (
    <div className="fixed inset-0 z-[1500] bg-[#101713]/48 backdrop-blur-sm">
      <button
        aria-label="Close menu"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <aside
        className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] grid touch-pan-y gap-3 overflow-y-auto overflow-x-clip rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-soft)] sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[27rem] sm:max-w-[calc(100%-1.5rem)] sm:gap-4 sm:rounded-xl"
        onPointerDown={(event) => {
          swipeStartX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (
            swipeStartX.current !== null &&
            event.clientX - swipeStartX.current > 72
          )
            onClose();
          swipeStartX.current = null;
        }}
      >
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

        <details className="group rounded-lg border border-border bg-muted">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1 font-black">
              Profile and account
            </span>
            <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mx-3 mb-3 max-h-[min(62dvh,30rem)] overflow-y-auto overscroll-contain rounded-lg bg-white p-2">
            <ProfileSettings onSaved={onProfileSaved} profile={profile} />
          </div>
        </details>

        <button className="text-left" onClick={onOpenRides} type="button">
          <MenuCard
            icon={ListChecks}
            title="My rides"
            text={`${ridesCount} total rides, ${upcomingCount} upcoming, ${completedCount} completed/cancelled. Tap to open ride history and cancellation options.`}
          />
        </button>
        <details className="group rounded-lg border border-border bg-muted">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card">
              <Settings className="size-4" />
            </span>
            <span className="min-w-0 flex-1 font-black">App settings</span>
            <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mx-3 mb-3 grid gap-2 rounded-lg bg-white p-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Location:</strong> use Detect
              on the booking screen. If blocked, enable Location in browser site
              settings.
            </p>
            <p>
              <strong className="text-foreground">Notifications:</strong> open
              the bell on the home map for ride and SOS updates.
            </p>
            <p>
              <strong className="text-foreground">Ride history:</strong> tap My
              rides, then expand the section you need.
            </p>
          </div>
        </details>
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
    <Link
      className="block rounded-lg border border-border bg-muted p-4 transition hover:border-primary/20 hover:bg-secondary"
      href={href}
    >
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
  return items.map((item) =>
    item.rider_id === incoming.rider_id ? incoming : item,
  );
}

function sortRides(items: RideRequest[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
function formatTrackingAge(value: string) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 10) return "live now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}
