import Link from "next/link";
import { ArrowRight, Bike, Clock3, KeyRound, LocateFixed, MapPin, Menu, Navigation, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef3ec] text-[#101713]">
      <section className="relative mx-auto min-h-screen w-full max-w-6xl overflow-hidden bg-[#dfe8dc] shadow-2xl sm:my-5 sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2.25rem]">
        <div className="relative h-[52svh] min-h-[21rem] overflow-hidden sm:h-[62vh]">
          <div className="absolute inset-0 bg-[#dfe8dc]">
            <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(115deg,transparent_0_13%,rgba(16,23,19,.14)_13%_14.5%,transparent_14.5%_43%,rgba(16,23,19,.12)_43%_44.5%,transparent_44.5%_100%),linear-gradient(38deg,transparent_0_28%,rgba(16,23,19,.16)_28%_29.5%,transparent_29.5%_62%,rgba(16,23,19,.1)_62%_63.4%,transparent_63.4%_100%),radial-gradient(circle_at_18%_36%,#cfe2cf_0_8%,transparent_8.5%),radial-gradient(circle_at_78%_22%,#c8dac9_0_10%,transparent_10.5%),radial-gradient(circle_at_78%_76%,#c2d6c5_0_12%,transparent_12.5%)]" />
          </div>

          <header className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3 sm:inset-x-5 sm:top-5">
            <Link href="/" className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-2 font-black shadow-xl backdrop-blur">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#101713] text-white">
                <Bike className="size-4" />
              </span>
              Taxidi
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild className="h-11 rounded-full bg-[#101713] px-4 text-white hover:bg-[#101713]/90">
                <Link href="/auth">Open app</Link>
              </Button>
              <button aria-label="Menu" className="flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-xl backdrop-blur" type="button">
                <Menu className="size-5" />
              </button>
            </div>
          </header>

          <div className="absolute left-5 top-[30%] z-10 rounded-full bg-[#101713] px-4 py-2 text-sm font-black text-white shadow-2xl sm:left-[12%]">
            Rider 6 min away
          </div>
          <MapDot className="left-[22%] top-[48%]" tone="dark" />
          <RoutePath />
          <MapDot className="right-[24%] top-[34%]" tone="lime" />
          <div className="absolute bottom-8 right-5 z-10 flex size-12 items-center justify-center rounded-full bg-white shadow-2xl sm:right-8">
            <LocateFixed className="size-5" />
          </div>
        </div>

        <section className="relative z-30 -mt-9 rounded-t-[2.25rem] border border-white/80 bg-white px-4 pb-6 pt-4 shadow-[0_-24px_70px_rgb(16_23_19_/_0.16)] sm:mx-auto sm:max-w-2xl sm:rounded-[2.25rem] sm:px-6 sm:pb-7">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#dfe6df]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#647067]">Bike taxi app</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Book. Track. Verify. Ride.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#647067] sm:text-base">
                Taxidi is a real-data bike taxi MVP with live rider tracking, private ride codes, demand signals, and phase-aware pickup to drop navigation.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-black">Live MVP</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Mini icon={Clock3} label="ETA" value="Live" />
            <Mini icon={Radio} label="Match" value="2 km" />
            <Mini icon={KeyRound} label="Code" value="Safe" />
          </div>

          <div className="mt-5 grid gap-2 rounded-[1.5rem] bg-[#f0f3ef] p-3">
            <RouteLine icon={MapPin} label="Pickup" text="Detect, search, or choose on map" />
            <RouteLine icon={Navigation} label="Drop" text="Track route after code verification" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button asChild className="h-14 rounded-full bg-[#101713] text-base font-black text-white hover:bg-[#101713]/90">
              <Link href="/dashboard/user">
                Book a ride <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="h-14 rounded-full border-[#dfe6df] bg-[#f0f3ef] text-base font-black text-[#101713] hover:bg-[#e7eee4]" variant="outline">
              <Link href="/dashboard/rider">Rider mode</Link>
            </Button>
          </div>
        </section>
      </section>
    </main>
  );
}

function MapDot({ className, tone }: { className: string; tone: "dark" | "lime" }) {
  return (
    <div className={`absolute z-10 flex size-12 items-center justify-center rounded-full shadow-2xl ${tone === "dark" ? "bg-[#101713]" : "bg-secondary"} ${className}`}>
      <span className="size-4 rounded-full border-2 border-white" />
    </div>
  );
}

function RoutePath() {
  return <div className="absolute left-[28%] top-[43%] h-1.5 w-[38%] rotate-[-18deg] rounded-full bg-[#101713]/75 shadow-xl" />;
}

function RouteLine({ icon: Icon, label, text }: { icon: typeof MapPin; label: string; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3">
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
    <div className="rounded-2xl bg-[#f0f3ef] p-3">
      <Icon className="mb-2 size-4" />
      <p className="text-xs text-[#647067]">{label}</p>
      <p className="font-black">{value}</p>
    </div>
  );
}
