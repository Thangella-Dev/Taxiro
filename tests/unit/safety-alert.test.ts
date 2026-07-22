import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSafetyAlertWithSupabase } from "@/lib/safety";

describe("createSafetyAlert", () => {
  it("falls back to a direct insert when the RPC is denied", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied for function create_safety_alert" },
    });

    const insertSafetyAlert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "alert-1",
            delivery_status: "unlinked",
            ride_id: "ride-1",
          },
          error: null,
        }),
      }),
    });

    const selectRideStatus = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { status: "assigned" },
          error: null,
        }),
      }),
    });

    const selectProfile = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { emergency_contact_phone: null },
          error: null,
        }),
      }),
    });

    const insertStatusEvent = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "ride_requests") {
          return {
            select: selectRideStatus,
          };
        }

        if (table === "profiles") {
          return {
            select: selectProfile,
          };
        }

        if (table === "safety_alerts") {
          return {
            insert: insertSafetyAlert,
          };
        }

        if (table === "ride_status_events") {
          return {
            insert: insertStatusEvent,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    } as unknown as SupabaseClient;

    const result = await createSafetyAlertWithSupabase(supabase, {
      alertType: "late_trip",
      location: { lat: 12.9716, lng: 77.5946, accuracy_m: 10 },
      message: "Late trip detected",
      rideId: "ride-1",
    });

    expect(result.error).toBeNull();
    expect(result.alert?.id).toBe("alert-1");
    expect(rpc).toHaveBeenCalledOnce();
    expect(insertSafetyAlert).toHaveBeenCalledOnce();
    expect(insertStatusEvent).toHaveBeenCalledOnce();
  });
});
