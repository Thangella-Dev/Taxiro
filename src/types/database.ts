export type UserRole = "user" | "rider" | "admin";
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
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_number: string | null;
  license_number: string | null;
  upi_id: string | null;
  upi_qr_image_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  rating: number;
  completed_rides: number;
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
  created_at: string;
};
export type LatLng = {
  lat: number;
  lng: number;
  address?: string;
};






