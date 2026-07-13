import { type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "taxiro-input h-11 min-w-0 w-full max-w-full rounded-full border border-border bg-card/92 px-4 text-base outline-none transition-[border-color,box-shadow,background-color,transform] duration-300 placeholder:text-muted-foreground/70 focus:border-primary/35 focus:bg-card focus:ring-2 focus:ring-ring sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
