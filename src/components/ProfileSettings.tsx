"use client";

import { useState } from "react";
import { CheckCircle2, Settings, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";
import { normalizePhone, validateFullName, validateOptionalPhone, validatePhone } from "@/lib/validation";
import type { Profile } from "@/types/database";

export function ProfileSettings({
  onSaved,
  profile,
}: {
  onSaved: (profile: Profile) => void;
  profile: Profile | null;
}) {
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone ?? "");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language ?? "en");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (!profile) {
      setMessage("Sign in again to update profile.");
      return;
    }

    const nameError = validateFullName(fullName);
    const phoneError = validatePhone(phone);
    const emergencyNameError = emergencyName.trim() ? validateFullName(emergencyName, "Emergency contact name") : null;
    const emergencyPhoneError = validateOptionalPhone(emergencyPhone, "Emergency contact phone");
    const validationError = nameError ?? phoneError ?? emergencyNameError ?? emergencyPhoneError;
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (Boolean(emergencyName.trim()) !== Boolean(emergencyPhone.trim())) {
      setMessage("Add both emergency contact name and phone, or leave both empty.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setSaving(true);
    setMessage("Saving profile...");
    const { data, error } = await supabase
      .from("profiles")
      .update({
        emergency_contact_name: emergencyName.trim().replace(/\s+/g, " ") || null,
        emergency_contact_phone: emergencyPhone.trim() ? normalizePhone(emergencyPhone) : null,
        full_name: fullName.trim().replace(/\s+/g, " "),
        phone: normalizePhone(phone),
        preferred_language: preferredLanguage,
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    onSaved(data as Profile);
    setMessage("Profile updated.");
  }

  return (
    <section className="rounded-2xl border border-border bg-muted p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-black">Profile and settings</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Update your public account details used across Taxiro.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <Label htmlFor="menu-full-name">Full name</Label>
          <Input
            className="mt-1 h-11 rounded-2xl bg-card"
            autoComplete="name"
            id="menu-full-name"
            maxLength={80}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your name"
            value={fullName}
          />
        </div>
        <div>
          <Label htmlFor="menu-phone">Phone</Label>
          <Input
            className="mt-1 h-11 rounded-2xl bg-card"
            autoComplete="tel"
            id="menu-phone"
            maxLength={16}
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91..."
            value={phone}
          />
        </div>
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-black">Emergency contact</p>
            <p className="text-xs text-muted-foreground">
              Used only for trip safety and urgent support.
            </p>
          </div>
          <div>
            <Label htmlFor="menu-emergency-name">Contact name</Label>
            <Input
              className="mt-1 h-11 rounded-2xl"
              autoComplete="name"
              id="menu-emergency-name"
              maxLength={80}
              onChange={(event) => setEmergencyName(event.target.value)}
              placeholder="Trusted person"
              value={emergencyName}
            />
          </div>
          <div>
            <Label htmlFor="menu-emergency-phone">Contact phone</Label>
            <Input
              className="mt-1 h-11 rounded-2xl"
              autoComplete="tel"
              id="menu-emergency-phone"
              maxLength={16}
              inputMode="tel"
              onChange={(event) => setEmergencyPhone(event.target.value)}
              placeholder="+91..."
              value={emergencyPhone}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="menu-language">Preferred language</Label>
          <select
            className="mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="menu-language"
            onChange={(event) => setPreferredLanguage(event.target.value)}
            value={preferredLanguage}
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
          </select>
        </div>
        <div className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <Settings className="size-4" />
            Account type: <span className="capitalize">{profile?.role ?? "user"}</span>
          </p>
          <p className="mt-1 text-xs leading-5">
            Role changes are admin-controlled to protect rider and user app access.
          </p>
        </div>
        <Button className="h-11 rounded-full" disabled={saving} onClick={() => void saveProfile()}>
          {saving ? "Saving..." : "Save profile"}
        </Button>
        {message ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" />
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
