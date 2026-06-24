"use client";

import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
}: {
  tabs: Array<{ label: string; content: ReactNode }>;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-muted p-1">
        {tabs.map((tab, index) => (
          <button
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              active === index ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
            key={tab.label}
            onClick={() => setActive(index)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[active]?.content}
    </div>
  );
}
