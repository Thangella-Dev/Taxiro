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
  Headphones,
  IndianRupee,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { AdminOperationalControls } from "@/components/AdminOperationalControls";
import { AdminSafetyCenter } from "@/components/AdminSafetyCenter";
import { AdminSupportCenter } from "@/components/AdminSupportCenter";
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
import type { Profile, RideRequest, RiderLocation, RiderProfile, RiderVehicle, SupportTicket } from "@/types/database";

const adminSections = [
  ["overview", "Overview", LayoutDashboard],
  ["command", "Command", ShieldCheck],
  ["verification", "Verification", UserCheck],
  ["people", "People", Users],
  ["support", "Support", Headphones],
  ["health", "Health", Activity],
  ["controls", "Controls", SlidersHorizontal],
  ["rides", "Rides", Bike],
] as const;

type AdminSection = (typeof adminSections)[number][0];

type HealthPayload = {
  checks: Record<string, { description: string; ok: boolean; required: boolean }>;
  deployment: { commit: string; environment: string; region: string; url: string };
  generatedAt: string;
  recommendations: string[];
  service: string;
  status: "degraded" | "failed" | "ok";
  version: string;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<RiderProfile[]>([]);
  const [riderSelfieUrls, setRiderSelfieUrls] = useState<Record<string, string>>({});
  const [riderVehicles, setRiderVehicles] = useState<RiderVehicle[]>([]);
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | RideRequest["status"]>("all");

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const payload = (await response.json()) as HealthPayload;
      setHealth(payload);
      if (!response.ok) setMessage("System health is degraded. Check the Health section for deployment configuration.");
    } catch {
      setMessage("Could not read system health from /api/health.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [profileResult, riderResult, riderProfileResult, riderVehicleResult, rideResult, supportResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("rider_locations").select("*"),
      supabase.from("rider_profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("rider_vehicles").select("*").order("updated_at", { ascending: false }),
      supabase.from("ride_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
    ]);

    if (profileResult.error || riderResult.error || riderProfileResult.error || riderVehicleResult.error || rideResult.error || supportResult.error) {
      setMessage(profileResult.error?.message ?? riderResult.error?.message ?? riderProfileResult.error?.message ?? riderVehicleResult.error?.message ?? rideResult.error?.message ?? supportResult.error?.message ?? "Could not load admin data.");
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
    setSupportTickets((supportResult.data as SupportTicket[]) ?? []);
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
        await Promise.all([loadAdminData(), loadHealth()]);
      }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, (payload) => {
        if (!isAdmin) return;
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<SupportTicket>;
          if (deleted.id) setSupportTickets((current) => current.filter((ticket) => ticket.id !== deleted.id));
          return;
        }
        setSupportTickets((current) => sortByCreated(upsertById(current, payload.new as SupportTicket)));
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setMessage("Admin live updates are reconnecting. The dashboard will resync automatically.");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAdminData, loadHealth]);

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

        <nav aria-label="Admin workspace sections" className="sticky top-16 z-30 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-background/92 p-2 shadow-sm backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {adminSections.map(([section, label, Icon]) => (
            <button
              aria-current={activeSection === section ? "page" : undefined}
              className={`flex min-w-[7.75rem] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition sm:min-w-[8.5rem] xl:min-w-0 ${activeSection === section ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
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
        {activeSection === "support" && profile ? <AdminSupportCenter adminId={profile.id} onChanged={loadAdminData} onMessage={setMessage} tickets={supportTickets} /> : null}
        {activeSection === "health" ? <SystemHealthPanel health={health} loading={healthLoading} onRefresh={loadHealth} /> : null}
        {activeSection === "controls" ? <AdminOperationalControls onMessage={setMessage} /> : null}
        {activeSection === "rides" ? <RideOperationsPanel filteredRides={filteredRides} query={query} setQuery={setQuery} setStatusFilter={setStatusFilter} statusFilter={statusFilter} /> : null}
      </div>
    </AppShell>
  );
}


function SystemHealthPanel({ health, loading, onRefresh }: { health: HealthPayload | null; loading: boolean; onRefresh: () => void }) {
  const statusTone = health?.status === "ok" ? "bg-lime-300 text-[#07110d]" : health?.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  const checks = health ? Object.entries(health.checks) : [];
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]" id="admin-health">
      <Card className="rounded-[1.75rem] p-5">
        <CardHeader className="mb-4 flex flex-row items-start justify-between gap-4 p-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">System health</p>
            <CardTitle className="mt-2 text-3xl">Deployment diagnostics</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">Track production readiness, environment configuration, and deployment action items from inside the admin panel.</CardDescription>
          </div>
          <Button disabled={loading} onClick={onRefresh} variant="outline">{loading ? "Checking..." : "Refresh"}</Button>
        </CardHeader>

        {health ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {checks.map(([key, check]) => (
              <div className="rounded-2xl border border-border bg-muted/60 p-4" key={key}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{humanizeHealthKey(key)}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{check.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${check.ok ? "bg-lime-100 text-lime-800" : check.required ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{check.ok ? "OK" : check.required ? "Missing" : "Needed"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-muted p-5 text-sm font-semibold text-muted-foreground">Health data has not loaded yet. Use Refresh to check /api/health.</div>
        )}
      </Card>

      <div className="grid gap-5">
        <Card className="rounded-[1.75rem] bg-[#07110d] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Current deployment</p>
              <h2 className="mt-2 text-2xl font-black">{health?.service ?? "taxiro-web"}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusTone}`}>{health?.status ?? "checking"}</span>
          </div>
          <div className="mt-5 grid gap-3 text-sm">
            <DeploymentFact label="Commit" value={health?.deployment.commit ?? "local"} />
            <DeploymentFact label="Environment" value={health?.deployment.environment ?? "local"} />
            <DeploymentFact label="Region" value={health?.deployment.region ?? "local"} />
            <DeploymentFact label="URL" value={health?.deployment.url ?? "local"} />
            <DeploymentFact label="Checked" value={health ? new Date(health.generatedAt).toLocaleString() : "Not checked"} />
          </div>
        </Card>

        <Card className="rounded-[1.75rem] p-5">
          <CardHeader className="mb-3 p-0"><CardTitle>Action checklist</CardTitle><CardDescription>Use this when Vercel or Supabase checks fail after a push.</CardDescription></CardHeader>
          <div className="grid gap-2">
            {(health?.recommendations ?? ["Refresh health to load deployment action items."]).map((item) => <p className="rounded-2xl bg-muted p-3 text-sm font-semibold text-muted-foreground" key={item}>{item}</p>)}
          </div>
        </Card>
      </div>
    </section>
  );
}

function DeploymentFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] p-3"><span className="text-white/55">{label}</span><span className="min-w-0 truncate text-right font-black">{value}</span></div>;
}

function humanizeHealthKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
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
  const verifiedIdentityCount = riderProfiles.length - pendingIdentity.length;
  const verifiedVehicleCount = riderVehicles.length - pendingVehicles.length;

  return (
    <section className="grid min-w-0 gap-5" id="admin-verification">
      <Card className="overflow-hidden rounded-[1.5rem] border-primary/10 bg-gradient-to-br from-[#f8fbf3] via-card to-card p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Rider trust desk</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Verification control</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Approve live identity first, then verify each Bike, Auto, or Car. Photos are shown as compact review thumbnails so the queue stays scannable.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
            <VerificationStat label="Identity pending" value={pendingIdentity.length} tone="amber" />
            <VerificationStat label="Identity verified" value={verifiedIdentityCount} tone="green" />
            <VerificationStat label="Vehicle pending" value={pendingVehicles.length} tone="amber" />
            <VerificationStat label="Vehicle verified" value={verifiedVehicleCount} tone="green" />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="min-w-0 rounded-[1.5rem] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-black"><Camera className="size-4" /> Identity review</p>
              <p className="mt-1 text-xs text-muted-foreground">Live selfie and licence context</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-black">{pendingIdentity.length} pending</span>
          </div>
          <div className="grid max-h-[min(70dvh,42rem)] gap-3 overflow-y-auto pr-1">
            {riderProfiles.length ? riderProfiles.map((rider) => {
              const person = profiles.find((item) => item.id === rider.rider_id);
              const verified = rider.verification_status === "verified";
              const photoUrl = riderSelfieUrls[rider.rider_id];
              return (
                <article className="rounded-2xl border border-border bg-muted/55 p-3 transition hover:bg-muted/80" key={rider.rider_id}>
                  <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
                      {photoUrl ? (
                        <Image alt={"Live identity capture for " + (person?.full_name ?? "rider")} className="h-40 w-full object-cover sm:h-36" height={180} src={photoUrl} unoptimized width={160} />
                      ) : (
                        <div className="grid h-36 place-items-center p-3 text-center text-xs font-semibold text-amber-800">No live photo submitted</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black">{person?.full_name ?? rider.rider_id.slice(0, 8)}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{person?.phone ?? "No phone on profile"}</p>
                        </div>
                        <ReviewBadge status={rider.verification_status} />
                      </div>
                      <div className="mt-3 grid gap-2 rounded-xl bg-card p-3 text-xs">
                        <div className="flex items-center justify-between gap-2"><span className="font-bold text-muted-foreground">Licence</span><span className="truncate font-black">{rider.license_number ?? "Not submitted"}</span></div>
                        <div className="flex items-center justify-between gap-2"><span className="font-bold text-muted-foreground">Active vehicle</span><span className="truncate font-black capitalize">{rider.active_vehicle_type ?? "Not selected"}</span></div>
                      </div>
                      {rider.identity_rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{rider.identity_rejection_reason}</p> : null}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button disabled={!rider.live_selfie_path || verified} onClick={() => void onUpdateIdentity(rider.rider_id, "verified")} size="sm">{verified ? "Verified" : "Approve"}</Button>
                        <Button onClick={() => void onUpdateIdentity(rider.rider_id, "rejected")} size="sm" variant="outline">Reject</Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }) : <VerificationEmpty text="No rider identities submitted yet." />}
          </div>
        </Card>

        <Card className="min-w-0 rounded-[1.5rem] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-black"><Car className="size-4" /> Vehicle review</p>
              <p className="mt-1 text-xs text-muted-foreground">Verify each submitted Bike, Auto, and Car separately</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-black">{pendingVehicles.length} pending</span>
          </div>
          <div className="grid max-h-[min(70dvh,42rem)] gap-3 overflow-y-auto pr-1">
            {riderVehicles.length ? riderVehicles.map((vehicle) => {
              const rider = riderProfiles.find((item) => item.rider_id === vehicle.rider_id);
              const person = profiles.find((item) => item.id === vehicle.rider_id);
              const verified = vehicle.verification_status === "verified";
              const canVerify = Boolean(rider?.live_selfie_path && rider.verification_status === "verified");
              return (
                <article className="rounded-2xl border border-border bg-muted/55 p-3 transition hover:bg-muted/80" key={vehicle.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black capitalize">{getVehicleLabel(vehicle.vehicle_type)}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                    </div>
                    <ReviewBadge status={vehicle.verification_status} />
                  </div>
                  <div className="mt-3 grid gap-2 rounded-xl bg-card p-3 text-xs sm:grid-cols-2">
                    <div><p className="font-bold uppercase tracking-[0.12em] text-muted-foreground">Registration</p><p className="mt-1 truncate text-base font-black">{vehicle.registration_number}</p></div>
                    <div><p className="font-bold uppercase tracking-[0.12em] text-muted-foreground">Rider</p><p className="mt-1 truncate text-base font-black">{person?.full_name ?? vehicle.rider_id.slice(0, 8)}</p></div>
                  </div>
                  {rider?.active_vehicle_type === vehicle.vehicle_type ? <p className="mt-2 rounded-xl bg-lime-100 px-3 py-2 text-xs font-black text-lime-800">Currently active for matching</p> : null}
                  {!canVerify ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Identity must be approved before this vehicle can be verified.</p> : null}
                  {vehicle.rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{vehicle.rejection_reason}</p> : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button disabled={!canVerify || verified} onClick={() => void onUpdateVehicle(vehicle.id, "verified")} size="sm">{verified ? "Verified" : "Verify"}</Button>
                    <Button onClick={() => void onUpdateVehicle(vehicle.id, "rejected")} size="sm" variant="outline">Reject</Button>
                  </div>
                </article>
              );
            }) : <VerificationEmpty text="No vehicles submitted yet." />}
          </div>
        </Card>
      </div>
    </section>
  );
}

function VerificationStat({ label, tone, value }: { label: string; tone: "amber" | "green"; value: number }) {
  const toneClass = tone === "green" ? "bg-lime-100 text-lime-800" : "bg-amber-100 text-amber-800";
  return <div className={`rounded-2xl p-3 ${toneClass}`}><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{label}</p></div>;
}

function VerificationEmpty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{text}</p>;
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






