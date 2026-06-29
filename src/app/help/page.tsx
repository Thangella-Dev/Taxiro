import { Headphones, LocateFixed, MessageCircle, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { InfoSection } from "@/components/InfoSection";

export default function HelpPage() {
  return (
    <AppShell title="Help and support">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoSection
          icon={LocateFixed}
          title="Location issues"
          items={[
            "Allow browser location permission for better pickup detection and rider tracking.",
            "If location permission is denied, search the address or choose pickup/drop on the map.",
            "If GPS accuracy is poor, wait a few seconds, move to an open area, or manually set the map pin.",
          ]}
        />
        <InfoSection
          icon={MessageCircle}
          title="Ride and chat help"
          items={[
            "Use the assigned-ride chat only after a rider is assigned or a trip has started.",
            "Share the private 4-digit ride code only with the rider shown in the app.",
            "If the rider cannot continue before trip start, either side can cancel with a reason.",
          ]}
        />
        <InfoSection
          icon={ShieldCheck}
          title="Payments"
          items={[
            "Fare is estimated and saved when the ride is booked based on route distance and ETA.",
            "Taxiro records a 7% company share and 93% rider earning split for every ride fare.",
            "For UPI rides, pay using the rider UPI details shown after drop, then the rider confirms payment received.",
          ]}
        />
        <InfoSection
          icon={Headphones}
          title="Support contact"
          items={[
            "For MVP testing, contact the Taxiro operations administrator for account, matching, payment, or location problems.",
            "Include ride ID, account email, screenshot, time, and a short description of what happened.",
            "Emergency and safety incidents should be handled outside the MVP through local emergency/support channels.",
          ]}
        />
      </div>
    </AppShell>
  );
}