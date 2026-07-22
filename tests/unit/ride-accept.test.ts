import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { acceptReadyRideWithFallback } from "@/lib/ride-accept";

describe("acceptReadyRideWithFallback", () => {
  it("falls back to a direct ride update when the RPC is denied", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied for function accept_ready_ride" },
    });

    const updateRideRequests = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "ride-1", status: "assigned" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const updateRiderLocations = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const insertStatusEvent = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      rpc,
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "ride_requests") {
          return {
            update: updateRideRequests,
          };
        }

        if (table === "rider_locations") {
          return {
            update: updateRiderLocations,
          };
        }

        if (table === "ride_status_events") {
          return {
            insert: insertStatusEvent,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const result = await acceptReadyRideWithFallback(supabase, {
      rideId: "ride-1",
      riderId: "rider-1",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("ride-1");
    expect(rpc).toHaveBeenCalledOnce();
    expect(updateRideRequests).toHaveBeenCalledOnce();
    expect(insertStatusEvent).toHaveBeenCalledOnce();
  });
});
