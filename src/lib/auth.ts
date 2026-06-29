import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Profile, UserRole } from "@/types/database";

export async function getCurrentUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return data as Profile | null;
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
  fallbackRole: UserRole = "user",
) {
  const current = await getProfile(supabase, user.id);
  if (current) {
    return current;
  }

  const metadata = user.user_metadata as {
    full_name?: string;
    phone?: string;
    role?: UserRole;
  };
  const requestedRole = metadata.role ?? fallbackRole;
  const safeRole: UserRole =
    requestedRole === "rider" || requestedRole === "user" ? requestedRole : "user";
  const profile = {
    full_name: metadata.full_name ?? user.email ?? "Taxiro user",
    id: user.id,
    phone: metadata.phone ?? null,
    role: safeRole,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}
