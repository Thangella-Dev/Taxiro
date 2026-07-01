"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bike,
  Camera,
  CalendarClock,
  IndianRupee,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { AdminSafetyCenter } from "@/components/AdminSafetyCenter";
import { AdminStatsCard } from "@/components/AdminStatsCard";
import { AppShell } from "@/components/AppShell";
import { DemandZoneCard } from "@/components/DemandZoneCard";
import { RideCard } from "@/components/RideCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getSupabase } from "@/lib/supabase";
import { useLiveResync } from "@/lib/useLiveResync";
import type {
  Profile,
  RideRequest,
  RiderLocation,
  RiderProfile,
  RiderVehicle,
} from "@/types/database";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<RiderProfile[]>([]);
  const [riderSelfieUrls, setRiderSelfieUrls] = useState<Record<string, string>>({});
  const [riderVehicles, setRiderVehicles] = useState<RiderVehicle[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | RideRequest["status"]
  >("all");

  const loadAdminData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const [profileResult, riderResult, riderProfileResult, riderVehicleResult, rideResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("rider_locations").select("*"),
        supabase
          .from("rider_profiles")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("rider_vehicles")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("ride_requests")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

    if (
      profileResult.error ||
      riderResult.error ||
      riderProfileResult.error ||
      riderVehicleResult.error ||
      rideResult.error
    ) {
      setMessage(
        profileResult.error?.message ??
          riderResult.error?.message ??
          riderProfileResult.error?.message ??
          riderVehicleResult.error?.message ??
          rideResult.error?.message ??
          "Could not load admin data.",
      );
      return;
    }

    setProfiles((profileResult.data as Profile[]) ?? []);
    setRiderLocations((riderResult.data as RiderLocation[]) ?? []);
    const loadedRiderProfiles = (riderProfileResult.data as RiderProfile[]) ?? [];
    setRiderProfiles(loadedRiderProfiles);
    setRiderVehicles((riderVehicleResult.data as RiderVehicle[]) ?? []);
    const signedSelfies = await Promise.all(
      loadedRiderProfiles.filter((item) => item.live_selfie_path).map(async (item) => {
        const { data } = await supabase.storage.from("rider-verification").createSignedUrl(item.live_selfie_path as string, 600);
        return [item.rider_id, data?.signedUrl ?? ""] as const;
      }),
    );
    setRiderSelfieUrls(Object.fromEntries(signedSelfies));
    setRides((rideResult.data as RideRequest[]) ?? []);
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

    let isAdmin = false;
    void getCurrentUser(supabase).then(async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      const currentProfile = await getProfile(supabase, user.id);
      setProfile(currentProfile);
      isAdmin = currentProfile?.role === "admin";
      if (isAdmin) {
        await loadAdminData();
      } else {
        setMessage(
          "Your profile is not an admin. Update role in Supabase to access this dashboard.",
        );
      }
      setLoading(false);
    });

    const channel = supabase
      .channel("admin-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (!isAdmin) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<Profile>;
            if (deleted.id)
              setProfiles((current) =>
                current.filter((item) => item.id !== deleted.id),
              );
            return;
          }
          setProfiles((current) =>
            sortByCreated(upsertById(current, payload.new as Profile)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        (payload) => {
          if (!isAdmin) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideRequest>;
            if (deleted.id)
              setRides((current) =>
                current.filter((ride) => ride.id !== deleted.id),
              );
            return;
          }
          setRides((current) =>
            sortByCreated(upsertById(current, payload.new as RideRequest)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_locations" },
        (payload) => {
          if (!isAdmin) return;
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_profiles" },
        (payload) => {
          if (!isAdmin) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderProfile>;
            if (deleted.rider_id) {
              setRiderProfiles((current) =>
                current.filter((item) => item.rider_id !== deleted.rider_id),
              );
            }
            return;
          }
          setRiderProfiles((current) =>
            upsertRiderProfile(current, payload.new as RiderProfile),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_vehicles" },
        (payload) => {
          if (!isAdmin) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RiderVehicle>;
            if (deleted.id) setRiderVehicles((current) => current.filter((vehicle) => vehicle.id !== deleted.id));
            return;
          }
          setRiderVehicles((current) => upsertById(current, payload.new as RiderVehicle));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage(
            "Admin live updates are reconnecting. The dashboard will resync automatically.",
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAdminData]);

  useLiveResync({
    enabled: profile?.role === "admin",
    intervalMs: 8000,
    onResync: loadAdminData,
  });

  async function updateAccountStatus(profileId: string, status: "active" | "suspended") {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_set_account_status", {
      p_profile_id: profileId,
      p_status: status,
    });
    setMessage(error ? error.message : "Account marked " + status + ".");
    if (!error) await loadAdminData();
  }
  async function updateIdentityVerification(riderId: string, status: RiderProfile["verification_status"]) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("rider_profiles").update({
      identity_rejection_reason: status === "rejected" ? "Live identity photo or licence requires correction." : null,
      updated_at: new Date().toISOString(),
      verification_status: status,
    }).eq("rider_id", riderId);
    setMessage(error ? error.message : "Rider identity marked " + status + ".");
    if (!error) await loadAdminData();
  }
  async function updateVehicleVerification(
    vehicleId: string,
    status: RiderVehicle["verification_status"],
  ) {
    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase
      .from("rider_vehicles")
      .update({
        rejection_reason: status === "rejected" ? "Vehicle details require correction or manual review." : null,
        verification_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicleId);

    setMessage(error ? error.message : `Vehicle marked ${status}.`);
    if (!error) await loadAdminData();
  }

  const filteredRides = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rides.filter((ride) => {
      const matchesStatus =
        statusFilter === "all" || ride.status === statusFilter;
      const matchesQuery =
        !normalized ||
        ride.id.toLowerCase().includes(normalized) ||
        ride.pickup_address.toLowerCase().includes(normalized) ||
        ride.drop_address.toLowerCase().includes(normalized) ||
        (ride.passenger_name ?? "").toLowerCase().includes(normalized) ||
        (ride.passenger_phone ?? "").toLowerCase().includes(normalized) ||
        ride.vehicle_type.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, rides, statusFilter]);

  const moneyStats = useMemo(() => {
    return rides.reduce(
      (totals, ride) => {
        const split = calculateFareBreakdown(ride.fare_estimate);
        totals.gross += ride.fare_estimate ?? 0;
        totals.company +=
          ride.company_commission ?? split.companyCommission ?? 0;
        totals.riders += ride.rider_earning ?? split.riderEarning ?? 0;
        if (ride.payment_status === "awaiting_payment")
          totals.awaitingPayment += 1;
        if (ride.payment_status === "paid") totals.paid += 1;
        if (ride.booking_for === "other") totals.guestBookings += 1;
        if (ride.fare_pricing_period && ride.fare_pricing_period !== "standard")
          totals.peakFareRides += 1;
        return totals;
      },
      {
        awaitingPayment: 0,
        company: 0,
        gross: 0,
        guestBookings: 0,
        paid: 0,
        peakFareRides: 0,
        riders: 0,
      },
    );
  }, [rides]);

  if (!loading && !profile) {
    return (
      <AppShell title="Admin dashboard">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Only admin profiles can view real platform data.
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
    <AppShell title="Admin dashboard">
      {message ? (
        <Card className="mb-6 border-amber-200 bg-amber-50 text-sm text-amber-800">
          {message}
        </Card>
      ) : null}

      <nav className="sticky top-16 z-30 mb-5 flex gap-2 overflow-x-auto rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        {[
          ["#admin-overview", "Overview"],
          ["#admin-notifications", "Notifications"],
          ["#admin-safety", "Safety"],
          ["#admin-people", "People"],
          ["#admin-rides", "Rides"],
        ].map(([href, label]) => (
          <a className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm font-black transition hover:bg-secondary" href={href} key={href}>{label}</a>
        ))}
      </nav>

      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4" id="admin-overview">
        <AdminStatsCard
          icon={Users}
          label="Users"
          value={profiles.filter((item) => item.role === "user").length}
        />
        <AdminStatsCard
          icon={Bike}
          label="Riders"
          value={profiles.filter((item) => item.role === "rider").length}
        />
        <AdminStatsCard
          icon={CalendarClock}
          label="Scheduled rides"
          value={rides.filter((ride) => ride.status === "scheduled").length}
        />
        <AdminStatsCard
          icon={MapPin}
          label="Active riders"
          value={riderLocations.filter((rider) => rider.is_available).length}
        />
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <AdminStatsCard
          icon={IndianRupee}
          label="Gross fares"
          value={formatMoney(moneyStats.gross)}
        />
        <AdminStatsCard
          icon={IndianRupee}
          label="Taxiro 7%"
          value={formatMoney(moneyStats.company)}
        />
        <AdminStatsCard
          icon={Bike}
          label="Rider earnings"
          value={formatMoney(moneyStats.riders)}
        />
        <AdminStatsCard
          icon={CalendarClock}
          label="Awaiting payment"
          value={moneyStats.awaitingPayment}
        />
        <AdminStatsCard
          icon={Users}
          label="Guest bookings"
          value={moneyStats.guestBookings}
        />
        <AdminStatsCard
          icon={IndianRupee}
          label="Peak-rate rides"
          value={moneyStats.peakFareRides}
        />
      </div>

      <div className="mt-6 grid gap-6">
        <AdminNotificationCenter />
        <AdminSafetyCenter />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(18rem,0.68fr)_minmax(0,1.32fr)]">
        <section className="grid min-w-0 gap-4" id="admin-people">
          <DemandZoneCard count={rides.length} label="All demand areas" />
          <Card className="animate-in">
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>
                Real profiles visible through Supabase RLS.
              </CardDescription>
            </CardHeader>
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 text-sm">
              {profiles.length ? (
                profiles.map((item) => (
                  <div
                    className="min-w-0 rounded-md bg-muted p-3"
                    key={item.id}
                  >
                    <p className="truncate font-medium">
                      {item.full_name ?? item.id}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{item.role} · {item.account_status ?? "active"}</span>
                      {item.id !== profile?.id ? (
                        <Button onClick={() => void updateAccountStatus(item.id, item.account_status === "suspended" ? "active" : "suspended")} size="sm" variant={item.account_status === "suspended" ? "default" : "outline"}>
                          {item.account_status === "suspended" ? "Activate" : "Suspend"}
                        </Button>
                      ) : <span className="text-xs font-bold text-muted-foreground">You</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  No visible profiles yet.
                </p>
              )}
            </div>
          </Card>
          <Card className="animate-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Rider verification
              </CardTitle>
              <CardDescription>
                Approve a live identity photo first, then verify each submitted vehicle.
              </CardDescription>
            </CardHeader>
            <div className="grid gap-3">
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-black"><Camera className="size-4" /> Identity review</p>
                <div className="grid gap-3">
                  {riderProfiles.length ? riderProfiles.map((rider) => {
                    const person = profiles.find((item) => item.id === rider.rider_id);
                    return (
                      <div className="rounded-lg border border-border bg-muted p-3" key={rider.rider_id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate font-black">{person?.full_name ?? rider.rider_id.slice(0, 8)}</p><p className="truncate text-xs text-muted-foreground">{rider.license_number ?? "No licence submitted"}</p></div>
                          <span className="rounded-full bg-card px-2 py-1 text-[10px] font-black uppercase">{rider.verification_status}</span>
                        </div>
                        {riderSelfieUrls[rider.rider_id] ? <Image alt={"Live identity capture for " + (person?.full_name ?? "rider")} className="mt-3 aspect-[4/3] w-full rounded-lg object-cover" height={480} src={riderSelfieUrls[rider.rider_id]} unoptimized width={640} /> : <p className="mt-3 rounded-md bg-card p-3 text-xs font-semibold text-amber-800">No live photo submitted.</p>}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button disabled={!rider.live_selfie_path} onClick={() => void updateIdentityVerification(rider.rider_id, "verified")} size="sm">Approve identity</Button>
                          <Button onClick={() => void updateIdentityVerification(rider.rider_id, "rejected")} size="sm" variant="outline">Reject</Button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground">No rider identities submitted yet.</p>}
                </div>
              </div>
              <p className="mb-2 text-sm font-black">Vehicle review</p>              {riderVehicles.length ? (
                riderVehicles.map((vehicle) => {
                  const rider = riderProfiles.find((item) => item.rider_id === vehicle.rider_id);
                  const person = profiles.find((item) => item.id === vehicle.rider_id);
                  return (
                    <div className="rounded-lg bg-muted p-3" key={vehicle.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black capitalize">{vehicle.vehicle_type} - {vehicle.registration_number}</p>
                          <p className="truncate text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                          <p className="truncate text-xs text-muted-foreground">{person?.full_name ?? vehicle.rider_id.slice(0, 8)} | {rider?.license_number ?? "No licence"}</p>
                        </div>
                        <span className="rounded-full bg-card px-2 py-1 text-[10px] font-black uppercase">{vehicle.verification_status}</span>
                      </div>
                      {rider?.active_vehicle_type === vehicle.vehicle_type ? <p className="mt-2 text-xs font-black text-primary">Currently active for matching</p> : null}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button disabled={!rider?.live_selfie_path || rider.verification_status !== "verified"} onClick={() => void updateVehicleVerification(vehicle.id, "verified")} size="sm">Verify vehicle</Button>
                        <Button onClick={() => void updateVehicleVerification(vehicle.id, "rejected")} size="sm" variant="outline">Reject</Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No vehicles submitted yet.</p>
              )}
            </div>
          </Card>
        </section>

        <section className="min-w-0" id="admin-rides">
          <h2 className="mb-4 text-xl font-semibold">Ride operations</h2>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ride, passenger, vehicle, pickup, or drop"
                value={query}
              />
            </label>
            <select
              className="h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | RideRequest["status"],
                )
              }
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {(
                [
                  "scheduled",
                  "ready",
                  "assigned",
                  "started",
                  "completed",
                  "cancelled",
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4">
            {filteredRides.length ? (
              filteredRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))
            ) : (
              <Card className="text-sm text-muted-foreground">
                No rides have been created yet.
              </Card>
            )}
          </div>
        </section>
      </div>
    </AppShell>
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

function upsertRiderProfile(items: RiderProfile[], incoming: RiderProfile) {
  const exists = items.some((item) => item.rider_id === incoming.rider_id);
  if (!exists) return [incoming, ...items];
  return items.map((item) =>
    item.rider_id === incoming.rider_id ? incoming : item,
  );
}

function sortByCreated<T extends { created_at?: string; updated_at?: string }>(
  items: T[],
) {
  return [...items].sort((a, b) => {
    const left = a.created_at ?? a.updated_at ?? "";
    const right = b.created_at ?? b.updated_at ?? "";
    return new Date(right).getTime() - new Date(left).getTime();
  });
}
