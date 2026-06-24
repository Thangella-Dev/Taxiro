"use client";

import { useState } from "react";
import { CheckCircle2, Settings, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";
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
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (!profile) {
      setMessage("Sign in again to update profile.");
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
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
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
            Update your public account details used across Taxidi.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <Label htmlFor="menu-full-name">Full name</Label>
          <Input
            className="mt-1 h-11 rounded-2xl bg-card"
            id="menu-full-name"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your name"
            value={fullName}
          />
        </div>
        <div>
          <Label htmlFor="menu-phone">Phone</Label>
          <Input
            className="mt-1 h-11 rounded-2xl bg-card"
            id="menu-phone"
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
              id="menu-emergency-name"
              onChange={(event) => setEmergencyName(event.target.value)}
              placeholder="Trusted person"
              value={emergencyName}
            />
          </div>
          <div>
            <Label htmlFor="menu-emergency-phone">Contact phone</Label>
            <Input
              className="mt-1 h-11 rounded-2xl"
              id="menu-emergency-phone"
              inputMode="tel"
              onChange={(event) => setEmergencyPhone(event.target.value)}
              placeholder="+91..."
              value={emergencyPhone}
            />
          </div>
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
