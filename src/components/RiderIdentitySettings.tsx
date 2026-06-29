"use client";

import { useEffect, useState } from "react";
import { Bike, CheckCircle2, ImageUp, ShieldCheck } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiQrImageUrl, setUpiQrImageUrl] = useState("");
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
        setUpiId(profile.upi_id ?? "");
        setUpiQrImageUrl(profile.upi_qr_image_url ?? "");
        setVehicleMake(profile.vehicle_make ?? "");
        setVehicleModel(profile.vehicle_model ?? "");
        setVehicleNumber(profile.vehicle_number ?? "");
      });

    return () => {
      ignore = true;
    };
  }, [riderId]);

  async function uploadUpiQr(file: File | null) {
    if (!file) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setUploading(true);
    setMessage("Uploading UPI QR image...");
    const extension = file.name.split(".").pop() ?? "png";
    const path = `${riderId}/upi-qr-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("rider-upi-qr").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    setUploading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data } = supabase.storage.from("rider-upi-qr").getPublicUrl(path);
    setUpiQrImageUrl(data.publicUrl);
    setMessage("UPI QR uploaded. Save details to attach it to your rider profile.");
  }

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
        upi_id: upiId.trim() || null,
        upi_qr_image_url: upiQrImageUrl.trim() || null,
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
    setMessage("Vehicle and payment details saved for verification.");
  }

  return (
    <section className="rounded-2xl border border-border bg-muted p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
          <Bike className="size-4" />
        </span>
        <div>
          <h3 className="font-black">Vehicle, identity, and UPI</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Vehicle details are shown after assignment. UPI details are shown to the customer at drop-off.
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
        <Field label="UPI ID">
          <Input onChange={(event) => setUpiId(event.target.value)} placeholder="name@upi" value={upiId} />
        </Field>
        <Field label="Upload UPI QR">
          <Input accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void uploadUpiQr(event.target.files?.[0] ?? null)} type="file" />
        </Field>
      </div>

      {upiQrImageUrl ? (
        <div className="mt-3 rounded-2xl bg-card p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-black">
            <ImageUp className="size-4" />
            UPI QR preview
          </p>
          <img alt="Rider UPI QR code" className="max-h-48 rounded-xl border border-border bg-white object-contain p-2" src={upiQrImageUrl} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
        <ShieldCheck className="size-4" />
        Verification: <strong className="capitalize">{details?.verification_status ?? "pending"}</strong>
      </div>
      <Button className="mt-3 h-11 w-full rounded-full" disabled={saving || uploading} onClick={() => void save()}>
        {saving ? "Saving..." : uploading ? "Uploading..." : "Save vehicle and UPI details"}
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
