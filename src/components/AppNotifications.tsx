"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";
import type { AppNotification } from "@/types/database";

export function AppNotifications({ profileId }: { profileId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!profileId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    const { data } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(6);
    setNotifications((data as AppNotification[]) ?? []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadNotifications(), 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (!profileId) return undefined;
    const supabase = getSupabase();
    if (!supabase) return undefined;

    const channel = supabase
      .channel(`taxiro-notifications-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", filter: `profile_id=eq.${profileId}`, schema: "public", table: "app_notifications" },
        () => void loadNotifications(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, profileId]);

  async function markAllRead() {
    if (!profileId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("read_at", null);
    await loadNotifications();
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <section className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-black">
            <Bell className="size-4" />
            Notifications
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount ? `${unreadCount} unread safety or ride update${unreadCount === 1 ? "" : "s"}` : "No unread alerts"}
          </p>
        </div>
        {unreadCount ? (
          <Button className="h-9 shrink-0 rounded-lg" onClick={markAllRead} size="sm" variant="outline">
            Mark read
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {loading ? (
          <p className="rounded-lg bg-card p-3 text-sm text-muted-foreground">Loading notifications...</p>
        ) : notifications.length ? (
          notifications.map((notification) => (
            <div
              className={`rounded-lg border p-3 text-sm ${notification.read_at ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}
              key={notification.id}
            >
              <p className="flex items-start gap-2 font-black">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="min-w-0">{notification.title}</span>
              </p>
              <p className="mt-1 line-clamp-3 text-muted-foreground">{notification.body}</p>
              <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                {new Date(notification.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            Emergency-contact alerts and important ride updates will appear here.
          </p>
        )}
      </div>
    </section>
  );
}