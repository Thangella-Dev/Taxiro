import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Profile, UserRole, VehicleType } from "@/types/database";

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
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_number?: string;
    vehicle_type?: VehicleType;
    license_number?: string;
  };
  const requestedRole = metadata.role ?? fallbackRole;
  const safeRole: UserRole =
    requestedRole === "rider" || requestedRole === "user" ? requestedRole : "user";
  const profile = {
    full_name: metadata.full_name?.trim() || "Taxiro user",
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
export async function ensureInitialRiderVehicle(
  supabase: SupabaseClient,
  user: User,
) {
  const metadata = user.user_metadata as {
    license_number?: string;
    role?: UserRole;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_number?: string;
    vehicle_type?: VehicleType;
  };
  if (metadata.role !== "rider") return;

  const vehicleType = metadata.vehicle_type;
  const make = metadata.vehicle_make?.trim();
  const model = metadata.vehicle_model?.trim();
  const registrationNumber = metadata.vehicle_number?.trim().toUpperCase();
  if (!vehicleType || !make || !model || !registrationNumber) return;

  const { data: existing } = await supabase
    .from("rider_vehicles")
    .select("id")
    .eq("rider_id", user.id)
    .eq("vehicle_type", vehicleType)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("rider_vehicles").insert({
      make,
      model,
      registration_number: registrationNumber,
      rider_id: user.id,
      vehicle_type: vehicleType,
    });
    if (error) throw error;
  }

  if (metadata.license_number) {
    const { error } = await supabase.from("rider_profiles").upsert({
      license_number: metadata.license_number.trim().toUpperCase(),
      rider_id: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
export async function uploadRiderLivePhoto(
  supabase: SupabaseClient,
  riderId: string,
  photo: Blob,
) {
  const path = riderId + "/live-selfie-" + Date.now() + ".jpg";
  const { error: uploadError } = await supabase.storage.from("rider-verification").upload(path, photo, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("rider_profiles").upsert({
    live_selfie_captured_at: new Date().toISOString(),
    live_selfie_path: path,
    rider_id: riderId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return path;
}