"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";
import type { AdminBroadcast } from "@/types/database";

export function AdminNotificationCenter() {
  const [audience, setAudience] = useState<AdminBroadcast["audience"]>("all");
  const [body, setBody] = useState("");
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");

  const loadBroadcasts = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from("admin_broadcasts").select("*").order("created_at", { ascending: false }).limit(8);
    setBroadcasts((data as AdminBroadcast[]) ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBroadcasts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBroadcasts]);

  async function send() {
    if (title.trim().length < 3 || body.trim().length < 5) {
      setMessage("Add a clear title and notification message.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setSending(true);
    const { data, error } = await supabase.rpc("admin_send_notification", {
      p_audience: audience,
      p_body: body.trim(),
      p_title: title.trim(),
    });
    setSending(false);
    if (error) return setMessage(error.message);
    const sent = data as AdminBroadcast;
    setMessage("Delivered to " + sent.delivered_count + " active account" + (sent.delivered_count === 1 ? "" : "s") + ".");
    setTitle("");
    setBody("");
    await loadBroadcasts();
  }

  return (
    <Card className="animate-in" id="admin-notifications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BellRing className="size-5" /> Notification center</CardTitle>
        <CardDescription>Send service alerts, maintenance notices, or operational updates instantly.</CardDescription>
      </CardHeader>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <div className="grid gap-3 rounded-lg bg-muted p-4">
          <div><Label htmlFor="broadcast-title">Title</Label><Input id="broadcast-title" maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Service update" value={title} /></div>
          <div><Label htmlFor="broadcast-body">Message</Label><textarea className="mt-1 min-h-28 w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring" id="broadcast-body" maxLength={500} onChange={(event) => setBody(event.target.value)} placeholder="Write the notification users should receive..." value={body} /></div>
          <div>
            <Label>Audience</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["all", "users", "riders"] as const).map((item) => <button className={audience === item ? "rounded-md bg-primary px-3 py-2 text-sm font-black text-primary-foreground" : "rounded-md bg-card px-3 py-2 text-sm font-bold"} key={item} onClick={() => setAudience(item)} type="button">{item}</button>)}
            </div>
          </div>
          <Button className="h-11" disabled={sending} onClick={() => void send()}><Send className="size-4" />{sending ? "Sending..." : "Send notification"}</Button>
          {message ? <p aria-live="polite" className="text-sm font-semibold text-muted-foreground">{message}</p> : null}
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-black">Recent broadcasts</p>
          {broadcasts.length ? broadcasts.map((item) => (
            <div className="rounded-lg border border-border bg-card p-3" key={item.id}>
              <div className="flex justify-between gap-2"><p className="truncate font-black">{item.title}</p><span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">{item.audience}</span></div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-xs font-bold">{item.delivered_count} delivered · {new Date(item.created_at).toLocaleString()}</p>
            </div>
          )) : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No broadcasts sent yet.</p>}
        </div>
      </div>
    </Card>
  );
}
