import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Card className="grid justify-items-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </Card>
  );
}
