"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

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
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function update(id: string, status: "acknowledged" | "resolved") {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_update_safety_alert_status", { p_alert_id: id, p_status: status });
    setMessage(error ? error.message : "Safety alert marked " + status + ".");
    if (!error) await load();
  }

  return (
    <Card className="animate-in" id="admin-safety">
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-red-600" /> Safety command</CardTitle><CardDescription>Review SOS, delayed-trip, and route-change alerts with delivery status.</CardDescription></CardHeader>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alerts.length ? alerts.map((alert) => (
          <div className="rounded-lg border border-border bg-muted p-3" key={alert.id}>
            <div className="flex items-center justify-between gap-2"><p className="font-black uppercase">{alert.alert_type.replace("_", " ")}</p><span className="rounded-full bg-card px-2 py-1 text-[10px] font-black uppercase">{alert.status}</span></div>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{alert.message}</p>
            <p className="mt-2 text-xs font-bold">Delivery: {alert.delivery_status.replace("_", " ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ride {alert.ride_id.slice(0, 8)} · {new Date(alert.created_at).toLocaleString()}</p>
            {alert.status !== "resolved" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => void update(alert.id, "acknowledged")} size="sm" variant="outline">Acknowledge</Button><Button onClick={() => void update(alert.id, "resolved")} size="sm">Resolve</Button></div> : null}
          </div>
        )) : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No safety alerts recorded.</p>}
      </div>
      {message ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </Card>
  );
}
