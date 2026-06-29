import { Bike, MapPinned, Radio, Route } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { InfoSection } from "@/components/InfoSection";

export default function AboutPage() {
  return (
    <AppShell title="About Taxiro">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoSection
          icon={Bike}
          title="What Taxiro is"
          items={[
            "Taxiro is a bike taxi MVP for India focused on real accounts, real ride records, and practical rider-user coordination.",
            "The app uses a map-first flow with pickup, drop, advance booking, ride-now booking, private ride codes, and live foreground rider tracking.",
            "Taxiro means journey/trip and is built as a free-stack web MVP using Supabase, OpenStreetMap, Nominatim, OSRM, and Leaflet.",
          ]}
        />
        <InfoSection
          icon={Route}
          title="How a ride works"
          items={[
            "The user books a ride, marks ready, and waits for an available rider to accept.",
            "The rider navigates to pickup, asks for the private code, then starts the ride only after code verification.",
            "After reaching drop, the rider collects payment and confirms payment received before the ride is completed.",
          ]}
        />
        <InfoSection
          icon={Radio}
          title="Live experience"
          items={[
            "Realtime Supabase updates keep user, rider, admin, chat, payment, and ride status screens fresh without manual refresh.",
            "Rider GPS is foreground browser tracking, so the rider app should stay open during assigned rides.",
            "Demand signals help riders see ready-now and scheduled ride areas while they are available.",
          ]}
        />
        <InfoSection
          icon={MapPinned}
          title="MVP limits"
          items={[
            "This is not a native background-tracking app yet; tracking depends on browser permission and app visibility.",
            "Online payments are not processed inside the MVP. Cash/UPI is handled outside the app, then confirmed by the rider.",
            "Production launch still needs full QA, security review, support operations, and payment compliance checks.",
          ]}
        />
      </div>
    </AppShell>
  );
}