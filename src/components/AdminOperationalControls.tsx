"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  Gift,
  MapPinned,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getSupabase } from "@/lib/supabase";
import { CUSTOMER_VEHICLE_TYPES, getVehicleLabel } from "@/lib/vehicles";
import type {
  CouponCampaign,
  DriverBonusRule,
  FraudSignal,
  PricingRule,
  ServiceArea,
  SubscriptionPlan,
  SurgeRule,
  VehicleType,
} from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onMessage: (message: string) => void;
};

const vehicleTypes = [...CUSTOMER_VEHICLE_TYPES];
const surgeTypes: SurgeRule["surge_type"][] = [
  "morning_peak",
  "evening_peak",
  "rain",
  "holiday",
  "festival",
  "demand",
  "night",
];

export function AdminOperationalControls({ onMessage }: Props) {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [coupons, setCoupons] = useState<CouponCampaign[]>([]);
  const [fraudSignals, setFraudSignals] = useState<FraudSignal[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [surgeRules, setSurgeRules] = useState<SurgeRule[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([]);
  const [bonusRules, setBonusRules] = useState<DriverBonusRule[]>([]);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [areaName, setAreaName] = useState("Hyderabad core");
  const [centerLat, setCenterLat] = useState("17.385");
  const [centerLng, setCenterLng] = useState("78.4867");
  const [radiusKm, setRadiusKm] = useState("35");
  const [supportedVehicles, setSupportedVehicles] = useState<VehicleType[]>([...vehicleTypes]);

  const [ruleAreaId, setRuleAreaId] = useState("");
  const [ruleVehicle, setRuleVehicle] = useState<VehicleType>("bike");
  const [baseFare, setBaseFare] = useState("");
  const [perKmRate, setPerKmRate] = useState("");
  const [perMinuteRate, setPerMinuteRate] = useState("");
  const [minimumFare, setMinimumFare] = useState("");
  const [waitingCharge, setWaitingCharge] = useState("");
  const [freeWaitingMinutes, setFreeWaitingMinutes] = useState("");
  const [cancellationFee, setCancellationFee] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [surgeCap, setSurgeCap] = useState("1.5");
  const [nightChargeType, setNightChargeType] = useState<PricingRule["night_charge_type"]>("none");
  const [nightChargeValue, setNightChargeValue] = useState("0");
  const [airportFee, setAirportFee] = useState("0");
  const [tollCharge, setTollCharge] = useState("0");
  const [taxPercentage, setTaxPercentage] = useState("0");
  const [subscriptionDiscount, setSubscriptionDiscount] = useState("0");
  const [cashbackPercentage, setCashbackPercentage] = useState("0");
  const [referralReward, setReferralReward] = useState("0");
  const [driverBonusPool, setDriverBonusPool] = useState("0");
  const [previewFare, setPreviewFare] = useState("200");

  const [surgeAreaId, setSurgeAreaId] = useState("");
  const [surgeVehicle, setSurgeVehicle] = useState<VehicleType | "all">("all");
  const [surgeType, setSurgeType] = useState<SurgeRule["surge_type"]>("demand");
  const [surgeMultiplier, setSurgeMultiplier] = useState("1.2");
  const [surgeStartTime, setSurgeStartTime] = useState("");
  const [surgeEndTime, setSurgeEndTime] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"flat" | "percent">("flat");
  const [couponValue, setCouponValue] = useState("");
  const [couponMax, setCouponMax] = useState("");
  const [couponMinFare, setCouponMinFare] = useState("0");

  const [subscriptionName, setSubscriptionName] = useState("Taxiro Plus");
  const [subscriptionPrice, setSubscriptionPrice] = useState("");
  const [subscriptionPlanDiscount, setSubscriptionPlanDiscount] = useState("");
  const [freeCancellations, setFreeCancellations] = useState("0");

  const [bonusTitle, setBonusTitle] = useState("");
  const [bonusVehicle, setBonusVehicle] = useState<VehicleType | "all">("all");
  const [bonusTarget, setBonusTarget] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");

  const loadControls = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [areasResult, rulesResult, fraudResult, surgeResult, couponResult, subscriptionResult, bonusResult] = await Promise.all([
      supabase.from("service_areas").select("*").order("updated_at", { ascending: false }),
      supabase.from("pricing_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_signals").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("surge_rules").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("coupon_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("subscription_plans").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("driver_bonus_rules").select("*").order("created_at", { ascending: false }).limit(30),
    ]);

    const errors = [areasResult.error, rulesResult.error, fraudResult.error, surgeResult.error, couponResult.error, subscriptionResult.error, bonusResult.error];
    if (errors.some(isMissingSupabaseObject)) {
      setMigrationMissing(true);
      onMessage("Commercial controls need the latest Supabase pricing/revenue migration before they can be used.");
      return;
    }

    const firstError = errors.find(Boolean);
    if (firstError) {
      onMessage(firstError.message ?? "Commercial controls could not load.");
      return;
    }

    setMigrationMissing(false);
    const loadedAreas = (areasResult.data as ServiceArea[]) ?? [];
    setAreas(loadedAreas);
    setPricingRules((rulesResult.data as PricingRule[]) ?? []);
    setFraudSignals((fraudResult.data as FraudSignal[]) ?? []);
    setSurgeRules((surgeResult.data as SurgeRule[]) ?? []);
    setCoupons((couponResult.data as CouponCampaign[]) ?? []);
    setSubscriptions((subscriptionResult.data as SubscriptionPlan[]) ?? []);
    setBonusRules((bonusResult.data as DriverBonusRule[]) ?? []);
    setRuleAreaId((current) => current || loadedAreas[0]?.id || "");
  }, [onMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadControls();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadControls]);

  async function createServiceArea() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      center_lat: Number(centerLat),
      center_lng: Number(centerLng),
      is_active: true,
      name: areaName.trim(),
      radius_km: Number(radiusKm),
      supported_vehicle_types: supportedVehicles,
    };
    if (!payload.name || !Number.isFinite(payload.center_lat) || !Number.isFinite(payload.center_lng) || payload.radius_km <= 0) {
      onMessage("Enter a valid area name, center coordinates, and radius.");
      return;
    }
    const { error } = await supabase.from("service_areas").insert(payload);
    onMessage(error ? error.message : "Service area created.");
    if (!error) await loadControls();
  }

  async function createPricingRule() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      airport_pickup_fee: numberValue(airportFee),
      base_fare: numberValue(baseFare),
      cashback_percentage: percentValue(cashbackPercentage),
      cancellation_fee: numberValue(cancellationFee),
      company_commission_rate: percentValue(commissionRate),
      currency: "INR",
      driver_bonus_pool: numberValue(driverBonusPool),
      driver_cancellation_rules: { tracked: true, affects_priority: true, affects_incentives: true },
      dynamic_surge_multiplier: 1,
      effective_from: new Date().toISOString(),
      free_waiting_minutes: Math.round(numberValue(freeWaitingMinutes)),
      is_active: true,
      max_surge_multiplier: numberValue(surgeCap, 1.5),
      minimum_fare: numberValue(minimumFare),
      night_charge_type: nightChargeType,
      night_charge_value: percentOrMoneyValue(nightChargeType, nightChargeValue),
      passenger_cancellation_rules: { free_minutes: 2, fee_after_pickup: numberValue(cancellationFee) },
      per_km_rate: numberValue(perKmRate),
      per_minute_rate: numberValue(perMinuteRate),
      referral_reward_amount: numberValue(referralReward),
      service_area_id: ruleAreaId || null,
      subscription_discount_percentage: percentValue(subscriptionDiscount),
      tax_percentage: percentValue(taxPercentage),
      toll_charge: numberValue(tollCharge),
      vehicle_type: ruleVehicle,
      waiting_charge_per_minute: numberValue(waitingCharge),
    };
    const required = [payload.base_fare, payload.minimum_fare, payload.per_km_rate, payload.per_minute_rate, payload.waiting_charge_per_minute, payload.company_commission_rate];
    if (required.some((value) => !Number.isFinite(value) || value < 0) || payload.per_km_rate <= 0 || payload.max_surge_multiplier > 1.5) {
      onMessage("Enter valid pricing numbers. Surge cap cannot exceed 1.5x.");
      return;
    }
    const { error } = await supabase.from("pricing_rules").insert(payload);
    onMessage(error ? error.message : "Pricing rule created.");
    if (!error) await loadControls();
  }

  async function createSurgeRule() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      is_active: true,
      local_end_time: surgeEndTime || null,
      local_start_time: surgeStartTime || null,
      multiplier: numberValue(surgeMultiplier),
      service_area_id: surgeAreaId || null,
      surge_type: surgeType,
      vehicle_type: surgeVehicle === "all" ? null : surgeVehicle,
    };
    if (!Number.isFinite(payload.multiplier) || payload.multiplier < 1 || payload.multiplier > 1.5) {
      onMessage("Surge multiplier must be between 1x and 1.5x.");
      return;
    }
    const { error } = await supabase.from("surge_rules").insert(payload);
    onMessage(error ? error.message : "Surge rule created.");
    if (!error) await loadControls();
  }

  async function createCoupon() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      code: couponCode.trim().toUpperCase(),
      discount_type: couponType,
      discount_value: couponType === "percent" ? percentValue(couponValue) : numberValue(couponValue),
      max_discount: couponMax ? numberValue(couponMax) : null,
      min_fare: numberValue(couponMinFare),
      is_active: true,
    };
    if (!/^[A-Z0-9]{3,32}$/.test(payload.code) || payload.discount_value <= 0) {
      onMessage("Enter a valid coupon code and discount value.");
      return;
    }
    const { error } = await supabase.from("coupon_campaigns").insert(payload);
    onMessage(error ? error.message : "Coupon created.");
    if (!error) await loadControls();
  }

  async function createSubscriptionPlan() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      benefits: { special_promotions: true },
      discount_percentage: percentValue(subscriptionPlanDiscount),
      free_cancellations_per_month: Math.round(numberValue(freeCancellations)),
      monthly_price: numberValue(subscriptionPrice),
      name: subscriptionName.trim(),
      priority_matching: true,
      priority_support: true,
      is_active: true,
    };
    if (!payload.name || payload.monthly_price < 0 || payload.discount_percentage < 0) {
      onMessage("Enter a valid subscription name, price, and discount.");
      return;
    }
    const { error } = await supabase.from("subscription_plans").insert(payload);
    onMessage(error ? error.message : "Subscription plan created.");
    if (!error) await loadControls();
  }

  async function createDriverBonus() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      bonus_type: "daily_rides",
      is_active: true,
      reward_amount: numberValue(bonusAmount),
      target_rides: bonusTarget ? Math.round(numberValue(bonusTarget)) : null,
      title: bonusTitle.trim(),
      vehicle_type: bonusVehicle === "all" ? null : bonusVehicle,
    };
    if (!payload.title || payload.reward_amount <= 0) {
      onMessage("Enter a bonus title and reward amount.");
      return;
    }
    const { error } = await supabase.from("driver_bonus_rules").insert(payload);
    onMessage(error ? error.message : "Driver bonus rule created.");
    if (!error) await loadControls();
  }

  async function reviewFraudSignal(signalId: string, status: "reviewing" | "dismissed" | "confirmed") {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_review_fraud_signal", {
      p_signal_id: signalId,
      p_status: status,
    });
    onMessage(error ? error.message : `Fraud signal marked ${status}.`);
    if (!error) await loadControls();
  }

  const previewSplit = useMemo(
    () => calculateFareBreakdown(numberValue(previewFare), percentValue(commissionRate)),
    [commissionRate, previewFare],
  );

  if (migrationMissing) {
    return (
      <Card className="rounded-[1.75rem] p-5">
        <CardHeader className="p-0">
          <CardTitle>Commercial migration required</CardTitle>
          <CardDescription>
            Apply 20260721100000_enterprise_pricing_revenue_system.sql before using pricing, surge, coupons, subscriptions, and bonus controls.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.8fr)]">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={BadgeIndianRupee} label="Pricing rules" value={pricingRules.length} />
          <MetricCard icon={TrendingUp} label="Surge rules" value={surgeRules.length} />
          <MetricCard icon={Gift} label="Coupons" value={coupons.length} />
          <MetricCard icon={Sparkles} label="Subscriptions" value={subscriptions.length} />
        </div>

        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2"><MapPinned className="size-5" /> Service areas</CardTitle>
            <CardDescription>Define where Taxiro can accept trips and which verified vehicle categories can serve each area.</CardDescription>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area name" value={areaName} onChange={setAreaName} />
            <Field label="Radius km" type="number" value={radiusKm} onChange={setRadiusKm} />
            <Field label="Center latitude" type="number" value={centerLat} onChange={setCenterLat} />
            <Field label="Center longitude" type="number" value={centerLng} onChange={setCenterLng} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {vehicleTypes.map((vehicle) => (
              <ToggleChip
                active={supportedVehicles.includes(vehicle)}
                key={vehicle}
                label={getVehicleLabel(vehicle)}
                onClick={() => setSupportedVehicles((current) => current.includes(vehicle) ? current.filter((item) => item !== vehicle) : [...current, vehicle])}
              />
            ))}
          </div>
          <Button className="mt-4 w-full rounded-xl" onClick={() => void createServiceArea()}>Create service area</Button>
        </Card>

        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5" /> Enterprise pricing rules</CardTitle>
            <CardDescription>Every value below is admin-configurable and used by the backend fare engine.</CardDescription>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Service area" value={ruleAreaId} onChange={setRuleAreaId} options={[{ label: "Global fallback", value: "" }, ...areas.map((area) => ({ label: area.name, value: area.id }))]} />
            <SelectField label="Vehicle" value={ruleVehicle} onChange={(value) => setRuleVehicle(value as VehicleType)} options={vehicleTypes.map((vehicle) => ({ label: getVehicleLabel(vehicle), value: vehicle }))} />
            <Field label="Base fare" type="number" value={baseFare} onChange={setBaseFare} />
            <Field label="Per km" type="number" value={perKmRate} onChange={setPerKmRate} />
            <Field label="Per minute" type="number" value={perMinuteRate} onChange={setPerMinuteRate} />
            <Field label="Minimum fare" type="number" value={minimumFare} onChange={setMinimumFare} />
            <Field label="Waiting charge/min" type="number" value={waitingCharge} onChange={setWaitingCharge} />
            <Field label="Free waiting min" type="number" value={freeWaitingMinutes} onChange={setFreeWaitingMinutes} />
            <Field label="Cancellation fee" type="number" value={cancellationFee} onChange={setCancellationFee} />
            <Field label="Commission %" type="number" value={commissionRate} onChange={setCommissionRate} />
            <Field label="Surge cap" type="number" value={surgeCap} onChange={setSurgeCap} />
            <SelectField label="Night charge" value={nightChargeType} onChange={(value) => setNightChargeType(value as PricingRule["night_charge_type"])} options={["none", "flat", "percent"].map((value) => ({ label: value, value }))} />
            <Field label="Night charge value" type="number" value={nightChargeValue} onChange={setNightChargeValue} />
            <Field label="Airport pickup fee" type="number" value={airportFee} onChange={setAirportFee} />
            <Field label="Toll charge" type="number" value={tollCharge} onChange={setTollCharge} />
            <Field label="Tax %" type="number" value={taxPercentage} onChange={setTaxPercentage} />
            <Field label="Subscription discount %" type="number" value={subscriptionDiscount} onChange={setSubscriptionDiscount} />
            <Field label="Cashback %" type="number" value={cashbackPercentage} onChange={setCashbackPercentage} />
            <Field label="Referral reward" type="number" value={referralReward} onChange={setReferralReward} />
            <Field label="Driver bonus pool" type="number" value={driverBonusPool} onChange={setDriverBonusPool} />
            <div className="rounded-xl bg-muted p-3 text-sm md:col-span-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Preview fare" type="number" value={previewFare} onChange={setPreviewFare} />
                <div className="rounded-xl bg-card p-3 text-sm">
                  <p className="font-black">Commission preview</p>
                  <p className="mt-1 text-muted-foreground">Taxiro {formatMoney(previewSplit.companyCommission)} / Driver {formatMoney(previewSplit.riderEarning)}</p>
                </div>
              </div>
            </div>
          </div>
          <Button className="mt-4 w-full rounded-xl" onClick={() => void createPricingRule()}>Create pricing rule</Button>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="rounded-[1.5rem] p-4 sm:p-5">
            <CardHeader className="px-0 pt-0"><CardTitle>Surge rules</CardTitle><CardDescription>Configure peak, rain, holiday, festival, demand, and night multipliers.</CardDescription></CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Area" value={surgeAreaId} onChange={setSurgeAreaId} options={[{ label: "All areas", value: "" }, ...areas.map((area) => ({ label: area.name, value: area.id }))]} />
              <SelectField label="Vehicle" value={surgeVehicle} onChange={(value) => setSurgeVehicle(value as VehicleType | "all")} options={[{ label: "All vehicles", value: "all" }, ...vehicleTypes.map((vehicle) => ({ label: getVehicleLabel(vehicle), value: vehicle }))]} />
              <SelectField label="Surge type" value={surgeType} onChange={(value) => setSurgeType(value as SurgeRule["surge_type"])} options={surgeTypes.map((value) => ({ label: value.replaceAll("_", " "), value }))} />
              <Field label="Multiplier" type="number" value={surgeMultiplier} onChange={setSurgeMultiplier} />
              <Field label="Local start time" type="time" value={surgeStartTime} onChange={setSurgeStartTime} />
              <Field label="Local end time" type="time" value={surgeEndTime} onChange={setSurgeEndTime} />
            </div>
            <Button className="mt-4 w-full rounded-xl" onClick={() => void createSurgeRule()}>Create surge rule</Button>
          </Card>

          <Card className="rounded-[1.5rem] p-4 sm:p-5">
            <CardHeader className="px-0 pt-0"><CardTitle>Coupons and subscriptions</CardTitle><CardDescription>Create discounts without changing code.</CardDescription></CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coupon code" value={couponCode} onChange={setCouponCode} />
              <SelectField label="Coupon type" value={couponType} onChange={(value) => setCouponType(value as "flat" | "percent")} options={[{ label: "Flat", value: "flat" }, { label: "Percent", value: "percent" }]} />
              <Field label="Coupon value" type="number" value={couponValue} onChange={setCouponValue} />
              <Field label="Max discount" type="number" value={couponMax} onChange={setCouponMax} />
              <Field label="Minimum fare" type="number" value={couponMinFare} onChange={setCouponMinFare} />
            </div>
            <Button className="mt-3 w-full rounded-xl" onClick={() => void createCoupon()}>Create coupon</Button>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Plan name" value={subscriptionName} onChange={setSubscriptionName} />
              <Field label="Monthly price" type="number" value={subscriptionPrice} onChange={setSubscriptionPrice} />
              <Field label="Ride discount %" type="number" value={subscriptionPlanDiscount} onChange={setSubscriptionPlanDiscount} />
              <Field label="Free cancellations" type="number" value={freeCancellations} onChange={setFreeCancellations} />
            </div>
            <Button className="mt-3 w-full rounded-xl" onClick={() => void createSubscriptionPlan()}>Create subscription</Button>
          </Card>
        </div>

        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0"><CardTitle>Driver bonuses</CardTitle><CardDescription>Create earning incentives for daily rides, peak hours, airport, night, new driver, and referrals.</CardDescription></CardHeader>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Bonus title" value={bonusTitle} onChange={setBonusTitle} />
            <SelectField label="Vehicle" value={bonusVehicle} onChange={(value) => setBonusVehicle(value as VehicleType | "all")} options={[{ label: "All vehicles", value: "all" }, ...vehicleTypes.map((vehicle) => ({ label: getVehicleLabel(vehicle), value: vehicle }))]} />
            <Field label="Target rides" type="number" value={bonusTarget} onChange={setBonusTarget} />
            <Field label="Reward amount" type="number" value={bonusAmount} onChange={setBonusAmount} />
          </div>
          <Button className="mt-4 w-full rounded-xl" onClick={() => void createDriverBonus()}>Create driver bonus</Button>
        </Card>
      </div>

      <div className="grid gap-5 content-start">
        <ConfiguredRules pricingRules={pricingRules} />
        <CompactList title="Active surge" items={surgeRules.map((rule) => `${rule.surge_type.replaceAll("_", " ")} - ${rule.multiplier}x`)} empty="No surge rules configured." />
        <CompactList title="Coupons" items={coupons.map((coupon) => `${coupon.code} - ${coupon.discount_type} ${coupon.discount_value}`)} empty="No coupons configured." />
        <CompactList title="Subscriptions" items={subscriptions.map((plan) => `${plan.name} - ${formatMoney(plan.monthly_price)}`)} empty="No subscriptions configured." />
        <CompactList title="Driver bonuses" items={bonusRules.map((rule) => `${rule.title} - ${formatMoney(rule.reward_amount)}`)} empty="No bonus rules configured." />
        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0"><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5" /> Fraud review</CardTitle><CardDescription>Location jumps and suspicious tracking signals are queued here.</CardDescription></CardHeader>
          <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
            {fraudSignals.length ? fraudSignals.map((signal) => (
              <div className="rounded-2xl border border-border bg-muted/70 p-3" key={signal.id}>
                <div className="flex items-start justify-between gap-3"><p className="flex items-center gap-2 font-black"><AlertTriangle className="size-4 text-amber-600" /> {signal.signal_type.replaceAll("_", " ")}</p><span className="rounded-full bg-card px-2 py-1 text-[10px] font-black">{signal.severity}</span></div>
                <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-card p-3 text-[11px] text-muted-foreground">{JSON.stringify(signal.evidence, null, 2)}</pre>
                <div className="mt-3 grid grid-cols-3 gap-2"><Button onClick={() => void reviewFraudSignal(signal.id, "reviewing")} size="sm" variant="outline">Review</Button><Button onClick={() => void reviewFraudSignal(signal.id, "dismissed")} size="sm" variant="outline">Dismiss</Button><Button onClick={() => void reviewFraudSignal(signal.id, "confirmed")} size="sm">Confirm</Button></div>
              </div>
            )) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No fraud signals yet.</p>}
          </div>
        </Card>
      </div>
    </section>
  );
}

function ConfiguredRules({ pricingRules }: { pricingRules: PricingRule[] }) {
  return (
    <Card className="rounded-[1.5rem] p-4">
      <p className="text-sm font-black">Configured pricing</p>
      <div className="mt-3 grid gap-2">
        {pricingRules.slice(0, 10).map((rule) => (
          <div className="rounded-xl bg-muted p-3 text-sm" key={rule.id}>
            <p className="font-black">{getVehicleLabel(rule.vehicle_type)} - Rs {rule.per_km_rate}/km</p>
            <p className="text-xs text-muted-foreground">Base {formatMoney(rule.base_fare)} / min {formatMoney(rule.minimum_fare)} / wait {formatMoney(rule.waiting_charge_per_minute)}/min / commission {(rule.company_commission_rate * 100).toFixed(1)}%</p>
          </div>
        ))}
        {!pricingRules.length ? <p className="text-sm text-muted-foreground">No pricing rules configured yet.</p> : null}
      </div>
    </Card>
  );
}

function CompactList({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <Card className="rounded-[1.5rem] p-4">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 8).map((item) => <p className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold" key={item}>{item}</p>)}
        {!items.length ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      </div>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof BadgeIndianRupee; label: string; value: number }) {
  return <div className="rounded-2xl bg-card p-4 shadow-sm"><Icon className="size-4" /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>;
}

function Field({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <Label className="grid gap-1 text-sm font-bold">
      {label}
      <Input className="h-11 rounded-xl" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </Label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <Label className="grid gap-1 text-sm font-bold">
      {label}
      <select className="h-11 rounded-xl border border-border bg-card px-3 outline-none focus:ring-2 focus:ring-ring" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </Label>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`rounded-xl px-3 py-2 text-sm font-black ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={onClick} type="button">{label}</button>;
}

function isMissingSupabaseObject(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return text.includes("404") || text.includes("not found") || text.includes("schema cache") || text.includes("could not find");
}

function numberValue(value: string, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentValue(value: string) {
  const number = numberValue(value);
  return number > 1 ? number / 100 : number;
}

function percentOrMoneyValue(type: PricingRule["night_charge_type"], value: string) {
  return type === "percent" ? percentValue(value) : numberValue(value);
}