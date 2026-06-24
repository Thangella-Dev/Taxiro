"use client";

import dynamic from "next/dynamic";

export const DynamicMapPicker = dynamic(
  () => import("@/components/MapPicker").then((mod) => mod.MapPicker),
  {
    loading: () => (
      <div className="flex min-h-[16rem] items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
    ssr: false,
  },
);

