"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, MessageCircle, Send, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import type { RideChatMessage, RideRequest } from "@/types/database";

export function RideChatPanel({
  currentUserId,
  ride,
}: {
  currentUserId: string | null;
  ride: RideRequest;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<RideChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const canChat = useMemo(
    () => Boolean(currentUserId && ride.assigned_rider_id && ["assigned", "started"].includes(ride.status)),
    [currentUserId, ride.assigned_rider_id, ride.status],
  );
  const participantRole = currentUserId === ride.user_id ? "user" : "rider";
  const phase = ride.status === "started" ? "trip" : "pickup";
  const quickMessages = getQuickMessages(participantRole, phase);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !canChat) {
      return;
    }

    const client = supabase;
    let alive = true;

    async function loadMessages() {
      const { data, error } = await client
        .from("ride_chat_messages")
        .select("*")
        .eq("ride_id", ride.id)
        .order("created_at", { ascending: true });

      if (!alive) return;
      if (error) {
        setStatus(error.message);
        return;
      }
      setMessages((data as RideChatMessage[]) ?? []);
      setStatus("");
    }

    void loadMessages();

    function reloadWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadMessages();
      }
    }

    window.addEventListener("online", loadMessages);
    document.addEventListener("visibilitychange", reloadWhenVisible);

    const channel = client
      .channel(`ride-chat-${ride.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_chat_messages", filter: `ride_id=eq.${ride.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<RideChatMessage>;
            if (deleted.id) {
              setMessages((current) => current.filter((message) => message.id !== deleted.id));
            }
            return;
          }

          const incoming = payload.new as RideChatMessage;
          setMessages((current) => {
            const exists = current.some((item) => item.id === incoming.id);
            const next = exists
              ? current.map((item) => (item.id === incoming.id ? incoming : item))
              : [...current, incoming];
            return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
          setStatus("");
        },
      )
      .subscribe((realtimeStatus) => {
        if (realtimeStatus === "SUBSCRIBED") setStatus("Live");
        if (realtimeStatus === "CHANNEL_ERROR" || realtimeStatus === "TIMED_OUT") {
          setStatus("Reconnecting live chat...");
        }
      });

    return () => {
      alive = false;
      window.removeEventListener("online", loadMessages);
      document.removeEventListener("visibilitychange", reloadWhenVisible);
      void client.removeChannel(channel);
    };
  }, [canChat, ride.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(message = draft) {
    const body = message.trim();
    if (!body || !currentUserId || !canChat || sending) return;

    const supabase = getSupabase();
    if (!supabase) return;

    setDraft("");
    setSending(true);
    const { data, error } = await supabase
      .from("ride_chat_messages")
      .insert({
        body,
        ride_id: ride.id,
        sender_id: currentUserId,
      })
      .select("*")
      .single();

    if (data) {
      const sent = data as RideChatMessage;
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
    }
    setStatus(error ? error.message : "Sent");
    setSending(false);
  }

  if (!canChat) {
    return null;
  }

  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-black">{phase === "pickup" ? "Pickup chat" : "Trip chat"}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {phase === "pickup"
                ? "Use this for landmarks, arrival updates, and code handoff."
                : "Use this only for route, stop, or drop-off updates."}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
          <ShieldCheck className="size-3" /> Live
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {quickMessages.map((message) => (
          <button
            className="max-w-full rounded-full border border-border bg-muted px-3 py-2 text-left text-xs font-bold text-foreground transition hover:bg-secondary"
            key={message}
            onClick={() => void sendMessage(message)}
            type="button"
          >
            {message}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="grid max-h-56 gap-2 overflow-y-auto pr-1">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            const label = message.sender_id === ride.user_id ? "User" : "Rider";
            return (
              <div className={mine ? "ml-auto max-w-[84%]" : "mr-auto max-w-[84%]"} key={message.id}>
                <p className={mine ? "mb-1 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground" : "mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"}>
                  {mine ? "You" : label}
                </p>
                <div className={mine ? "rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground" : "rounded-2xl rounded-bl-md bg-muted px-3 py-2"}>
                  <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
                </div>
                <p className={mine ? "mt-1 flex justify-end gap-1 text-[10px] text-muted-foreground" : "mt-1 text-[10px] text-muted-foreground"}>
                  {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine ? <CheckCheck className="size-3" /> : null}
                </p>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">No messages yet.</p>
            <p className="mt-1 leading-5">Start with a quick message so both sides know pickup and route details clearly.</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          aria-label="Ride chat message"
          className="h-11 rounded-full"
          disabled={sending}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={phase === "pickup" ? "Message about pickup or code" : "Message about route or drop"}
          value={draft}
        />
        <Button aria-label="Send message" className="size-11 shrink-0 rounded-full p-0" disabled={sending || !draft.trim()} onClick={() => void sendMessage()}>
          <Send className="size-4" />
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{draft.length}/500</span>
        {status ? <span className={status === "Sent" || status === "Live" ? "text-muted-foreground" : "text-destructive"}>{status}</span> : null}
      </div>
    </section>
  );
}

function getQuickMessages(role: "user" | "rider", phase: "pickup" | "trip") {
  if (phase === "pickup" && role === "user") {
    return ["I am at the pickup point", "I will share the code when you arrive", "Please call when you reach"];
  }
  if (phase === "pickup") {
    return ["I am on the way", "I have reached pickup", "Please share the 4 digit code"];
  }
  if (role === "user") {
    return ["Please follow the shown route", "Drop me at the marked location", "I need a short stop"];
  }
  return ["Trip started", "Traffic ahead, ETA may change", "We are near the destination"];
}



