import { AlertTriangle, BadgeIndianRupee, Ban, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { InfoSection } from "@/components/InfoSection";

export default function RulesPage() {
  return (
    <AppShell title="Rules and regulations">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoSection
          icon={ShieldCheck}
          title="Ride safety rules"
          items={[
            "The rider must verify the user's 4-digit ride code before starting the trip.",
            "The user should confirm the rider and vehicle details before sharing the code.",
            "The ride should follow the selected pickup and drop locations unless both sides agree to update the plan outside the MVP.",
          ]}
        />
        <InfoSection
          icon={BadgeIndianRupee}
          title="Cancellation fine rule"
          items={[
            "The first 2 user cancellations are treated as free MVP cancellations.",
            "From the 3rd user cancellation onward, cancelling after a rider has accepted records a Rs 50 cancellation fine.",
            "Scheduled or ready rides that are cancelled before rider acceptance do not receive this accepted-ride fine.",
          ]}
        />
        <InfoSection
          icon={Ban}
          title="Misuse rules"
          items={[
            "Do not create fake rides, repeatedly cancel accepted rides, spam chat, or share false pickup/drop information.",
            "Riders should not start a ride without the private code or mark payment received before collecting payment.",
            "Admins may review ride history, cancellation reasons, chat, and payment status for support and safety handling.",
          ]}
        />
        <InfoSection
          icon={AlertTriangle}
          title="MVP legal note"
          items={[
            "These are product rules for MVP testing and are not final legal terms for public launch.",
            "Actual deployment may require transport, tax, consumer protection, payment, and local operating compliance review.",
            "The fine amount and enforcement workflow can be adjusted before production based on business and legal approval.",
          ]}
        />
      </div>
    </AppShell>
  );
}