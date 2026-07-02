"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronDown, HelpCircle, History, Info, ListChecks, LogOut, ShieldCheck, UserRound, X } from "lucide-react";

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
  const swipeStartX = useRef<number | null>(null);

  return (
    <div className="fixed inset-0 z-[1500] bg-[#101713]/48 backdrop-blur-sm">
      <button aria-label="Close rider menu" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside
        className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] grid touch-pan-y content-start gap-3 overflow-y-auto overflow-x-clip rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[27rem] sm:max-w-[calc(100%-1.5rem)] sm:rounded-xl"
        onPointerDown={(event) => { swipeStartX.current = event.clientX; }}
        onPointerUp={(event) => {
          if (swipeStartX.current !== null && event.clientX - swipeStartX.current > 72) onClose();
          swipeStartX.current = null;
        }}
      >
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

        <MenuDisclosure icon={UserRound} title="Profile and account">
          <ProfileSettings onSaved={onProfileSaved} profile={profile} />
        </MenuDisclosure>

        <MenuDisclosure icon={ShieldCheck} title="Identity, vehicles, and payments">
          {profile ? <RiderIdentitySettings riderId={profile.id} /> : null}
        </MenuDisclosure>

        <details className="group rounded-lg border border-border bg-muted">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card">
              <History className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">Ride history</span>
              <span className="block truncate text-xs text-muted-foreground">
                {history.length} completed or cancelled jobs
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mx-3 mb-3 grid max-h-[22rem] gap-3 overflow-y-auto overscroll-contain rounded-lg bg-white p-2">
            {history.length ? (
              history.map((ride) => <RideCard key={ride.id} ride={ride} />)
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Completed rides will appear here.
              </p>
            )}
          </div>
        </details>

        <MenuDisclosure icon={ShieldCheck} title="Safety guidance">
          <p className="text-sm leading-6 text-muted-foreground">
            Verify the customer&apos;s four-digit code before starting. Complete a
            ride only after reaching the selected destination.
          </p>
        </MenuDisclosure>

        <nav className="grid grid-cols-2 gap-2" aria-label="Rider information">
          <RiderInfoLink href="/about" icon={Info} title="About" />
          <RiderInfoLink href="/help" icon={HelpCircle} title="Support" />
          <RiderInfoLink href="/privacy" icon={ShieldCheck} title="Privacy" />
          <RiderInfoLink href="/rules" icon={ListChecks} title="Rules" />
        </nav>

        <Button className="h-12" onClick={onSignOut} variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </aside>
    </div>
  );
}

function MenuDisclosure({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof HelpCircle;
  title: string;
}) {
  return (
    <details className="group rounded-lg border border-border bg-muted">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 font-black">{title}</span>
        <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="mx-3 mb-3 max-h-[min(62dvh,32rem)] overflow-y-auto overscroll-contain rounded-lg bg-white p-2">
        {children}
      </div>
    </details>
  );
}

function RiderInfoLink({
  href,
  icon: Icon,
  title,
}: {
  href: string;
  icon: typeof HelpCircle;
  title: string;
}) {
  return (
    <Link className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-muted p-3 font-black transition hover:border-primary/20 hover:bg-secondary" href={href}>
      <Icon className="size-4 shrink-0" />
      <span className="truncate text-sm">{title}</span>
    </Link>
  );
}
