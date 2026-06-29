"use client";

import Link from "next/link";
import { HelpCircle, History, Info, ListChecks, LogOut, ShieldCheck, X } from "lucide-react";

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
    <div className="fixed inset-0 z-[1500] bg-[#101713]/48 backdrop-blur-sm">
      <aside className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] grid content-start gap-3 overflow-y-auto overflow-x-clip rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[27rem] sm:max-w-[calc(100%-1.5rem)] sm:rounded-xl">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Taxiro rider
            </p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight">
              {profile?.full_name ?? "Rider account"}
            </h2>
          </div>
          <button
            aria-label="Close rider menu"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <ProfileSettings onSaved={onProfileSaved} profile={profile} />
        {profile ? <RiderIdentitySettings riderId={profile.id} /> : null}

        <section className="rounded-lg border border-border bg-muted p-4">
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

        <section className="rounded-lg border border-border bg-muted p-4">
          <p className="flex items-center gap-2 font-black">
            <ShieldCheck className="size-4" />
            Safety
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Verify the customer&apos;s four-digit code before starting. Complete a
            ride only after reaching the selected destination.
          </p>
        </section>

        <div className="grid gap-3">
          <RiderInfoLink href="/about" icon={Info} title="About Taxiro" text="Product vision, live ride flow, and MVP limits." />
          <RiderInfoLink href="/help" icon={HelpCircle} title="Help and support" text="Location, ride-code, chat, payment, and support guidance." />
          <RiderInfoLink href="/privacy" icon={ShieldCheck} title="Privacy policy" text="Data visibility, rider tracking, and account privacy information." />
          <RiderInfoLink href="/rules" icon={ListChecks} title="Rules and regulations" text="Safety, misuse, and accepted-ride cancellation fine rules." />
        </div>

        <Button className="h-12" onClick={onSignOut} variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </aside>
    </div>
  );
}

function RiderInfoLink({
  href,
  icon: Icon,
  text,
  title,
}: {
  href: string;
  icon: typeof HelpCircle;
  text: string;
  title: string;
}) {
  return (
    <Link className="rounded-lg border border-border bg-muted p-4 transition hover:border-primary/20 hover:bg-secondary" href={href}>
      <p className="flex items-center gap-2 font-black">
        <Icon className="size-4" />
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </Link>
  );
}
