export type UserRole = "user" | "rider" | "admin";
export type VehicleType = "bike" | "auto" | "car" | "hatchback" | "sedan" | "suv";
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
  waiting_charge_per_minute: number;
  free_waiting_minutes: number;
  cancellation_fee: number;
  driver_cancellation_rules: Record<string, unknown>;
  passenger_cancellation_rules: Record<string, unknown>;
  night_charge_type: "none" | "flat" | "percent";
  night_charge_value: number;
  airport_pickup_fee: number;
  toll_charge: number;
  tax_percentage: number;
  company_commission_rate: number;
  dynamic_surge_multiplier: number;
  max_surge_multiplier: number;
  subscription_discount_percentage: number;
  cashback_percentage: number;
  referral_reward_amount: number;
  driver_bonus_pool: number;
  currency: "INR";
  peak_windows: unknown[];
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
};

export type FareCalculationBreakdown = {
  airport_fee: number;
  base_fare: number;
  cashback_amount: number;
  company_commission_rate: number;
  coupon_discount: number;
  currency: "INR";
  distance_charge: number;
  driver_earning: number;
  final_fare: number;
  free_waiting_minutes: number;
  minimum_fare: number;
  night_charge: number;
  platform_commission: number;
  pricing_rule_id: string | null;
  rule_snapshot: Record<string, unknown>;
  service_area_id: string | null;
  subtotal_before_surge: number;
  surge_charge: number;
  surge_multiplier: number;
  tax_amount: number;
  time_charge: number;
  toll_charge: number;
  vehicle_type: VehicleType;
  waiting_charge: number;
  wallet_credit_applied: number;
};

export type SurgeRule = {
  id: string;
  service_area_id: string | null;
  vehicle_type: VehicleType | null;
  surge_type: "morning_peak" | "evening_peak" | "rain" | "holiday" | "festival" | "demand" | "night";
  multiplier: number;
  starts_at: string | null;
  ends_at: string | null;
  weekdays: number[] | null;
  local_start_time: string | null;
  local_end_time: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
};

export type CouponCampaign = {
  id: string;
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  max_discount: number | null;
  min_fare: number;
  service_area_id: string | null;
  allowed_vehicle_types: VehicleType[];
  first_ride_only: boolean;
  usage_limit: number | null;
  per_profile_limit: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  monthly_price: number;
  discount_percentage: number;
  priority_matching: boolean;
  priority_support: boolean;
  free_cancellations_per_month: number;
  benefits: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

export type DriverBonusRule = {
  id: string;
  title: string;
  bonus_type: "daily_rides" | "weekly_rides" | "peak_hour" | "airport" | "night" | "new_driver" | "referral" | "manual";
  vehicle_type: VehicleType | null;
  service_area_id: string | null;
  target_rides: number | null;
  reward_amount: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
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