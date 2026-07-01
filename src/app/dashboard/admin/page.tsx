"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Bike,
  CalendarClock,
  Camera,
  Car,
  CreditCard,
  Flame,
  IndianRupee,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { AdminSafetyCenter } from "@/components/AdminSafetyCenter";
import { AppShell } from "@/components/AppShell";
import { RideCard } from "@/components/RideCard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getSupabase } from "@/lib/supabase";
import { useLiveResync } from "@/lib/useLiveResync";
import { getVehicleLabel } from "@/lib/vehicles";
import type { Profile, RideRequest, RiderLocation, RiderProfile, RiderVehicle } from "@/types/database";

const adminSections = [
  ["overview", "Overview", LayoutDashboard],
  ["command", "Command", ShieldCheck],
  ["verification", "Verification", UserCheck],
  ["people", "People", Users],
  ["rides", "Rides", Bike],
] as const;

type AdminSection = (typeof adminSections)[number][0];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<RiderProfile[]>([]);
  const [riderSelfieUrls, setRiderSelfieUrls] = useState<Record<string, string>>({});
  const [riderVehicles, setRiderVehicles] = useState<RiderVehicle[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | RideRequest["status"]>("all");

  const loadAdminData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [profileResult, riderResult, riderProfileResult, riderVehicleResult, rideResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("rider_locations").select("*"),
      supabase.from("rider_profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("rider_vehicles").select("*").order("updated_at", { ascending: false }),
      supabase.from("ride_requests").select("*").order("created_at", { ascending: false }),
    ]);

    if (profileResult.error || riderResult.error || riderProfileResult.error || riderVehicleResult.error || rideResult.error) {
      setMessage(profileResult.error?.message ?? riderResult.error?.message ?? riderProfileResult.error?.message ?? riderVehicleResult.error?.message ?? rideResult.error?.message ?? "Could not load admin data.");
      return;
    }

    setProfiles((profileResult.data as Profile[]) ?? []);
    setRiderLocations((riderResult.data as RiderLocation[]) ?? []);
    const loadedRiderProfiles = (riderProfileResult.data as RiderProfile[]) ?? [];
    setRiderProfiles(loadedRiderProfiles);
    setRiderVehicles((riderVehicleResult.data as RiderVehicle[]) ?? []);
    const signedSelfies = await Promise.all(loadedRiderProfiles.filter((item) => item.live_selfie_path).map(async (item) => {
      const { data } = await supabase.storage.from("rider-verification").createSignedUrl(item.live_selfie_path as string, 600);
      return [item.rider_id, data?.signedUrl ?? ""] as const;
    }));
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
      if (isAdmin) await loadAdminData();
      else setMessage("Your profile is not an admin. Update role in Supabase to access this dashboard.");
      setLoading(false);
    });

    const channel = supabase
      .channel("admin-live-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<Profile>;
          if (deleted.id) setProfiles((current) => current.filter((item) => item.id !== deleted.id));
          return;
        }
        setProfiles((current) => sortByCreated(upsertById(current, payload.new as Profile)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<RideRequest>;
          if (deleted.id) setRides((current) => current.filter((ride) => ride.id !== deleted.id));
          return;
        }
        setRides((current) => sortByCreated(upsertById(current, payload.new as RideRequest)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_locations" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<RiderLocation>;
          if (deleted.rider_id) setRiderLocations((current) => current.filter((rider) => rider.rider_id !== deleted.rider_id));
          return;
        }
        setRiderLocations((current) => upsertRiderLocation(current, payload.new as RiderLocation));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_profiles" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<RiderProfile>;
          if (deleted.rider_id) setRiderProfiles((current) => current.filter((item) => item.rider_id !== deleted.rider_id));
          return;
        }
        setRiderProfiles((current) => upsertRiderProfile(current, payload.new as RiderProfile));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_vehicles" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<RiderVehicle>;
          if (deleted.id) setRiderVehicles((current) => current.filter((vehicle) => vehicle.id !== deleted.id));
          return;
        }
        setRiderVehicles((current) => upsertById(current, payload.new as RiderVehicle));
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setMessage("Admin live updates are reconnecting. The dashboard will resync automatically.");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAdminData]);

  useLiveResync({ enabled: profile?.role === "admin", intervalMs: 8000, onResync: loadAdminData });

  async function updateAccountStatus(profileId: string, status: "active" | "suspended") {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_set_account_status", { p_profile_id: profileId, p_status: status });
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

  async function updateVehicleVerification(vehicleId: string, status: RiderVehicle["verification_status"]) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("rider_vehicles").update({
      rejection_reason: status === "rejected" ? "Vehicle details require correction or manual review." : null,
      verification_status: status,
      updated_at: new Date().toISOString(),
    }).eq("id", vehicleId);
    setMessage(error ? error.message : `Vehicle marked ${status}.`);
    if (!error) await loadAdminData();
  }

  const filteredRides = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rides.filter((ride) => {
      const matchesStatus = statusFilter === "all" || ride.status === statusFilter;
      const matchesQuery = !normalized || ride.id.toLowerCase().includes(normalized) || ride.pickup_address.toLowerCase().includes(normalized) || ride.drop_address.toLowerCase().includes(normalized) || (ride.passenger_name ?? "").toLowerCase().includes(normalized) || (ride.passenger_phone ?? "").toLowerCase().includes(normalized) || ride.vehicle_type.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, rides, statusFilter]);

  const moneyStats = useMemo(() => rides.reduce((totals, ride) => {
    const split = calculateFareBreakdown(ride.fare_estimate);
    totals.gross += ride.fare_estimate ?? 0;
    totals.company += ride.company_commission ?? split.companyCommission ?? 0;
    totals.riders += ride.rider_earning ?? split.riderEarning ?? 0;
    if (ride.payment_status === "awaiting_payment") totals.awaitingPayment += 1;
    if (ride.booking_for === "other") totals.guestBookings += 1;
    if (ride.fare_pricing_period && ride.fare_pricing_period !== "standard") totals.peakFareRides += 1;
    return totals;
  }, { awaitingPayment: 0, company: 0, gross: 0, guestBookings: 0, peakFareRides: 0, riders: 0 }), [rides]);

  const dashboardStats = useMemo(() => ({
    activeRides: rides.filter((ride) => ride.status === "assigned" || ride.status === "started").length,
    readyRides: rides.filter((ride) => ride.status === "ready").length,
    suspendedAccounts: profiles.filter((item) => item.account_status === "suspended").length,
    verificationQueue: riderProfiles.filter((rider) => rider.verification_status === "pending").length + riderVehicles.filter((vehicle) => vehicle.verification_status === "pending").length,
  }), [profiles, riderProfiles, riderVehicles, rides]);

  if (!loading && !profile) {
    return (
      <AppShell title="Admin dashboard">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Only admin profiles can view real platform data.</CardDescription>
          </CardHeader>
          <Button asChild><Link href="/auth">Go to sign in</Link></Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin dashboard">
      <div className="min-w-0 space-y-5 pb-8" id="admin-overview">
        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-sm" role="status">{message}</div> : null}

        <section className="overflow-hidden rounded-[2rem] border border-border bg-[#07110d] text-white shadow-xl">
          <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] xl:items-end">
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-lime-200/80">
                <span>Taxiro workspace</span>
                <span className="rounded-full bg-lime-300 px-3 py-1 text-[11px] text-[#07110d]">Live operations</span>
              </div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Admin command center</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">Monitor rides, verify riders, send alerts, control account access, and watch platform health from one clean operations surface.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <HeroSignal label="Active trips" value={dashboardStats.activeRides} tone="lime" />
                <HeroSignal label="Ready signals" value={dashboardStats.readyRides} tone="white" />
                <HeroSignal label="Verification queue" value={dashboardStats.verificationQueue} tone="amber" />
              </div>
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm text-white/60">Total gross</p><p className="text-3xl font-black">{formatMoney(moneyStats.gross)}</p></div>
                <span className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-[#07110d]"><IndianRupee className="size-6" /></span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/[0.07] p-3"><p className="text-white/55">Taxiro share</p><p className="text-xl font-black">{formatMoney(moneyStats.company)}</p></div>
                <div className="rounded-2xl bg-white/[0.07] p-3"><p className="text-white/55">Rider earnings</p><p className="text-xl font-black">{formatMoney(moneyStats.riders)}</p></div>
              </div>
              <p className="text-xs font-semibold text-white/50">Realtime rows are merged live and resynced every few seconds.</p>
            </div>
          </div>
        </section>

        <nav aria-label="Admin workspace sections" className="sticky top-16 z-30 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background/92 p-2 shadow-sm backdrop-blur sm:grid-cols-5">
          {adminSections.map(([section, label, Icon]) => (
            <button
              aria-current={activeSection === section ? "page" : undefined}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${activeSection === section ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              key={section}
              onClick={() => setActiveSection(section)}
              type="button"
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        {activeSection === "overview" ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile icon={Users} label="Customers" value={profiles.filter((item) => item.role === "user").length} helper="Active app accounts" />
          <MetricTile icon={Bike} label="Riders" value={profiles.filter((item) => item.role === "rider").length} helper="Registered riders" />
          <MetricTile icon={MapPin} label="Online riders" value={riderLocations.filter((rider) => rider.is_available).length} helper="Available right now" tone="green" />
          <MetricTile icon={CalendarClock} label="Scheduled" value={rides.filter((ride) => ride.status === "scheduled").length} helper="Advance bookings" />
          <MetricTile icon={CreditCard} label="Awaiting payment" value={moneyStats.awaitingPayment} helper="Drop reached" tone="amber" />
          <MetricTile icon={Users} label="Guest rides" value={moneyStats.guestBookings} helper="Booked for others" />
          <MetricTile icon={Flame} label="Peak-rate rides" value={moneyStats.peakFareRides} helper="Surge windows" tone="lime" />
          <MetricTile icon={XCircle} label="Suspended" value={dashboardStats.suspendedAccounts} helper="Accounts restricted" tone="red" />
        </section> : null}

        {activeSection === "command" ? <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]" id="admin-command">
          <div className="grid gap-5"><AdminNotificationCenter /><AdminSafetyCenter /></div>
          <OperationsSnapshot activeRides={dashboardStats.activeRides} profiles={profiles} readyRides={dashboardStats.readyRides} riderLocations={riderLocations} rides={rides} verificationQueue={dashboardStats.verificationQueue} />
        </section> : null}

        {activeSection === "verification" ? <RiderVerificationPanel onUpdateIdentity={updateIdentityVerification} onUpdateVehicle={updateVehicleVerification} profiles={profiles} riderProfiles={riderProfiles} riderSelfieUrls={riderSelfieUrls} riderVehicles={riderVehicles} /> : null}
        {activeSection === "people" ? <PeoplePanel currentAdminId={profile?.id} onUpdateStatus={updateAccountStatus} profiles={profiles} /> : null}
        {activeSection === "rides" ? <RideOperationsPanel filteredRides={filteredRides} query={query} setQuery={setQuery} setStatusFilter={setStatusFilter} statusFilter={statusFilter} /> : null}
      </div>
    </AppShell>
  );
}

function HeroSignal({ label, tone, value }: { label: string; tone: "amber" | "lime" | "white"; value: number }) {
  const toneClass = { amber: "bg-amber-300 text-[#07110d]", lime: "bg-lime-300 text-[#07110d]", white: "bg-white/10 text-white" }[tone];
  return <div className={`rounded-2xl px-4 py-3 ${toneClass}`}><p className="text-3xl font-black">{value}</p><p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p></div>;
}

function MetricTile({ helper, icon: Icon, label, tone = "default", value }: { helper: string; icon: LucideIcon; label: string; tone?: "amber" | "default" | "green" | "lime" | "red"; value: number | string }) {
  const toneClass = { amber: "bg-amber-50 text-amber-700", default: "bg-muted text-primary", green: "bg-emerald-50 text-emerald-700", lime: "bg-lime-100 text-lime-800", red: "bg-red-50 text-red-700" }[tone];
  return (
    <Card className="group rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><span className={`grid size-11 place-items-center rounded-2xl ${toneClass}`}><Icon className="size-5" /></span><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-black uppercase text-muted-foreground">Live</span></div>
      <p className="mt-5 text-3xl font-black tracking-tight">{value}</p><p className="mt-1 font-black">{label}</p><p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </Card>
  );
}

function OperationsSnapshot({ activeRides, profiles, readyRides, riderLocations, rides, verificationQueue }: { activeRides: number; profiles: Profile[]; readyRides: number; riderLocations: RiderLocation[]; rides: RideRequest[]; verificationQueue: number }) {
  const latestRide = rides[0];
  const onlineRiders = riderLocations.filter((rider) => rider.is_available).length;
  return (
    <Card className="rounded-[1.75rem] bg-[#f4f7f1] p-5 xl:sticky xl:top-36">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Control room</p><h2 className="mt-2 text-2xl font-black">Platform snapshot</h2></div><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><LayoutDashboard className="size-5" /></span></div>
      <div className="mt-5 grid gap-3">
        <SnapshotRow icon={Activity} label="Active ride load" value={`${activeRides} trips`} />
        <SnapshotRow icon={Megaphone} label="Ready demand" value={`${readyRides} signals`} />
        <SnapshotRow icon={UserCheck} label="Online supply" value={`${onlineRiders} riders`} />
        <SnapshotRow icon={ShieldCheck} label="Verification queue" value={`${verificationQueue} pending`} />
        <SnapshotRow icon={Users} label="Total accounts" value={`${profiles.length} profiles`} />
      </div>
      <div className="mt-5 rounded-2xl bg-card p-4"><p className="text-sm font-black">Latest ride</p>{latestRide ? <div className="mt-3 space-y-2 text-sm"><p className="font-black">Ride #{latestRide.id.slice(0, 8)}</p><p className="line-clamp-2 text-muted-foreground">{latestRide.pickup_address}</p><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-muted px-2 py-1 capitalize">{latestRide.status}</span><span className="rounded-full bg-muted px-2 py-1">{getVehicleLabel(latestRide.vehicle_type)}</span><span className="rounded-full bg-muted px-2 py-1">{formatMoney(latestRide.fare_estimate ?? 0)}</span></div></div> : <p className="mt-3 text-sm text-muted-foreground">No ride activity yet.</p>}</div>
    </Card>
  );
}

function SnapshotRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-4" /></span><p className="truncate text-sm font-bold text-muted-foreground">{label}</p></div><p className="shrink-0 text-sm font-black">{value}</p></div>;
}

function PeoplePanel({ currentAdminId, onUpdateStatus, profiles }: { currentAdminId?: string; onUpdateStatus: (profileId: string, status: "active" | "suspended") => Promise<void>; profiles: Profile[] }) {
  return (
    <Card className="rounded-[1.5rem]" id="admin-people"><CardHeader className="mb-3 flex flex-row items-start justify-between gap-4"><div><CardTitle>People control</CardTitle><CardDescription>Suspend risky accounts or reactivate trusted accounts.</CardDescription></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{profiles.length} total</span></CardHeader>
      <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">{profiles.length ? profiles.map((item) => { const suspended = item.account_status === "suspended"; return <div className="rounded-2xl border border-border bg-muted/70 p-3" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{item.full_name ?? item.id}</p><p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{item.phone ?? "No phone"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${suspended ? "bg-red-100 text-red-700" : "bg-lime-100 text-lime-800"}`}>{item.account_status ?? "active"}</span></div><div className="mt-3 flex items-center justify-between gap-2"><span className="rounded-full bg-card px-2 py-1 text-xs font-black uppercase text-muted-foreground">{item.role}</span>{item.id !== currentAdminId ? <Button onClick={() => void onUpdateStatus(item.id, suspended ? "active" : "suspended")} size="sm" variant={suspended ? "default" : "outline"}>{suspended ? "Activate" : "Suspend"}</Button> : <span className="text-xs font-black text-muted-foreground">You</span>}</div></div>; }) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No visible profiles yet.</p>}</div>
    </Card>
  );
}

function RiderVerificationPanel({ onUpdateIdentity, onUpdateVehicle, profiles, riderProfiles, riderSelfieUrls, riderVehicles }: { onUpdateIdentity: (riderId: string, status: RiderProfile["verification_status"]) => Promise<void>; onUpdateVehicle: (vehicleId: string, status: RiderVehicle["verification_status"]) => Promise<void>; profiles: Profile[]; riderProfiles: RiderProfile[]; riderSelfieUrls: Record<string, string>; riderVehicles: RiderVehicle[] }) {
  const pendingIdentity = riderProfiles.filter((rider) => rider.verification_status !== "verified");
  const pendingVehicles = riderVehicles.filter((vehicle) => vehicle.verification_status !== "verified");
  return (
    <Card className="rounded-[1.5rem]" id="admin-verification"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Rider verification</CardTitle><CardDescription>Approve live identity first, then verify each Bike, Auto, or Car.</CardDescription></CardHeader>
      <div className="grid gap-5">
        <section><div className="mb-3 flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-black"><Camera className="size-4" /> Identity review</p><span className="rounded-full bg-muted px-2 py-1 text-xs font-black">{pendingIdentity.length} pending</span></div>
          <div className="grid gap-3">{riderProfiles.length ? riderProfiles.map((rider) => { const person = profiles.find((item) => item.id === rider.rider_id); const verified = rider.verification_status === "verified"; return <div className="rounded-2xl border border-border bg-muted/70 p-3" key={rider.rider_id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{person?.full_name ?? rider.rider_id.slice(0, 8)}</p><p className="truncate text-xs text-muted-foreground">Licence {rider.license_number ?? "not submitted"}</p></div><ReviewBadge status={rider.verification_status} /></div>{riderSelfieUrls[rider.rider_id] ? <Image alt={"Live identity capture for " + (person?.full_name ?? "rider")} className="mt-3 aspect-[4/3] w-full rounded-2xl object-cover" height={480} src={riderSelfieUrls[rider.rider_id]} unoptimized width={640} /> : <p className="mt-3 rounded-2xl bg-card p-3 text-xs font-semibold text-amber-800">No live photo submitted.</p>}<div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={!rider.live_selfie_path || verified} onClick={() => void onUpdateIdentity(rider.rider_id, "verified")} size="sm">{verified ? "Verified" : "Approve"}</Button><Button onClick={() => void onUpdateIdentity(rider.rider_id, "rejected")} size="sm" variant="outline">Reject</Button></div></div>; }) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No rider identities submitted yet.</p>}</div>
        </section>
        <section><div className="mb-3 flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-black"><Car className="size-4" /> Vehicle review</p><span className="rounded-full bg-muted px-2 py-1 text-xs font-black">{pendingVehicles.length} pending</span></div>
          <div className="grid gap-3">{riderVehicles.length ? riderVehicles.map((vehicle) => { const rider = riderProfiles.find((item) => item.rider_id === vehicle.rider_id); const person = profiles.find((item) => item.id === vehicle.rider_id); const verified = vehicle.verification_status === "verified"; return <div className="rounded-2xl border border-border bg-muted/70 p-3" key={vehicle.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black capitalize">{vehicle.vehicle_type} - {vehicle.registration_number}</p><p className="truncate text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</p><p className="truncate text-xs text-muted-foreground">{person?.full_name ?? vehicle.rider_id.slice(0, 8)}</p></div><ReviewBadge status={vehicle.verification_status} /></div>{rider?.active_vehicle_type === vehicle.vehicle_type ? <p className="mt-2 text-xs font-black text-primary">Currently active for matching</p> : null}<div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={!rider?.live_selfie_path || rider.verification_status !== "verified" || verified} onClick={() => void onUpdateVehicle(vehicle.id, "verified")} size="sm">{verified ? "Verified" : "Verify"}</Button><Button onClick={() => void onUpdateVehicle(vehicle.id, "rejected")} size="sm" variant="outline">Reject</Button></div></div>; }) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No vehicles submitted yet.</p>}</div>
        </section>
      </div>
    </Card>
  );
}

function ReviewBadge({ status }: { status: "pending" | "rejected" | "verified" }) {
  const classes = { pending: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700", verified: "bg-lime-100 text-lime-800" }[status];
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${classes}`}>{status}</span>;
}

function RideOperationsPanel({ filteredRides, query, setQuery, setStatusFilter, statusFilter }: { filteredRides: RideRequest[]; query: string; setQuery: (value: string) => void; setStatusFilter: (value: "all" | RideRequest["status"]) => void; statusFilter: "all" | RideRequest["status"] }) {
  return (
    <section className="min-w-0" id="admin-rides"><Card className="rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Ride operations</p><h2 className="mt-2 text-2xl font-black">Dispatch and ride audit</h2><p className="mt-1 text-sm text-muted-foreground">Search live rides by passenger, pickup, drop, vehicle, or ride ID.</p></div><div className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_auto]"><label className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input className="h-11 rounded-full pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search ride, passenger, vehicle, pickup, or drop" value={query} /></label><select className="h-11 rounded-full border border-border bg-card px-4 text-sm font-black outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setStatusFilter(event.target.value as "all" | RideRequest["status"])} value={statusFilter}><option value="all">All statuses</option>{(["scheduled", "ready", "assigned", "started", "completed", "cancelled"] as const).map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>
      <div className="grid gap-4 2xl:grid-cols-2">{filteredRides.length ? filteredRides.map((ride) => <RideCard key={ride.id} ride={ride} />) : <div className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">No rides match the current filters.</div>}</div>
    </Card></section>
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
