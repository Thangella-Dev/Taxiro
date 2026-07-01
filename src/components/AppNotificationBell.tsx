"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ShieldAlert, X } from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

export function AppNotificationBell({
  className,
  profileId,
}: {
  className?: string;
  profileId: string | null;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!profileId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications((data as AppNotification[]) ?? []);
  }, [profileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadNotifications(), 0);
    if (!profileId) return () => window.clearTimeout(timer);
    const supabase = getSupabase();
    if (!supabase) return () => window.clearTimeout(timer);
    const channel = supabase
      .channel("taxiro-home-notification-bell-" + profileId)
      .on(
        "postgres_changes",
        { event: "*", filter: "profile_id=eq." + profileId, schema: "public", table: "app_notifications" },
        () => void loadNotifications(),
      )
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, profileId]);

  async function markRead(notificationId: string) {
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
    }
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: new Date().toISOString() }
          : notification,
      ),
    );
  }

  async function markAllRead() {
    if (!profileId) return;
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .is("read_at", null);
    }
    await loadNotifications();
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className={cn("relative", className)}>
      <button
        aria-label="Open notifications"
        className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur transition active:scale-95 sm:size-11"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Bell className="size-4 text-primary sm:size-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-5 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[1800] w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 p-3">
            <div>
              <p className="font-black">Notifications</p>
              <p className="text-xs text-muted-foreground">Swipe left or tap X to clear</p>
            </div>
            <button aria-label="Mark all notifications read" className="flex size-9 items-center justify-center rounded-xl bg-card text-primary" onClick={() => void markAllRead()} type="button">
              <CheckCheck className="size-4" />
            </button>
          </div>
          <div className="grid max-h-[26rem] gap-2 overflow-y-auto p-2">
            {notifications.length ? notifications.map((notification) => (
              <SwipeNotificationCard key={notification.id} notification={notification} onDismiss={() => void markRead(notification.id)} />
            )) : (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SwipeNotificationCard({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: () => void;
}) {
  const startXRef = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startXRef.current = event.clientX;
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    const delta = event.clientX - startXRef.current;
    setOffset(Math.min(0, Math.max(-96, delta)));
  }

  function onPointerUp() {
    if (offset < -64) onDismiss();
    setOffset(0);
    startXRef.current = null;
  }

  const content = (
    <div
      className={cn(
        "rounded-2xl border p-3 text-sm transition-transform touch-pan-y",
        notification.read_at ? "border-border bg-card" : "border-red-200 bg-red-50",
      )}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translateX(${offset}px)` }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", notification.category === "safety" ? "text-red-600" : "text-primary")} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-black">{notification.title}</p>
          <p className="mt-1 line-clamp-3 text-muted-foreground">{notification.body}</p>
          <p className="mt-2 text-[11px] font-bold text-muted-foreground">
            {new Date(notification.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <button aria-label="Dismiss notification" className="grid size-8 shrink-0 place-items-center rounded-xl bg-white" onClick={onDismiss} type="button">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );

  return notification.related_ride_id ? (
    <Link href={`/rides/${notification.related_ride_id}`} onClick={() => void onDismiss()}>
      {content}
    </Link>
  ) : content;
}
