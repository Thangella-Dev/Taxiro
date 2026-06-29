"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bike, CalendarClock, IndianRupee, MapPin, Search, ShieldCheck, Users } from "lucide-react";

import { AdminStatsCard } from "@/components/AdminStatsCard";
import { AppShell } from "@/components/AppShell";
import { DemandZoneCard } from "@/components/DemandZoneCard";
import { RideCard } from "@/components/RideCard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getSupabase } from "@/lib/supabase";
import type { Profile, RideRequest, RiderLocation, RiderProfile } from "@/types/database";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<RiderProfile[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | RideRequest["status"]>("all");

  const loadAdminData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const [profileResult, riderResult, riderProfileResult, rideResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("rider_locations").select("*"),
      supabase.from("rider_profiles").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("ride_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error || riderResult.error || riderProfileResult.error || rideResult.error) {
      setMessage(
        profileResult.error?.message ??
          riderResult.error?.message ??
          riderProfileResult.error?.message ??
          rideResult.error?.message ??
          "Could not load admin data.",
      );
      return;
    }

    setProfiles((profileResult.data as Profile[]) ?? []);
    setRiderLocations((riderResult.data as RiderLocation[]) ?? []);
    setRiderProfiles((riderProfileResult.data as RiderProfile[]) ?? []);
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
        setMessage("Your profile is not an admin. Update role in Supabase to access this dashboard.");
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
            if (deleted.id) setProfiles((current) => current.filter((item) => item.id !== deleted.id));
            return;
          }
          setProfiles((current) => sortByCreated(upsertById(current, payload.new as Profile)));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        (payload) => {
          if (!isAdmin) return;
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideRequest>;
            if (deleted.id) setRides((current) => current.filter((ride) => ride.id !== deleted.id));
            return;
          }
          setRides((current) => sortByCreated(upsertById(current, payload.new as RideRequest)));
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
              setRiderLocations((current) => current.filter((rider) => rider.rider_id !== deleted.rider_id));
            }
            return;
          }
          setRiderLocations((current) => upsertRiderLocation(current, payload.new as RiderLocation));
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
              setRiderProfiles((current) => current.filter((item) => item.rider_id !== deleted.rider_id));
            }
            return;
          }
          setRiderProfiles((current) => upsertRiderProfile(current, payload.new as RiderProfile));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage("Admin live updates are reconnecting. The dashboard will resync automatically.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAdminData]);

  async function updateVerification(riderId: string, status: RiderProfile["verification_status"]) {
    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase
      .from("rider_profiles")
      .update({ verification_status: status, updated_at: new Date().toISOString() })
      .eq("rider_id", riderId);

    setMessage(error ? error.message : "Rider verification updated.");
    if (!error) await loadAdminData();
  }

  const filteredRides = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rides.filter((ride) => {
      const matchesStatus = statusFilter === "all" || ride.status === statusFilter;
      const matchesQuery =
        !normalized ||
        ride.id.toLowerCase().includes(normalized) ||
        ride.pickup_address.toLowerCase().includes(normalized) ||
        ride.drop_address.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, rides, statusFilter]);

  const moneyStats = useMemo(() => {
    return rides.reduce(
      (totals, ride) => {
        const split = calculateFareBreakdown(ride.fare_estimate);
        totals.gross += ride.fare_estimate ?? 0;
        totals.company += ride.company_commission ?? split.companyCommission ?? 0;
        totals.riders += ride.rider_earning ?? split.riderEarning ?? 0;
        if (ride.payment_status === "awaiting_payment") totals.awaitingPayment += 1;
        if (ride.payment_status === "paid") totals.paid += 1;
        return totals;
      },
      { awaitingPayment: 0, company: 0, gross: 0, paid: 0, riders: 0 },
    );
  }, [rides]);

  if (!loading && !profile) {
    return (
      <AppShell title="Admin dashboard">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Only admin profiles can view real platform data.</CardDescription>
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

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatsCard icon={IndianRupee} label="Gross fares" value={formatMoney(moneyStats.gross)} />
        <AdminStatsCard icon={IndianRupee} label="Taxiro 7%" value={formatMoney(moneyStats.company)} />
        <AdminStatsCard icon={Bike} label="Rider earnings" value={formatMoney(moneyStats.riders)} />
        <AdminStatsCard icon={CalendarClock} label="Awaiting payment" value={moneyStats.awaitingPayment} />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="grid min-w-0 gap-4">
          <DemandZoneCard count={rides.length} label="All demand areas" />
          <Card className="animate-in">
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>Real profiles visible through Supabase RLS.</CardDescription>
            </CardHeader>
            <div className="grid gap-3 text-sm">
              {profiles.length ? (
                profiles.map((item) => (
                  <div className="min-w-0 rounded-md bg-muted p-3" key={item.id}>
                    <p className="truncate font-medium">{item.full_name ?? item.id}</p>
                    <p className="text-muted-foreground">{item.role}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No visible profiles yet.</p>
              )}
            </div>
          </Card>
          <Card className="animate-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Rider verification
              </CardTitle>
              <CardDescription>Review real vehicle details before marking a rider verified.</CardDescription>
            </CardHeader>
            <div className="grid gap-3">
              {riderProfiles.length ? riderProfiles.map((item) => (
                <div className="rounded-2xl bg-muted p-3" key={item.rider_id}>
                  <p className="font-black">{item.vehicle_number ?? "No registration"}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.vehicle_make ?? "Unknown"} {item.vehicle_model ?? "vehicle"} | {item.license_number ?? "No licence"}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted-foreground">{item.verification_status}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button onClick={() => void updateVerification(item.rider_id, "verified")} size="sm">
                      Verify
                    </Button>
                    <Button onClick={() => void updateVerification(item.rider_id, "rejected")} size="sm" variant="outline">
                      Reject
                    </Button>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No rider details submitted yet.</p>}
            </div>
          </Card>
        </section>

        <section className="min-w-0">
          <h2 className="mb-4 text-xl font-semibold">Ride operations</h2>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ride ID, pickup, or drop"
                value={query}
              />
            </label>
            <select
              className="h-11 rounded-2xl border border-border bg-card px-3 text-sm font-semibold"
              onChange={(event) => setStatusFilter(event.target.value as "all" | RideRequest["status"])}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {(["scheduled", "ready", "assigned", "started", "completed", "cancelled"] as const).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4">
            {filteredRides.length ? (
              filteredRides.map((ride) => <RideCard key={ride.id} ride={ride} />)
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
  return items.map((item) => (item.rider_id === incoming.rider_id ? incoming : item));
}

function upsertRiderProfile(items: RiderProfile[], incoming: RiderProfile) {
  const exists = items.some((item) => item.rider_id === incoming.rider_id);
  if (!exists) return [incoming, ...items];
  return items.map((item) => (item.rider_id === incoming.rider_id ? incoming : item));
}

function sortByCreated<T extends { created_at?: string; updated_at?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const left = a.created_at ?? a.updated_at ?? "";
    const right = b.created_at ?? b.updated_at ?? "";
    return new Date(right).getTime() - new Date(left).getTime();
  });
}

