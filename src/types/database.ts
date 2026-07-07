export type UserRole = "user" | "rider" | "admin";
export type VehicleType = "bike" | "auto" | "car";
export type RideStatus =
  | "scheduled"
  | "ready"
  | "assigned"
  | "started"
  | "completed"
  | "cancelled";
export type RiderRouteStatus = "active" | "expired" | "completed";

export type Profile = {
  id: string;
  role: UserRole;
  account_status: "active" | "suspended";
  full_name: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string;
  created_at: string;
};

export type RideRequest = {
  id: string;
  user_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  drop_lat: number;
  drop_lng: number;
  drop_address: string;
  scheduled_time: string;
  status: RideStatus;
  assigned_rider_id: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  distance_km: number | null;
  estimated_duration_min: number | null;
  fare_estimate: number | null;
  fare_rate_per_km: number | null;
  vehicle_surcharge_per_km: number;
  vehicle_type: VehicleType;
  service_area_id: string | null;
  pricing_rule_id: string | null;
  fare_pricing_period: "standard" | "morning_peak" | "evening_peak" | "night_peak" | null;
  company_commission: number | null;
  rider_earning: number | null;
  booking_for: "self" | "other";
  passenger_name: string | null;
  passenger_phone: string | null;
  payment_method: "cash" | "upi";
  payment_status: "pending" | "awaiting_payment" | "paid";
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  rider_note: string | null;
  ready_at: string | null;
  ready_expires_at: string | null;
  ready_signal_minutes: number | null;
  cancellation_reason: string | null;
  cancellation_fee: number | null;
  cancellation_fee_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  passenger_count: number;
  created_at: string;
};

export type RideConfirmationCode = {
  ride_id: string;
  user_id: string;
  code: string;
  used_at: string | null;
  created_at: string;
};

export type RiderLocation = {
  rider_id: string;
  lat: number;
  lng: number;
  is_available: boolean;
  accuracy_m: number | null;
  heading: number | null;
  speed: number | null;
  last_seen_at: string | null;
  updated_at: string;
};

export type RiderRoute = {
  id: string;
  rider_id: string;
  from_lat: number;
  from_lng: number;
  from_address: string;
  to_lat: number;
  to_lng: number;
  to_address: string;
  start_time: string;
  end_time: string;
  status: RiderRouteStatus;
  route_polyline: string | null;
  created_at: string;
};

export type RiderProfile = {
  rider_id: string;
  active_vehicle_type: VehicleType | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_number: string | null;
  license_number: string | null;
  live_selfie_path: string | null;
  live_selfie_captured_at: string | null;
  identity_rejection_reason: string | null;
  upi_id: string | null;
  upi_qr_image_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  rating: number;
  completed_rides: number;
  updated_at: string;
};


export type AssignedRiderDetails = {
  rider_id: string;
  full_name: string | null;
  phone: string | null;
  vehicle_type: VehicleType;
  vehicle_make: string;
  vehicle_model: string;
  registration_number: string;
  rating: number | null;
  completed_rides: number;
  photo_path: string | null;
};
export type RiderVehicle = {
  id: string;
  rider_id: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  registration_number: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};
export type RideChatMessage = {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type RideRating = {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type SafetyAlertType = "sos" | "late_trip" | "route_changed";
export type SafetyAlertStatus = "open" | "acknowledged" | "resolved";

export type SafetyAlert = {
  id: string;
  ride_id: string;
  triggered_by: string;
  recipient_profile_id: string | null;
  recipient_phone: string | null;
  delivery_status: "no_contact" | "unlinked" | "in_app";
  alert_type: SafetyAlertType;
  message: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  status: SafetyAlertStatus;
  resolved_at: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  related_ride_id: string | null;
  safety_alert_id: string | null;
  read_at: string | null;
  category: "system" | "ride" | "safety" | "admin";
  created_by: string | null;
  created_at: string;
};
export type LatLng = {
  lat: number;
  lng: number;
  address?: string;
};
export type AdminBroadcast = {
  id: string;
  created_by: string;
  title: string;
  body: string;
  audience: "all" | "users" | "riders";
  delivered_count: number;
  created_at: string;
};
export type SupportTicket = {
  id: string;
  created_by: string;
  related_ride_id: string | null;
  assigned_to: string | null;
  category: "account" | "ride" | "payment" | "safety" | "rider" | "technical" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
  subject: string;
  description: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type SavedPlace = {
  id: string;
  profile_id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
};
export type ServiceArea = {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  supported_vehicle_types: VehicleType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingRule = {
  id: string;
  service_area_id: string | null;
  vehicle_type: VehicleType;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  company_commission_rate: number;
  peak_windows: unknown[];
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
};

export type FraudSignal = {
  id: string;
  profile_id: string | null;
  ride_id: string | null;
  signal_type: "impossible_speed" | "location_jump" | "mock_location" | "repeat_cancellation" | "payment_dispute" | "account_abuse" | "other";
  severity: "low" | "medium" | "high" | "critical";
  evidence: Record<string, unknown>;
  status: "open" | "reviewing" | "dismissed" | "confirmed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};