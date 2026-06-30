import { Bell, Database, Eye, Lock, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { InfoSection } from "@/components/InfoSection";

export default function PrivacyPage() {
  return (
    <AppShell title="Privacy policy">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoSection
          icon={Database}
          title="Data collected"
          items={[
            "Taxiro stores account profile details, role, phone, emergency contact, ride addresses, coordinates, status, fare, payment preference, chat messages, and notification records.",
            "Rider accounts can store vehicle details, licence number, UPI ID, and UPI QR image URL.",
            "Rider location records can include latitude, longitude, accuracy, speed, heading, last-seen time, and updated time while the rider app is active.",
          ]}
        />
        <InfoSection
          icon={Bell}
          title="Safety alert data"
          items={[
            "SOS, late-trip, and route-change alerts can store ride ID, triggering user, alert type, message, approximate location, accuracy, recipient profile, and status.",
            "Emergency-contact matching uses a normalized phone-number comparison between the user's saved emergency contact phone and Taxiro profiles.",
            "Safety alerts are deduped for the same ride and alert type for about 30 minutes to reduce repeated notifications.",
          ]}
        />
        <InfoSection
          icon={Eye}
          title="Who can see what"
          items={[
            "Users can see their own rides, assigned rider tracking, assigned chat, payment information, safety actions, and notifications targeting them.",
            "Riders can see ready ride requests, assigned ride details, route information, customer chat, payment status, and notifications targeting them.",
            "Admins can view platform records needed for operations, verification, support, and safety review.",
          ]}
        />
        <InfoSection
          icon={Lock}
          title="Protection"
          items={[
            "Supabase Row Level Security is used to limit access to role-appropriate records, safety alerts, and notifications.",
            "The frontend uses the public anon/publishable key only. Service-role credentials must never be shipped to the browser.",
            "Secrets, local MCP tokens, and private environment files should stay out of Git and deployment logs.",
          ]}
        />
        <InfoSection
          icon={ShieldCheck}
          title="MVP privacy note"
          items={[
            "This policy is for MVP development and internal testing, not final legal production language.",
            "Before public launch, privacy, retention, deletion, emergency response, support, and payment policies should be reviewed legally.",
            "Users should not upload sensitive documents or unnecessary personal information beyond MVP testing needs.",
          ]}
        />
      </div>
    </AppShell>
  );
}