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
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
      </div>
      <ul className="mt-4 divide-y divide-border text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li className="flex gap-3 py-3 first:pt-0 last:pb-0" key={item}>
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
