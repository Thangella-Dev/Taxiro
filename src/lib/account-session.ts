"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { isAuthOrPermissionError } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const DEVICE_KEY = "taxiro-active-device-v2";
const LEGACY_DEVICE_KEY = "taxiro-active-device-v1";
let memoryDeviceId: string | null = null;

type AccountSession = {
  profile_id: string;
  device_id: string;
  claimed_at: string;
  last_seen_at: string;
};

function getStoredDeviceId() {
  if (memoryDeviceId) return memoryDeviceId;
  try {
    const current = window.localStorage.getItem(DEVICE_KEY);
    if (current) return (memoryDeviceId = current);
    const created = "taxiro-" + crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, created);
    return (memoryDeviceId = created);
  } catch {
    return (memoryDeviceId = "taxiro-" + crypto.randomUUID());
  }
}

function readSessionId(session: Session | null) {
  if (!session?.access_token) return null;
  try {
    const payload = session.access_token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as {
      session_id?: string;
    };
    return decoded.session_id?.trim() || null;
  } catch {
    return null;
  }
}

function getLegacyDeviceId() {
  try {
    return window.localStorage.getItem(LEGACY_DEVICE_KEY);
  } catch {
    return null;
  }
}

async function getAuthenticatedDeviceId(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  return readSessionId(data.session) ?? getStoredDeviceId();
}

export async function establishSingleDeviceSession(
  supabase: SupabaseClient,
  userId: string,
) {
  const deviceId = await getAuthenticatedDeviceId(supabase);
  await supabase.auth.signOut({ scope: "others" });
  const { error } = await supabase.rpc("claim_account_session", {
    p_device_id: deviceId,
  });
  if (isAuthOrPermissionError(error)) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error("Your session could not be verified. Please sign in again.");
  }
  if (error) throw error;
  return { deviceId, userId };
}

async function validateDeviceClaim(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
) {
  const { data, error } = await supabase
    .from("account_sessions")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();

  if (isAuthOrPermissionError(error)) return false;
  if (error) return true;

  const claim = data as AccountSession | null;
  if (!claim) {
    const { error: claimError } = await supabase.rpc("claim_account_session", {
      p_device_id: deviceId,
    });
    if (isAuthOrPermissionError(claimError)) return false;
    return !claimError;
  }
  if (claim.device_id !== deviceId) {
    const legacyDeviceId = getLegacyDeviceId();
    if (legacyDeviceId && claim.device_id === legacyDeviceId) {
      const { error: upgradeError } = await supabase.rpc("claim_account_session", {
        p_device_id: deviceId,
      });
      if (isAuthOrPermissionError(upgradeError)) return false;
      return !upgradeError;
    }
    return false;
  }
  const { error: touchError } = await supabase.rpc("touch_account_session", {
    p_device_id: deviceId,
  });
  return !isAuthOrPermissionError(touchError);
}

export function useSingleDeviceSession(enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const client = supabase;

    let active = true;
    let channel: ReturnType<typeof client.channel> | null = null;
    let deviceId: string | null = null;

    async function endReplacedSession() {
      if (!active) return;
      active = false;
      await client.auth.signOut({ scope: "local" });
      router.replace("/auth?reason=session-replaced");
      router.refresh();
    }

    async function validateCurrentSession() {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || !active) return true;
      deviceId = readSessionId(data.session) ?? deviceId ?? getStoredDeviceId();
      const valid = await validateDeviceClaim(client, userId, deviceId);
      if (!valid) await endReplacedSession();
      return valid;
    }

    async function initialize() {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || !active) return;

      deviceId = readSessionId(data.session) ?? getStoredDeviceId();
      if (!(await validateDeviceClaim(client, userId, deviceId))) {
        await endReplacedSession();
        return;
      }

      channel = client
        .channel("account-session-" + userId)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: "profile_id=eq." + userId,
            schema: "public",
            table: "account_sessions",
          },
          (payload) => {
            const incoming = payload.new as Partial<AccountSession>;
            if (deviceId && incoming.device_id && incoming.device_id !== deviceId) {
              void endReplacedSession();
            }
          },
        )
        .subscribe();
    }

    void initialize();
    const validateOnResume = () => {
      if (document.visibilityState === "visible") void validateCurrentSession();
    };
    const interval = window.setInterval(() => void validateCurrentSession(), 30_000);
    document.addEventListener("visibilitychange", validateOnResume);
    window.addEventListener("online", validateOnResume);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", validateOnResume);
      window.removeEventListener("online", validateOnResume);
      if (channel) void client.removeChannel(channel);
    };
  }, [enabled, router]);
}
