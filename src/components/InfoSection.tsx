import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function InfoSection({
  icon: Icon,
  items,
  title,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
}) {
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
      </div>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li className="rounded-2xl bg-muted p-3" key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}