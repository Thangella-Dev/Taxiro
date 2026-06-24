import { type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function AdminStatsCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <Icon className="mb-4 size-5 text-primary" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}
