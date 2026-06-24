"use client";

import { useEffect, useState } from "react";
import { Bike, CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";
import type { RiderProfile } from "@/types/database";

export function RiderIdentitySettings({ riderId }: { riderId: string }) {
  const [details, setDetails] = useState<RiderProfile | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let ignore = false;
    void supabase
      .from("rider_profiles")
      .select("*")
      .eq("rider_id", riderId)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore || !data) return;
        const profile = data as RiderProfile;
        setDetails(profile);
        setLicenseNumber(profile.license_number ?? "");
        setVehicleMake(profile.vehicle_make ?? "");
        setVehicleModel(profile.vehicle_model ?? "");
        setVehicleNumber(profile.vehicle_number ?? "");
      });

    return () => {
      ignore = true;
    };
  }, [riderId]);

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("rider_profiles")
      .upsert({
        license_number: licenseNumber.trim() || null,
        rider_id: riderId,
        updated_at: new Date().toISOString(),
        vehicle_make: vehicleMake.trim() || null,
        vehicle_model: vehicleModel.trim() || null,
        vehicle_number: vehicleNumber.trim().toUpperCase() || null,
      })
      .select("*")
      .single();
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    setDetails(data as RiderProfile);
    setMessage("Vehicle details saved for verification.");
  }

  return (
    <section className="rounded-2xl border border-border bg-muted p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
          <Bike className="size-4" />
        </span>
        <div>
          <h3 className="font-black">Vehicle and identity</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            These details are shown to customers after assignment.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vehicle make">
          <Input onChange={(event) => setVehicleMake(event.target.value)} placeholder="Honda" value={vehicleMake} />
        </Field>
        <Field label="Vehicle model">
          <Input onChange={(event) => setVehicleModel(event.target.value)} placeholder="Activa" value={vehicleModel} />
        </Field>
        <Field label="Registration number">
          <Input onChange={(event) => setVehicleNumber(event.target.value)} placeholder="TS 09 AB 1234" value={vehicleNumber} />
        </Field>
        <Field label="Driving licence">
          <Input onChange={(event) => setLicenseNumber(event.target.value)} placeholder="Licence number" value={licenseNumber} />
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
        <ShieldCheck className="size-4" />
        Verification: <strong className="capitalize">{details?.verification_status ?? "pending"}</strong>
      </div>
      <Button className="mt-3 h-11 w-full rounded-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving..." : "Save vehicle details"}
      </Button>
      {message ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" />
          {message}
        </p>
      ) : null}
    </section>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
