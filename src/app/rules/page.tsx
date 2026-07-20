import { AlertTriangle, BadgeIndianRupee, Ban, Clock3, ShieldCheck } from "lucide-react";

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
            "After code verification, the ride should follow the destination route unless both sides agree to a change outside the MVP.",
          ]}
        />
        <InfoSection
          icon={Clock3}
          title="Ready signal rules"
          items={[
            "Users can publish a ready signal for 15, 30, or 60 minutes, with 30 minutes as the default.",
            "Riders can accept only active, unexpired ready signals.",
            "Expired ready signals return to scheduled state and must be published again if the user still wants the ride. Rider apps also hide expired and far-away signals immediately while open.",
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
            "Do not create fake rides, repeatedly cancel accepted rides, spam chat, misuse SOS, or share false pickup/drop information.",
            "Riders should not start a ride without the private code or mark payment received before collecting payment.",
            "Admins may review ride history, cancellation reasons, chat, payment status, safety alerts, and notifications for support and safety handling.",
          ]}
        />
        <InfoSection
          icon={AlertTriangle}
          title="MVP legal note"
          items={[
            "These are product rules for MVP testing and are not final legal terms for public launch.",
            "Actual deployment may require transport, tax, consumer protection, payment, emergency response, and local operating compliance review.",
            "The fine amount, notification handling, and enforcement workflow can be adjusted before production based on business and legal approval.",
          ]}
        />
      </div>
    </AppShell>
  );
}