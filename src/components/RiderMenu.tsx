"use client";

import { HelpCircle, History, LogOut, ShieldCheck, X } from "lucide-react";

import { ProfileSettings } from "@/components/ProfileSettings";
import { RiderIdentitySettings } from "@/components/RiderIdentitySettings";
import { RideCard } from "@/components/RideCard";
import { Button } from "@/components/ui/button";
import type { Profile, RideRequest } from "@/types/database";

export function RiderMenu({
  onClose,
  onProfileSaved,
  onSignOut,
  profile,
  rides,
}: {
  onClose: () => void;
  onProfileSaved: (profile: Profile) => void;
  onSignOut: () => void;
  profile: Profile | null;
  rides: RideRequest[];
}) {
  const history = rides.filter((ride) =>
    ["completed", "cancelled"].includes(ride.status),
  );

  return (
    <div className="absolute inset-0 z-[1500] bg-[#101713]/45 backdrop-blur-sm">
      <aside className="absolute inset-x-2 bottom-2 top-2 grid content-start gap-3 overflow-y-auto overflow-x-clip rounded-[1.75rem] bg-white p-3 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[26rem] sm:max-w-[calc(100%-1.5rem)] sm:rounded-[2rem] sm:p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Taxidi rider
            </p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight">
              {profile?.full_name ?? "Rider account"}
            </h2>
          </div>
          <button
            aria-label="Close rider menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <ProfileSettings onSaved={onProfileSaved} profile={profile} />
        {profile ? <RiderIdentitySettings riderId={profile.id} /> : null}

        <section className="rounded-2xl border border-border bg-muted p-4">
          <p className="flex items-center gap-2 font-black">
            <History className="size-4" />
            Ride history
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {history.length} completed or cancelled jobs
          </p>
          <div className="mt-3 grid gap-3">
            {history.length ? (
              history.slice(0, 3).map((ride) => <RideCard key={ride.id} ride={ride} />)
            ) : (
              <p className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">
                Completed rides will appear here.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-muted p-4">
          <p className="flex items-center gap-2 font-black">
            <ShieldCheck className="size-4" />
            Safety
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Verify the customer&apos;s four-digit code before starting. Complete a
            ride only after reaching the selected destination.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-muted p-4">
          <p className="flex items-center gap-2 font-black">
            <HelpCircle className="size-4" />
            Help and support
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            For this MVP, report account, matching, or location issues to the
            Taxidi operations administrator.
          </p>
        </section>

        <Button className="h-12 rounded-full" onClick={onSignOut} variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </aside>
    </div>
  );
}

