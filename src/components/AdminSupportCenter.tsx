"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Headphones, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import type { SupportTicket } from "@/types/database";

export function AdminSupportCenter({ adminId, onChanged, onMessage, tickets }: {
  adminId: string;
  onChanged: () => Promise<void>;
  onMessage: (message: string) => void;
  tickets: SupportTicket[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});

  async function updateTicket(ticket: SupportTicket, status: SupportTicket["status"]) {
    const supabase = getSupabase();
    if (!supabase) return;
    const resolutionText = resolution[ticket.id]?.trim() || null;
    if (status === "resolved" && !resolutionText) {
      onMessage("Add a resolution before resolving the ticket.");
      return;
    }

    setBusyId(ticket.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("support_tickets").update({
      assigned_to: adminId,
      resolution: resolutionText ?? ticket.resolution,
      resolved_at: status === "resolved" ? now : null,
      status,
      updated_at: now,
    }).eq("id", ticket.id);

    if (!error) {
      await supabase.from("admin_audit_logs").insert({
        action: "support_ticket_" + status,
        admin_id: adminId,
        entity_id: ticket.id,
        entity_type: "support_ticket",
        metadata: { previous_status: ticket.status },
      });
      await onChanged();
    }
    setBusyId(null);
    onMessage(error ? error.message : "Ticket marked " + status.replace("_", " ") + ".");
  }

  const active = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  return (
    <section className="grid gap-4" id="admin-support">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary icon={Headphones} label="Open cases" value={active.length} />
        <Summary icon={ShieldAlert} label="Urgent" value={tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length} />
        <Summary icon={CheckCircle2} label="Resolved" value={tickets.filter((ticket) => ticket.status === "resolved").length} />
      </div>
      <Card className="rounded-2xl p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Support operations</p>
          <h2 className="mt-1 text-2xl font-black">Customer and rider cases</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assign, investigate, resolve, and preserve an admin audit trail.</p>
        </div>
        <div className="grid gap-3">
          {tickets.length ? tickets.map((ticket) => (
            <article className="rounded-xl border border-border bg-muted/60 p-4" key={ticket.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{ticket.status.replace("_", " ")}</Badge>
                    <span className="rounded-md bg-card px-2 py-1 text-[10px] font-black uppercase">{ticket.priority}</span>
                    <span className="text-xs font-bold uppercase text-muted-foreground">{ticket.category}</span>
                  </div>
                  <h3 className="mt-2 font-black">{ticket.subject}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">#{ticket.id.slice(0, 8)} | {new Date(ticket.created_at).toLocaleString()}</p>
                </div>
                {ticket.related_ride_id ? <span className="rounded-md bg-card px-2 py-1 text-xs font-black">Ride {ticket.related_ride_id.slice(0, 8)}</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{ticket.description}</p>
              <textarea
                className="mt-3 min-h-20 w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                maxLength={2000}
                onChange={(event) => setResolution((current) => ({ ...current, [ticket.id]: event.target.value }))}
                placeholder="Investigation notes or final resolution"
                value={resolution[ticket.id] ?? ticket.resolution ?? ""}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busyId === ticket.id} onClick={() => void updateTicket(ticket, "in_progress")} size="sm" variant="outline"><Clock3 className="size-4" />Investigating</Button>
                <Button disabled={busyId === ticket.id} onClick={() => void updateTicket(ticket, "waiting_user")} size="sm" variant="outline">Waiting user</Button>
                <Button disabled={busyId === ticket.id} onClick={() => void updateTicket(ticket, "resolved")} size="sm"><CheckCircle2 className="size-4" />Resolve</Button>
              </div>
            </article>
          )) : <div className="rounded-xl bg-muted p-8 text-center text-sm text-muted-foreground">No support tickets are visible. Apply the latest migration before testing this queue.</div>}
        </div>
      </Card>
    </section>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Headphones; label: string; value: number }) {
  return <Card className="rounded-xl p-4"><Icon className="size-5" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-sm font-bold text-muted-foreground">{label}</p></Card>;
}