"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, MapPin, Phone, ShieldAlert, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import type { Profile, RideRequest, SafetyAlert } from "@/types/database";

type SafetyAlertView = SafetyAlert & {
  recipientProfile?: Profile | null;
  ride?: RideRequest | null;
  triggeredByProfile?: Profile | null;
};

export function AdminSafetyCenter() {
  const [alerts, setAlerts] = useState<SafetyAlertView[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("safety_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) {
      setMessage(error.message);
      return;
    }

    const baseAlerts = ((data as SafetyAlert[]) ?? []);
    const profileIds = Array.from(new Set(baseAlerts.flatMap((alert) => [alert.triggered_by, alert.recipient_profile_id].filter(Boolean) as string[])));
    const rideIds = Array.from(new Set(baseAlerts.map((alert) => alert.ride_id)));

    const [profileResult, rideResult] = await Promise.all([
      profileIds.length ? supabase.from("profiles").select("*").in("id", profileIds) : Promise.resolve({ data: [] as Profile[], error: null }),
      rideIds.length ? supabase.from("ride_requests").select("*").in("id", rideIds) : Promise.resolve({ data: [] as RideRequest[], error: null }),
    ]);

    if (profileResult.error || rideResult.error) {
      setMessage(profileResult.error?.message ?? rideResult.error?.message ?? "Could not load safety context.");
      return;
    }

    const profileMap = new Map(((profileResult.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
    const rideMap = new Map(((rideResult.data as RideRequest[]) ?? []).map((ride) => [ride.id, ride]));
    setAlerts(baseAlerts.map((alert) => ({
      ...alert,
      recipientProfile: alert.recipient_profile_id ? profileMap.get(alert.recipient_profile_id) ?? null : null,
      ride: rideMap.get(alert.ride_id) ?? null,
      triggeredByProfile: profileMap.get(alert.triggered_by) ?? null,
    })));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const supabase = getSupabase();
    if (!supabase) return () => window.clearTimeout(timer);
    const channel = supabase
      .channel("admin-safety-center-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_alerts" }, () => void load())
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function update(id: string, status: "acknowledged" | "resolved") {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_update_safety_alert_status", { p_alert_id: id, p_status: status });
    setMessage(error ? error.message : "Safety alert marked " + status + ".");
    if (!error) await load();
  }

  const openCount = alerts.filter((alert) => alert.status === "open").length;
  const unresolvedCount = alerts.filter((alert) => alert.status !== "resolved").length;

  return (
    <Card className="rounded-[1.5rem]" id="admin-safety">
      <CardHeader className="mb-5 flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl font-black"><ShieldAlert className="size-6 text-red-600" /> Safety command</CardTitle>
          <CardDescription>SOS alerts now show who sent it, who receives it, and the connected ride context.</CardDescription>
        </div>
        <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-2xl border border-border text-center text-xs font-black">
          <span className="bg-red-50 px-3 py-2 text-red-700">{openCount} open</span>
          <span className="bg-muted px-3 py-2 text-muted-foreground">{unresolvedCount} active</span>
        </div>
      </CardHeader>

      <div className="grid gap-3 xl:grid-cols-2">
        {alerts.length ? alerts.map((alert) => <SafetyAlertCard alert={alert} key={alert.id} onUpdate={update} />) : <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">No safety alerts recorded.</p>}
      </div>
      {message ? <p aria-live="polite" className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold text-muted-foreground">{message}</p> : null}
    </Card>
  );
}

function SafetyAlertCard({ alert, onUpdate }: { alert: SafetyAlertView; onUpdate: (id: string, status: "acknowledged" | "resolved") => Promise<void> }) {
  const resolved = alert.status === "resolved";
  const ride = alert.ride;
  const riderLabel = ride?.assigned_rider_id ? `Rider ${ride.assigned_rider_id.slice(0, 8)}` : "No rider assigned";
  const deliveryLabel = alert.delivery_status === "in_app" ? "Delivered in app" : alert.delivery_status === "no_contact" ? "No emergency contact" : "Emergency contact not linked";

  return (
    <div className={`rounded-2xl border p-4 ${resolved ? "border-border bg-muted/50" : "border-red-100 bg-red-50/70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-black uppercase"><AlertTriangle className="size-4 text-red-600" /> {alert.alert_type.replace("_", " ")}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">Ride {alert.ride_id.slice(0, 8)} | {new Date(alert.created_at).toLocaleString()}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${resolved ? "bg-lime-100 text-lime-800" : "bg-card text-red-700"}`}>{alert.status}</span>
      </div>

      <p className="mt-3 rounded-2xl bg-card p-3 text-sm text-muted-foreground">{alert.message}</p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <ContextBlock icon={UserRound} label="Triggered by" title={alert.triggeredByProfile?.full_name ?? alert.triggered_by.slice(0, 8)} text={alert.triggeredByProfile?.phone ?? "No phone saved"} />
        <ContextBlock icon={ShieldAlert} label="Emergency contact" title={alert.recipientProfile?.full_name ?? "Not linked"} text={`${deliveryLabel}${alert.recipient_phone ? ` | ${alert.recipient_phone}` : ""}`} />
      </div>

      {ride ? (
        <div className="mt-3 grid gap-2 rounded-2xl bg-card p-3 text-sm">
          <p className="font-black">Ride details</p>
          <p className="line-clamp-2 text-muted-foreground"><MapPin className="mr-1 inline size-3" /> Pickup: {ride.pickup_address}</p>
          <p className="line-clamp-2 text-muted-foreground">Drop: {ride.drop_address}</p>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-1 capitalize">{ride.status}</span>
            <span className="rounded-full bg-muted px-2 py-1">{ride.passenger_name ?? "Self ride"}</span>
            <span className="rounded-full bg-muted px-2 py-1"><Phone className="mr-1 inline size-3" />{ride.passenger_phone ?? alert.triggeredByProfile?.phone ?? "No phone"}</span>
            <span className="rounded-full bg-muted px-2 py-1">{riderLabel}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Button asChild size="sm" variant="outline"><Link href={`/rides/${alert.ride_id}`}>Open ride</Link></Button>
        {alert.status !== "resolved" ? <Button onClick={() => void onUpdate(alert.id, "acknowledged")} size="sm" variant="outline">Acknowledge</Button> : null}
        {alert.status !== "resolved" ? <Button onClick={() => void onUpdate(alert.id, "resolved")} size="sm"><CheckCircle2 className="size-4" /> Resolve</Button> : null}
      </div>
    </div>
  );
}

function ContextBlock({ icon: Icon, label, text, title }: { icon: typeof UserRound; label: string; text: string; title: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-card p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground"><Icon className="size-3" /> {label}</p>
      <p className="mt-2 truncate font-black">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
