"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Clock3, Megaphone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";
import type { AdminBroadcast } from "@/types/database";

const audienceOptions = ["all", "users", "riders"] as const;

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
    <Card className="rounded-[1.5rem] p-0" id="admin-notifications">
      <div className="grid overflow-hidden lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.7fr)]">
        <div className="bg-[#0b1510] p-5 text-white sm:p-6">
          <CardHeader className="mb-5 p-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-[#07110d]"><Megaphone className="size-6" /></span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase text-white/70">Broadcast</span>
            </div>
            <CardTitle className="text-2xl font-black text-white">Notification command</CardTitle>
            <CardDescription className="text-white/60">Send operational alerts, maintenance notes, or service updates instantly.</CardDescription>
          </CardHeader>

          <div className="grid gap-3">
            <div>
              <Label className="text-white/70" htmlFor="broadcast-title">Title</Label>
              <Input className="mt-1 h-12 rounded-2xl border-white/10 bg-white text-foreground" id="broadcast-title" maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Service update" value={title} />
            </div>
            <div>
              <Label className="text-white/70" htmlFor="broadcast-body">Message</Label>
              <textarea className="mt-1 min-h-32 w-full rounded-2xl border border-white/10 bg-white p-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-lime-300" id="broadcast-body" maxLength={500} onChange={(event) => setBody(event.target.value)} placeholder="Write the notification users should receive..." value={body} />
            </div>
            <div>
              <Label className="text-white/70">Audience</Label>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-1">
                {audienceOptions.map((item) => <button className={audience === item ? "rounded-xl bg-lime-300 px-3 py-2 text-sm font-black text-[#07110d]" : "rounded-xl px-3 py-2 text-sm font-bold text-white/70"} key={item} onClick={() => setAudience(item)} type="button">{item}</button>)}
              </div>
            </div>
            <Button className="h-12 rounded-2xl bg-lime-300 text-[#07110d] hover:bg-lime-200" disabled={sending} onClick={() => void send()}><Send className="size-4" />{sending ? "Sending..." : "Send notification"}</Button>
            {message ? <p aria-live="polite" className="rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white/80">{message}</p> : null}
          </div>
        </div>

        <div className="bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-black">Recent broadcasts</p><p className="text-xs text-muted-foreground">Last admin messages sent</p></div><BellRing className="size-5 text-primary" /></div>
          <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
            {broadcasts.length ? broadcasts.map((item) => <div className="rounded-2xl border border-border bg-muted/60 p-3" key={item.id}><div className="flex justify-between gap-2"><p className="truncate font-black">{item.title}</p><span className="shrink-0 rounded-full bg-card px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">{item.audience}</span></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p><p className="mt-3 flex items-center gap-1 text-xs font-bold text-muted-foreground"><Clock3 className="size-3" /> {item.delivered_count} delivered | {new Date(item.created_at).toLocaleString()}</p></div>) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No broadcasts sent yet.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}
