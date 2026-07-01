"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import type { SafetyAlert } from "@/types/database";

export function AdminSafetyCenter() {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase.from("safety_alerts").select("*").order("created_at", { ascending: false }).limit(12);
    if (error) setMessage(error.message);
    else setAlerts((data as SafetyAlert[]) ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
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
          <CardDescription>Review SOS, delayed-trip, and route-change alerts with delivery status.</CardDescription>
        </div>
        <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-2xl border border-border text-center text-xs font-black">
          <span className="bg-red-50 px-3 py-2 text-red-700">{openCount} open</span>
          <span className="bg-muted px-3 py-2 text-muted-foreground">{unresolvedCount} active</span>
        </div>
      </CardHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alerts.length ? alerts.map((alert) => {
          const resolved = alert.status === "resolved";
          return (
            <div className={`rounded-2xl border p-4 ${resolved ? "border-border bg-muted/50" : "border-red-100 bg-red-50/70"}`} key={alert.id}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 font-black uppercase"><AlertTriangle className="size-4 text-red-600" /> {alert.alert_type.replace("_", " ")}</p><p className="mt-1 text-xs font-bold text-muted-foreground">Ride {alert.ride_id.slice(0, 8)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${resolved ? "bg-lime-100 text-lime-800" : "bg-card text-red-700"}`}>{alert.status}</span></div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{alert.message}</p>
              <div className="mt-3 grid gap-2 rounded-2xl bg-card p-3 text-xs font-bold text-muted-foreground"><p>Delivery: {alert.delivery_status.replace("_", " ")}</p><p>{new Date(alert.created_at).toLocaleString()}</p>{alert.lat && alert.lng ? <p className="flex items-center gap-1"><MapPin className="size-3" /> {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}</p> : null}</div>
              {alert.status !== "resolved" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => void update(alert.id, "acknowledged")} size="sm" variant="outline">Acknowledge</Button><Button onClick={() => void update(alert.id, "resolved")} size="sm"><CheckCircle2 className="size-4" /> Resolve</Button></div> : null}
            </div>
          );
        }) : <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">No safety alerts recorded.</p>}
      </div>
      {message ? <p aria-live="polite" className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold text-muted-foreground">{message}</p> : null}
    </Card>
  );
}
