import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function MetricPill({
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "hot" | "ok";
  value: string | number;
}) {
  const toneClass =
    tone === "hot"
      ? "bg-amber-50 text-amber-700"
      : tone === "ok"
        ? "bg-secondary text-primary"
        : "bg-muted text-foreground";

  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`flex size-10 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}
