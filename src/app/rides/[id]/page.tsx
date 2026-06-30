"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  CalendarClock,
  Clock3,
  IndianRupee,
  MapPin,
  Navigation,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { RideChatPanel } from "@/components/RideChatPanel";
import { RideCard } from "@/components/RideCard";
import { RideProgress } from "@/components/RideProgress";
import { RideRatingForm } from "@/components/RideRatingForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateFareBreakdown,
  formatMoney,
  getFarePricingLabel,
} from "@/lib/fare";
import { getRoutePath } from "@/lib/maps";
import { getSupabase } from "@/lib/supabase";
import type { LatLng, RideRequest, RiderProfile } from "@/types/database";

export default function RideDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ride, setRide] = useState<RideRequest | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const loadRide = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const { data, error } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setMessage(error.message);
      setRide(null);
      return;
    }

    setMessage("");
    setRide((data as RideRequest | null) ?? null);
  }, []);

  useEffect(() => {
    let ignore = false;

    void params.then(({ id }) => {
      if (ignore) return;
      setRideId(id);
      void loadRide(id);
    });

    return () => {
      ignore = true;
    };
  }, [loadRide, params]);

  useEffect(() => {
    if (!rideId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`ride-detail-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRide(null);
            setMessage("This ride is no longer available.");
            return;
          }
          setMessage("");
          setRide(payload.new as RideRequest);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage(
            "Ride live updates are reconnecting. This page will refresh when Supabase reconnects.",
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rideId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let ignore = false;
    void getCurrentUser(supabase).then((user) => {
      if (!ignore) setUserId(user?.id ?? null);
    });

    if (!ride?.assigned_rider_id) {
      queueMicrotask(() => {
        if (!ignore) setRiderProfile(null);
      });
      return () => {
        ignore = true;
      };
    }

    void supabase
      .from("rider_profiles")
      .select("*")
      .eq("rider_id", ride.assigned_rider_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore) setRiderProfile((data as RiderProfile | null) ?? null);
      });
    return () => {
      ignore = true;
    };
  }, [ride?.assigned_rider_id]);

  useEffect(() => {
    let ignore = false;

    async function loadCode() {
      const supabase = getSupabase();
      if (
        !supabase ||
        !ride ||
        userId !== ride.user_id ||
        !["assigned", "started"].includes(ride.status)
      ) {
        setConfirmationCode(null);
        return;
      }

      const { data } = await supabase.rpc(
        "get_or_create_ride_confirmation_code",
        {
          p_ride_id: ride.id,
        },
      );
      if (!ignore && typeof data === "string") {
        setConfirmationCode(data);
      }
    }

    void loadCode();

    return () => {
      ignore = true;
    };
  }, [ride, userId]);
  useEffect(() => {
    let ignore = false;

    async function loadRoute() {
      if (!ride) {
        setRoutePath([]);
        return;
      }
      const path = await getRoutePath(
        { lat: ride.pickup_lat, lng: ride.pickup_lng },
        { lat: ride.drop_lat, lng: ride.drop_lng },
      );
      if (!ignore) {
        setRoutePath(path);
      }
    }

    void loadRoute();

    return () => {
      ignore = true;
    };
  }, [ride]);

  const isCustomer = Boolean(ride && userId === ride.user_id);
  const isAssignedRider = Boolean(ride && userId === ride.assigned_rider_id);
  const fareBreakdown = ride
    ? calculateFareBreakdown(ride.fare_estimate)
    : null;
  const companyCommission =
    ride?.company_commission ?? fareBreakdown?.companyCommission ?? null;
  const riderEarning =
    ride?.rider_earning ?? fareBreakdown?.riderEarning ?? null;
  const passengerName =
    ride?.passenger_name ||
    (ride?.booking_for === "other" ? "Guest passenger" : "Self ride");
  const passengerContext =
    ride?.booking_for === "other"
      ? "Booked for someone else"
      : "Customer is riding";
  const passengerContact = ride?.passenger_phone
    ? ` | ${ride.passenger_phone}`
    : "";
  const fareRateLabel = ride?.fare_rate_per_km
    ? `${getFarePricingLabel(ride.fare_pricing_period)}: Rs ${ride.fare_rate_per_km}/km`
    : "Rate not locked";

  return (
    <AppShell title="Ride details">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/user">
            <ArrowLeft className="size-4" />
            Back to app
          </Link>
        </Button>
      </div>

      {ride ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(28rem,1.08fr)] lg:items-start">
          <div className="grid min-w-0 gap-4">
            <RideCard ride={ride} />
            <Card className="grid gap-4">
              <RideProgress ride={ride} />
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <DetailLine
                  icon={UserRound}
                  label="Passenger"
                  value={`${passengerName} | ${passengerContext}${passengerContact}`}
                />
                <DetailLine
                  icon={MapPin}
                  label="Pickup"
                  value={ride.pickup_address}
                />
                <DetailLine
                  icon={Navigation}
                  label="Drop"
                  value={ride.drop_address}
                />
                <DetailLine
                  icon={CalendarClock}
                  label="Scheduled"
                  value={new Date(ride.scheduled_time).toLocaleString()}
                />
                <DetailLine
                  icon={Clock3}
                  label="ETA / distance"
                  value={`${ride.estimated_duration_min ?? "--"} min | ${ride.distance_km ?? "--"} km`}
                />
                <DetailLine
                  icon={IndianRupee}
                  label="Fare and payment"
                  value={`${formatMoney(ride.fare_estimate)} | ${fareRateLabel} | ${(ride.payment_method ?? "cash").toUpperCase()} | ${ride.payment_status ?? "pending"}`}
                />
              </div>
            </Card>
            <Card>
              <p className="font-black">Customer payment</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Locked fare, payment method, and live payment state for this
                ride. The rider split is shown to the assigned rider.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Fare</p>
                  <p className="font-black">
                    {formatMoney(ride.fare_estimate)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-black">{fareRateLabel}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="font-black uppercase">
                    {ride.payment_method ?? "cash"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="truncate font-black capitalize">
                    {ride.payment_status ?? "pending"}
                  </p>
                </div>
              </div>
              {isAssignedRider ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-secondary p-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Taxiro share
                    </p>
                    <p className="font-black">
                      {formatMoney(companyCommission)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary p-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Your earning
                    </p>
                    <p className="font-black">{formatMoney(riderEarning)}</p>
                  </div>
                </div>
              ) : null}
              {isCustomer && ride.payment_status === "awaiting_payment" ? (
                <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm font-semibold">
                  Pay the rider now. For UPI, ask the rider to show their QR.
                  The ride completes after they confirm payment.
                </p>
              ) : null}
            </Card>
            {userId === ride.user_id &&
            ["assigned", "started"].includes(ride.status) ? (
              <Card className="border-primary/20 bg-secondary">
                <p className="text-sm font-semibold">Private ride code</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Show this only to your assigned rider before the ride starts.
                </p>
                <p className="mt-3 font-mono text-4xl font-black tracking-[0.35em] text-primary">
                  {confirmationCode ?? "Loading..."}
                </p>
              </Card>
            ) : null}
            {["assigned", "started"].includes(ride.status) ? (
              <RideChatPanel currentUserId={userId} ride={ride} />
            ) : null}
            {riderProfile ? (
              <Card>
                <p className="flex items-center gap-2 font-black">
                  <Bike className="size-4" />
                  Assigned vehicle
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <DetailLine
                    icon={Bike}
                    label="Vehicle"
                    value={(
                      (riderProfile.vehicle_make ?? "") +
                      " " +
                      (riderProfile.vehicle_model ?? "Bike")
                    ).trim()}
                  />
                  <DetailLine
                    icon={ShieldCheck}
                    label="Registration"
                    value={
                      riderProfile.vehicle_number ?? "Pending rider update"
                    }
                  />
                </div>
                {isAssignedRider &&
                ride.payment_method === "upi" &&
                ride.payment_status === "awaiting_payment" ? (
                  <div className="mt-3 rounded-2xl bg-muted p-3">
                    <p className="text-sm font-black">
                      Show your UPI QR to the customer
                    </p>
                    {riderProfile.upi_id ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        UPI ID: {riderProfile.upi_id}
                      </p>
                    ) : null}
                    {riderProfile.upi_qr_image_url ? (
                      <Image
                        alt="Rider UPI QR code"
                        className="mt-3 max-h-56 rounded-xl border border-border bg-white object-contain p-2"
                        height={512}
                        src={riderProfile.upi_qr_image_url}
                        unoptimized
                        width={512}
                      />
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Rider has not uploaded a UPI QR image.
                      </p>
                    )}
                  </div>
                ) : null}
                <p className="mt-3 text-xs font-semibold capitalize text-muted-foreground">
                  Verification: {riderProfile.verification_status} | Rating:{" "}
                  {riderProfile.rating}/5
                </p>
              </Card>
            ) : null}
            {ride.status === "completed" &&
            userId === ride.user_id &&
            ride.assigned_rider_id ? (
              <RideRatingForm
                reviewerId={userId}
                revieweeId={ride.assigned_rider_id}
                rideId={ride.id}
              />
            ) : null}
          </div>
          <DynamicMapPicker
            className="h-[42svh] min-h-[18rem] overflow-hidden rounded-xl border border-border shadow-[var(--shadow-soft)] lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)] lg:min-h-[36rem]"
            drop={{
              address: ride.drop_address,
              lat: ride.drop_lat,
              lng: ride.drop_lng,
            }}
            pickup={{
              address: ride.pickup_address,
              lat: ride.pickup_lat,
              lng: ride.pickup_lng,
            }}
            route={routePath}
          />
        </div>
      ) : (
        <Card className="text-sm text-muted-foreground">
          {message || "Ride not found."}
        </Card>
      )}
    </AppShell>
  );
}

function DetailLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="line-clamp-3 break-words font-medium">{value}</p>
    </div>
  );
}
