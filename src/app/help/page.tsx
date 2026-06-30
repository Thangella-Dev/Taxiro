import { AlertTriangle, Bell, Headphones, LocateFixed, MessageCircle, ShieldCheck } from "lucide-react";

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
            "Tap Detect or refresh GPS from the app while using HTTPS or localhost so the browser can show the location permission prompt.",
            "If permission is denied or blocked, allow precise location in browser/site settings, then try again.",
            "If GPS accuracy is weak, wait a few seconds, move near a window/open area, or use search/map pin fallback.",
          ]}
        />
        <InfoSection
          icon={MessageCircle}
          title="Ride and chat help"
          items={[
            "Use the assigned-ride chat only after a rider is assigned or a trip has started.",
            "Share the private 4-digit ride code only with the rider shown in the app and only after they reach pickup.",
            "Ready signals last 15, 30, or 60 minutes. If a signal expires before acceptance, publish it again from the ride card.",
          ]}
        />
        <InfoSection
          icon={AlertTriangle}
          title="SOS and safety"
          items={[
            "During assigned or started rides, use the visible SOS button if you feel unsafe or need help.",
            "Taxiro saves the ride/location context and notifies your emergency contact in-app when their phone number matches a Taxiro profile.",
            "Triple volume-up is best-effort only because browsers usually do not expose hardware volume keys. The visible SOS button is the reliable action.",
          ]}
        />
        <InfoSection
          icon={Bell}
          title="Notifications"
          items={[
            "Emergency-contact alerts and important ride updates appear in the Notifications section inside the user/rider menu.",
            "In-app notifications require the emergency contact to already have a Taxiro account using the saved phone number.",
            "This MVP does not send external push, SMS, WhatsApp, or phone-call alerts yet.",
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
            "For MVP testing, contact the Taxiro operations administrator for account, matching, payment, notification, or location problems.",
            "Include ride ID, account email, screenshot, time, and a short description of what happened.",
            "Real emergency and safety incidents should still be handled through local emergency/support channels outside the MVP.",
          ]}
        />
      </div>
    </AppShell>
  );
}