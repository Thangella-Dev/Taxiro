"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bike, CarFront, CarTaxiFront, CheckCircle2, ImageUp, ShieldCheck } from "lucide-react";

import { RiderLivePhotoCapture } from "@/components/RiderLivePhotoCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadRiderLivePhoto } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { normalizeRegistration, validateDrivingLicence, validateUpiId, validateVehicleInput } from "@/lib/validation";
import { VEHICLE_OPTIONS, getVehicleLabel } from "@/lib/vehicles";
import type { RiderProfile, RiderVehicle, VehicleType } from "@/types/database";

type VehicleDraft = {
  make: string;
  model: string;
  registrationNumber: string;
  status: RiderVehicle["verification_status"] | "not_added";
  rejectionReason: string | null;
};

const emptyDraft: VehicleDraft = {
  make: "",
  model: "",
  registrationNumber: "",
  rejectionReason: null,
  status: "not_added",
};

export function RiderIdentitySettings({ riderId }: { riderId: string }) {
  const [details, setDetails] = useState<RiderProfile | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [livePhotoUrl, setLivePhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<VehicleType>("bike");
  const [uploading, setUploading] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiQrImageUrl, setUpiQrImageUrl] = useState("");
  const [vehicles, setVehicles] = useState<Record<VehicleType, VehicleDraft>>({
    auto: { ...emptyDraft },
    bike: { ...emptyDraft },
    car: { ...emptyDraft },
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let ignore = false;
    void Promise.all([
      supabase.from("rider_profiles").select("*").eq("rider_id", riderId).maybeSingle(),
      supabase.from("rider_vehicles").select("*").eq("rider_id", riderId).order("vehicle_type"),
    ]).then(([profileResult, vehicleResult]) => {
      if (ignore) return;
      if (profileResult.data) {
        const profile = profileResult.data as RiderProfile;
        setDetails(profile);
        setLicenseNumber(profile.license_number ?? "");
        setUpiId(profile.upi_id ?? "");
        setUpiQrImageUrl(profile.upi_qr_image_url ?? "");
        if (profile.live_selfie_path) {
          void supabase.storage.from("rider-verification").createSignedUrl(profile.live_selfie_path, 600)
            .then(({ data }) => setLivePhotoUrl(data?.signedUrl ?? ""));
        }
      }
      if (vehicleResult.data) {
        setVehicles((current) => {
          const next = { ...current };
          (vehicleResult.data as RiderVehicle[]).forEach((vehicle) => {
            next[vehicle.vehicle_type] = {
              make: vehicle.make,
              model: vehicle.model,
              registrationNumber: vehicle.registration_number,
              rejectionReason: vehicle.rejection_reason,
              status: vehicle.verification_status,
            };
          });
          return next;
        });
      }
    });

    return () => {
      ignore = true;
    };
  }, [riderId]);

  function updateVehicle(field: "make" | "model" | "registrationNumber", value: string) {
    setVehicles((current) => ({
      ...current,
      [selectedType]: {
        ...current[selectedType],
        [field]: field === "registrationNumber" ? value.toUpperCase() : value,
      },
    }));
  }

  async function captureLivePhoto(photo: Blob | null) {
    if (!photo) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setUploading(true);
    setMessage("Uploading live identity photo...");
    try {
      const path = await uploadRiderLivePhoto(supabase, riderId, photo);
      const { data } = await supabase.storage.from("rider-verification").createSignedUrl(path, 600);
      setLivePhotoUrl(data?.signedUrl ?? "");
      setDetails((current) => current ? {
        ...current,
        identity_rejection_reason: null,
        live_selfie_captured_at: new Date().toISOString(),
        live_selfie_path: path,
        verification_status: "pending",
      } : current);
      setMessage("Live photo submitted. Identity approval is pending admin review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live photo upload failed.");
    } finally {
      setUploading(false);
    }
  }
  async function uploadUpiQr(file: File | null) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 2 * 1024 * 1024) {
      setMessage("Upload a PNG, JPEG, or WebP QR image smaller than 2 MB.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;

    setUploading(true);
    setMessage("Uploading UPI QR image...");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
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
    const draft = vehicles[selectedType];
    const vehicleError = validateVehicleInput({
      make: draft.make,
      model: draft.model,
      registrationNumber: draft.registrationNumber,
    });
    const licenceError = validateDrivingLicence(licenseNumber);
    const upiError = validateUpiId(upiId);
    const validationError = vehicleError ?? licenceError ?? upiError;
    if (validationError) {
      setMessage(validationError);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(true);
    setMessage(`Saving ${getVehicleLabel(selectedType)} for verification...`);
    const vehicleValues = {
      make: draft.make.trim(),
      model: draft.model.trim(),
      registration_number: normalizeRegistration(draft.registrationNumber),
    };
    const vehicleMutation = draft.status === "not_added"
      ? supabase.from("rider_vehicles").insert({ ...vehicleValues, rider_id: riderId, vehicle_type: selectedType }).select("*").single()
      : supabase.from("rider_vehicles").update(vehicleValues).eq("rider_id", riderId).eq("vehicle_type", selectedType).select("*").single();
    const [vehicleResult, profileResult] = await Promise.all([
      vehicleMutation,
      supabase.from("rider_profiles").upsert({
        license_number: licenseNumber.trim().toUpperCase().replace(/\s+/g, ""),
        rider_id: riderId,
        updated_at: new Date().toISOString(),
        upi_id: upiId.trim() || null,
        upi_qr_image_url: upiQrImageUrl.trim() || null,
      }).select("*").single(),
    ]);
    setSaving(false);

    const error = vehicleResult.error ?? profileResult.error;
    if (error) {
      setMessage(error.message);
      return;
    }

    const vehicle = vehicleResult.data as RiderVehicle;
    setVehicles((current) => ({
      ...current,
      [selectedType]: {
        make: vehicle.make,
        model: vehicle.model,
        registrationNumber: vehicle.registration_number,
        rejectionReason: vehicle.rejection_reason,
        status: vehicle.verification_status,
      },
    }));
    setDetails(profileResult.data as RiderProfile);
    setMessage(`${getVehicleLabel(selectedType)} submitted for admin verification.`);
  }

  const selectedVehicle = vehicles[selectedType];

  return (
    <section className="rounded-2xl border border-border bg-muted p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card"><Bike className="size-4" /></span>
        <div>
          <h3 className="font-black">Vehicles, licence, and UPI</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add each vehicle separately. Only verified vehicles appear in the rider switcher.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3">
        <RiderLivePhotoCapture disabled={uploading || saving} onCapture={(photo) => void captureLivePhoto(photo)} />
        <div className="rounded-lg bg-card p-3 text-sm">
          <p className="font-black">Identity status: <span className="capitalize">{details?.verification_status ?? "pending"}</span></p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">An admin reviews your live selfie and licence separately from each vehicle.</p>
          {details?.identity_rejection_reason ? <p className="mt-2 text-xs font-semibold text-red-700">Admin note: {details.identity_rejection_reason}</p> : null}
          {livePhotoUrl ? <Image alt="Submitted live rider identity" className="mt-3 aspect-[4/3] w-full rounded-lg object-cover" height={480} src={livePhotoUrl} unoptimized width={640} /> : null}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {VEHICLE_OPTIONS.map((option) => {
          const Icon = option.type === "bike" ? Bike : option.type === "auto" ? CarTaxiFront : CarFront;
          const status = vehicles[option.type].status;
          return (
            <button
              className={selectedType === option.type ? "rounded-lg bg-primary p-3 text-primary-foreground" : "rounded-lg bg-card p-3"}
              key={option.type}
              onClick={() => setSelectedType(option.type)}
              type="button"
            >
              <Icon className="mx-auto size-5" />
              <span className="mt-1 block text-xs font-black">{option.label}</span>
              <span className="mt-1 block truncate text-[10px] capitalize opacity-70">{status.replace("_", " ")}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field id="rider-vehicle-make" label={`${getVehicleLabel(selectedType)} make`}><Input id="rider-vehicle-make" maxLength={40} onChange={(event) => updateVehicle("make", event.target.value)} placeholder="Honda / Bajaj / Tata" value={selectedVehicle.make} /></Field>
        <Field id="rider-vehicle-model" label="Model"><Input id="rider-vehicle-model" maxLength={40} onChange={(event) => updateVehicle("model", event.target.value)} placeholder="Activa / RE / Nexon" value={selectedVehicle.model} /></Field>
        <Field id="rider-registration" label="Registration number"><Input autoCapitalize="characters" id="rider-registration" maxLength={18} onChange={(event) => updateVehicle("registrationNumber", event.target.value)} placeholder="TS09AB1234" value={selectedVehicle.registrationNumber} /></Field>
        <Field id="rider-licence" label="Driving licence"><Input autoCapitalize="characters" id="rider-licence" maxLength={20} onChange={(event) => setLicenseNumber(event.target.value.toUpperCase())} placeholder="TS0120260001234" value={licenseNumber} /></Field>
        <Field id="rider-upi" label="UPI ID"><Input id="rider-upi" maxLength={150} onChange={(event) => setUpiId(event.target.value)} placeholder="name@upi" value={upiId} /></Field>
        <Field id="rider-upi-qr" label="Upload UPI QR"><Input accept="image/png,image/jpeg,image/webp" disabled={uploading} id="rider-upi-qr" onChange={(event) => void uploadUpiQr(event.target.files?.[0] ?? null)} type="file" /></Field>
      </div>

      {selectedVehicle.status !== "not_added" ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
          <ShieldCheck className="size-4" />
          {getVehicleLabel(selectedType)} verification: <strong className="capitalize">{selectedVehicle.status}</strong>
          {details?.active_vehicle_type === selectedType ? <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-xs font-black">Active</span> : null}
        </div>
      ) : null}
      {selectedVehicle.rejectionReason ? <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">Admin note: {selectedVehicle.rejectionReason}</p> : null}

      {upiQrImageUrl ? (
        <div className="mt-3 rounded-2xl bg-card p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-black"><ImageUp className="size-4" />UPI QR preview</p>
          <Image alt="Rider UPI QR code" className="max-h-48 rounded-xl border border-border bg-white object-contain p-2" height={512} src={upiQrImageUrl} unoptimized width={512} />
        </div>
      ) : null}

      <Button className="mt-3 h-11 w-full rounded-full" disabled={saving || uploading} onClick={() => void save()}>
        {saving ? "Saving..." : uploading ? "Uploading..." : `Save ${getVehicleLabel(selectedType)} for verification`}
      </Button>
      {message ? <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4" />{message}</p> : null}
    </section>
  );
}

function Field({ children, id, label }: { children: React.ReactNode; id: string; label: string }) {
  return <div><Label htmlFor={id}>{label}</Label><div className="mt-1">{children}</div></div>;
}