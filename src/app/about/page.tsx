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
            "The app uses a map-first flow with pickup, drop, ride-now booking, advance booking, private ride codes, foreground live tracking, chat, and safety alerts.",
            "Taxiro means journey/trip and is built as a free-stack web MVP using Supabase, OpenStreetMap, Nominatim, OSRM, and Leaflet.",
          ]}
        />
        <InfoSection
          icon={Route}
          title="How a ride works"
          items={[
            "The user books a ride, chooses a 15/30/60 minute ready signal, and publishes it only when they are actually ready for pickup.",
            "The rider accepts a live ready request, navigates to pickup, asks for the private 4-digit code, then starts the trip only after code verification.",
            "After pickup, the route switches to destination tracking. At drop, the rider collects cash/UPI and confirms payment received before completion.",
          ]}
        />
        <InfoSection
          icon={Radio}
          title="Live experience"
          items={[
            "Realtime Supabase updates keep user, rider, admin, chat, payment, notification, and ride status screens fresh without manual refresh.",
            "Rider GPS is foreground browser tracking, so the rider app should stay open during assigned and started rides.",
            "Demand signals show nearby ready-now and scheduled ride areas around the rider, limited to about 2 km from their current location; signals are hidden during active jobs to reduce clutter.",
          ]}
        />
        <InfoSection
          icon={MapPinned}
          title="MVP limits"
          items={[
            "This is not a native background-tracking app yet; tracking depends on browser permission, HTTPS/localhost, and app visibility.",
            "Emergency-contact alerts are in-app notifications only. No SMS, WhatsApp, phone call, or native push service is included in this MVP slice.",
            "Production launch still needs full QA, security review, support operations, payment compliance, and legal policy review.",
          ]}
        />
      </div>
    </AppShell>
  );
}