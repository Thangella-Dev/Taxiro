"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPinned, ShieldAlert, SlidersHorizontal } from "lucide-react";

import { calculateFareBreakdown, formatMoney } from "@/lib/fare";
import { getSupabase } from "@/lib/supabase";
import { getVehicleLabel } from "@/lib/vehicles";
import type { FraudSignal, PricingRule, ServiceArea, VehicleType } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onMessage: (message: string) => void;
};

const vehicleTypes: VehicleType[] = ["bike", "auto", "car"];

export function AdminOperationalControls({ onMessage }: Props) {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [fraudSignals, setFraudSignals] = useState<FraudSignal[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [areaName, setAreaName] = useState("Hyderabad core");
  const [centerLat, setCenterLat] = useState("17.385");
  const [centerLng, setCenterLng] = useState("78.4867");
  const [radiusKm, setRadiusKm] = useState("35");
  const [supportedVehicles, setSupportedVehicles] = useState<VehicleType[]>(["bike", "auto", "car"]);
  const [ruleAreaId, setRuleAreaId] = useState("");
  const [ruleVehicle, setRuleVehicle] = useState<VehicleType>("bike");
  const [baseFare, setBaseFare] = useState("20");
  const [perKmRate, setPerKmRate] = useState("7");
  const [perMinuteRate, setPerMinuteRate] = useState("0");
  const [minimumFare, setMinimumFare] = useState("40");
  const [commissionRate, setCommissionRate] = useState("0.07");

  const loadControls = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [areasResult, rulesResult, fraudResult] = await Promise.all([
      supabase.from("service_areas").select("*").order("updated_at", { ascending: false }),
      supabase.from("pricing_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_signals").select("*").order("created_at", { ascending: false }).limit(30),
    ]);

    if (areasResult.error || rulesResult.error || fraudResult.error) {
      onMessage(areasResult.error?.message ?? rulesResult.error?.message ?? fraudResult.error?.message ?? "Operational controls need the latest Supabase migration.");
      return;
    }

    const loadedAreas = (areasResult.data as ServiceArea[]) ?? [];
    setAreas(loadedAreas);
    setPricingRules((rulesResult.data as PricingRule[]) ?? []);
    setFraudSignals((fraudResult.data as FraudSignal[]) ?? []);
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
    if (!ruleAreaId) {
      onMessage("Create or select a service area first.");
      return;
    }
    const payload = {
      base_fare: Number(baseFare),
      company_commission_rate: Number(commissionRate),
      effective_from: new Date().toISOString(),
      is_active: true,
      minimum_fare: Number(minimumFare),
      per_km_rate: Number(perKmRate),
      per_minute_rate: Number(perMinuteRate),
      service_area_id: ruleAreaId,
      vehicle_type: ruleVehicle,
    };
    if ([payload.base_fare, payload.company_commission_rate, payload.minimum_fare, payload.per_km_rate, payload.per_minute_rate].some((value) => !Number.isFinite(value) || value < 0)) {
      onMessage("Pricing must use valid non-negative numbers.");
      return;
    }
    const { error } = await supabase.from("pricing_rules").insert(payload);
    onMessage(error ? error.message : "Pricing rule created.");
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

  const previewSplit = useMemo(() => calculateFareBreakdown(200, Number(commissionRate) || 0.07), [commissionRate]);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
      <div className="grid gap-5">
        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2"><MapPinned className="size-5" /> Service areas</CardTitle>
            <CardDescription>Define where Taxiro can accept trips and which verified vehicles can serve that area.</CardDescription>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area name" value={areaName} onChange={setAreaName} />
            <Field label="Radius km" type="number" value={radiusKm} onChange={setRadiusKm} />
            <Field label="Center latitude" type="number" value={centerLat} onChange={setCenterLat} />
            <Field label="Center longitude" type="number" value={centerLng} onChange={setCenterLng} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {vehicleTypes.map((vehicle) => (
              <button
                className={`rounded-xl px-3 py-2 text-sm font-black capitalize ${supportedVehicles.includes(vehicle) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                key={vehicle}
                onClick={() => setSupportedVehicles((current) => current.includes(vehicle) ? current.filter((item) => item !== vehicle) : [...current, vehicle])}
                type="button"
              >
                {vehicle}
              </button>
            ))}
          </div>
          <Button className="mt-4 w-full rounded-xl" onClick={() => void createServiceArea()}>Create service area</Button>
        </Card>

        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5" /> Pricing rules</CardTitle>
            <CardDescription>Configure fares per area and vehicle. Bookings save the matched rule for audit.</CardDescription>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Service area
              <select className="h-11 rounded-xl border border-border bg-card px-3 outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setRuleAreaId(event.target.value)} value={ruleAreaId}>
                <option value="">Select area</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Vehicle
              <select className="h-11 rounded-xl border border-border bg-card px-3 capitalize outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setRuleVehicle(event.target.value as VehicleType)} value={ruleVehicle}>
                {vehicleTypes.map((vehicle) => <option key={vehicle} value={vehicle}>{getVehicleLabel(vehicle)}</option>)}
              </select>
            </label>
            <Field label="Base fare" type="number" value={baseFare} onChange={setBaseFare} />
            <Field label="Per km" type="number" value={perKmRate} onChange={setPerKmRate} />
            <Field label="Per minute" type="number" value={perMinuteRate} onChange={setPerMinuteRate} />
            <Field label="Minimum fare" type="number" value={minimumFare} onChange={setMinimumFare} />
            <Field label="Company commission" type="number" value={commissionRate} onChange={setCommissionRate} />
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-black">Example split on Rs 200</p>
              <p className="mt-1 text-muted-foreground">Taxiro {formatMoney(previewSplit.companyCommission)} / Rider {formatMoney(previewSplit.riderEarning)}</p>
            </div>
          </div>
          <Button className="mt-4 w-full rounded-xl" onClick={() => void createPricingRule()}>Create pricing rule</Button>
        </Card>
      </div>

      <div className="grid gap-5">
        <Card className="rounded-[1.5rem] p-4 sm:p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5" /> Fraud review</CardTitle>
            <CardDescription>Location jumps and suspicious tracking signals are queued here for admin review.</CardDescription>
          </CardHeader>
          <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
            {fraudSignals.length ? fraudSignals.map((signal) => (
              <div className="rounded-2xl border border-border bg-muted/70 p-3" key={signal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-black"><AlertTriangle className="size-4 text-amber-600" /> {signal.signal_type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{signal.severity} / {signal.status}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-card px-2 py-1 text-[10px] font-black">{new Date(signal.created_at).toLocaleTimeString()}</span>
                </div>
                <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-card p-3 text-[11px] text-muted-foreground">{JSON.stringify(signal.evidence, null, 2)}</pre>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button onClick={() => void reviewFraudSignal(signal.id, "reviewing")} size="sm" variant="outline">Review</Button>
                  <Button onClick={() => void reviewFraudSignal(signal.id, "dismissed")} size="sm" variant="outline">Dismiss</Button>
                  <Button onClick={() => void reviewFraudSignal(signal.id, "confirmed")} size="sm">Confirm</Button>
                </div>
              </div>
            )) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No fraud signals yet.</p>}
          </div>
        </Card>
        <Card className="rounded-[1.5rem] p-4">
          <p className="text-sm font-black">Configured rules</p>
          <div className="mt-3 grid gap-2">
            {pricingRules.slice(0, 8).map((rule) => (
              <div className="rounded-xl bg-muted p-3 text-sm" key={rule.id}>
                <p className="font-black">{getVehicleLabel(rule.vehicle_type)} - Rs {rule.per_km_rate}/km</p>
                <p className="text-xs text-muted-foreground">Base {formatMoney(rule.base_fare)} / minimum {formatMoney(rule.minimum_fare)} / commission {(rule.company_commission_rate * 100).toFixed(1)}%</p>
              </div>
            ))}
            {!pricingRules.length ? <p className="text-sm text-muted-foreground">No pricing rules configured yet.</p> : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

function Field({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <Label className="grid gap-1 text-sm font-bold">
      {label}
      <Input className="h-11 rounded-xl" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </Label>
  );
}
