"use client";

import { useEffect } from "react";

export function useLiveResync({
  enabled,
  intervalMs = 8000,
  onResync,
}: {
  enabled: boolean;
  intervalMs?: number;
  onResync: () => Promise<void> | void;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const resync = () => {
      if (!cancelled) {
        void onResync();
      }
    };
    const resyncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        resync();
      }
    };

    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resyncWhenVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        resync();
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resyncWhenVisible);
    };
  }, [enabled, intervalMs, onResync]);
}