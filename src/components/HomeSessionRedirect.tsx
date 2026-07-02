"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser, getProfile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export function HomeSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    void getCurrentUser(supabase).then(async (user) => {
      if (!user || !active) return;
      const profile = await getProfile(supabase, user.id);
      if (!profile || !active) return;
      const destination =
        profile.role === "admin"
          ? "/dashboard/admin"
          : profile.role === "rider"
            ? "/dashboard/rider"
            : "/dashboard/user";
      router.replace(destination);
    });

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}