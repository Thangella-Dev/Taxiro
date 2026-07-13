import Link from "next/link";
import { ArrowRight, Bike, Clock3, KeyRound, MapPin, Navigation, Radio, ShieldCheck, Sparkles } from "lucide-react";

import { DynamicMapPicker } from "@/components/DynamicMapPicker";
import { HomeSessionRedirect } from "@/components/HomeSessionRedirect";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="taxiro-public-home min-h-screen overflow-x-hidden bg-[#eef3ec] text-[#101713]">
      <HomeSessionRedirect />
      <section className="taxiro-public-stage relative mx-auto min-h-screen w-full max-w-6xl overflow-hidden bg-[#dfe8dc] shadow-2xl sm:my-5 sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem]">
        <div className="taxiro-hero-aura taxiro-hero-aura-one" />
        <div className="taxiro-hero-aura taxiro-hero-aura-two" />
        <div className="relative h-[52svh] min-h-[21rem] overflow-hidden sm:h-[62vh]">
          <DynamicMapPicker
            className="absolute inset-0 h-full min-h-full w-full"
            drop={{ address: "Hitech City, Hyderabad", lat: 17.4435, lng: 78.3772 }}
            pickup={{ address: "KPHB, Hyderabad", lat: 17.4933, lng: 78.3914 }}
          />

          <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between gap-3 sm:inset-x-5 sm:top-5">
            <Link href="/" className="taxiro-floating-pill flex items-center gap-2 rounded-full border border-white/80 bg-white/94 px-3 py-2 font-black shadow-[var(--shadow-soft)] backdrop-blur">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#101713] text-white">
                <Bike className="size-4" />
              </span>
              Taxiro
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <Button asChild className="h-11 bg-[#101713] px-4 text-white hover:bg-[#101713]/90">
                <Link href="/auth">Open app</Link>
              </Button>
            </div>
          </header>

          <div className="taxiro-live-map-badge absolute bottom-6 left-4 z-[1000] flex items-center gap-3 rounded-full border border-white/20 bg-[#101713] px-4 py-3 text-sm font-black text-white shadow-2xl sm:bottom-10 sm:left-8">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-secondary" />
            </span>
            Hyderabad live service map
          </div>
        </div>

        <section className="taxiro-home-sheet relative z-[1100] -mt-7 rounded-t-[2rem] border border-white/80 bg-white px-4 pb-6 pt-4 shadow-[0_-24px_70px_rgb(16_23_19_/_0.16)] sm:mx-auto sm:max-w-2xl sm:rounded-[2rem] sm:px-6 sm:pb-7">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#dfe6df]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#f0f3ef] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#647067]">
                <Sparkles className="size-3.5" />
                Bike taxi app
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Book. Track. Verify. Ride.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#647067] sm:text-base">
                Taxiro is a real-data bike taxi MVP with live rider tracking, private ride codes, demand signals, and phase-aware pickup to drop navigation.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-black">Live MVP</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Mini icon={Clock3} label="ETA" value="Live" />
            <Mini icon={Radio} label="Match" value="2 km" />
            <Mini icon={KeyRound} label="Code" value="Safe" />
          </div>

          <div className="taxiro-route-preview mt-5 grid gap-2 rounded-[1.5rem] bg-[#f0f3ef] p-3">
            <RouteLine icon={MapPin} label="Pickup" text="Detect, search, or choose on map" />
            <RouteLine icon={Navigation} label="Drop" text="Track route after code verification" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4">
            <TrustChip icon={ShieldCheck} label="Verified riders" />
            <TrustChip icon={Radio} label="Live signals" />
            <TrustChip icon={Clock3} label="Peak pricing" />
            <TrustChip icon={KeyRound} label="Ride code" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button asChild className="taxiro-primary-glow h-14 bg-[#101713] text-base font-black text-white hover:bg-[#101713]/90">
              <Link href="/dashboard/user">
                Book a ride <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="h-14 border-[#dfe6df] bg-[#f0f3ef] text-base font-black text-[#101713] hover:bg-[#e7eee4]" variant="outline">
              <Link href="/dashboard/rider">Rider mode</Link>
            </Button>
          </div>
        </section>
      </section>
    </main>
  );
}

function RouteLine({ icon: Icon, label, text }: { icon: typeof MapPin; label: string; text: string }) {
  return (
    <div className="taxiro-route-line flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-white p-3">
      <Icon className="size-4 shrink-0 text-[#101713]" />
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#647067]">{label}</p>
        <p className="truncate text-sm font-semibold">{text}</p>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="taxiro-metric-tile rounded-[1.35rem] bg-[#f0f3ef] p-3">
      <Icon className="mb-2 size-4" />
      <p className="text-xs text-[#647067]">{label}</p>
      <p className="font-black">{value}</p>
    </div>
  );
}
function TrustChip({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="taxiro-trust-chip flex items-center gap-1.5 rounded-full bg-[#f6f9f4] px-3 py-2 text-[#647067]">
      <Icon className="size-3.5 text-[#101713]" />
      <span className="truncate">{label}</span>
    </div>
  );
}
