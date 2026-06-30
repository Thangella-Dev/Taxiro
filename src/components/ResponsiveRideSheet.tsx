"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface ResponsiveRideSheetProps {
  children: ReactNode;
  className?: string;
  desktopSide?: "left" | "right";
  mobileLabel?: string;
}

export function ResponsiveRideSheet({
  children,
  className,
  desktopSide = "left",
  mobileLabel = "ride panel",
}: ResponsiveRideSheetProps) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(true);
  const pointerStart = useRef<number | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    pointerStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (pointerStart.current === null) return;
    const delta = event.clientY - pointerStart.current;
    setDragOffset(Math.max(-160, Math.min(220, delta)));
  }

  function finishPointer(event: PointerEvent<HTMLButtonElement>) {
    if (pointerStart.current === null) return;
    const delta = event.clientY - pointerStart.current;
    if (delta > 42) setMobileOpen(false);
    else if (delta < -42) setMobileOpen(true);
    else if (Math.abs(delta) < 8) setMobileOpen((current) => !current);
    pointerStart.current = null;
    setDragOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointer() {
    pointerStart.current = null;
    setDragOffset(0);
  }

  function handleHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setMobileOpen((current) => !current);
  }

  return (
    <section
      className={cn(
        "taxiro-sheet-shell taxiro-responsive-sheet min-w-0 max-w-full overflow-x-clip",
        desktopSide === "right"
          ? "taxiro-sheet-side-right"
          : "taxiro-sheet-side-left",
        className,
      )}
      data-desktop-open={desktopOpen}
      data-mobile-open={mobileOpen}
      style={{ "--taxiro-sheet-drag-y": `${dragOffset}px` } as CSSProperties}
    >
      <button
        aria-expanded={mobileOpen}
        aria-label={`${mobileOpen ? "Collapse" : "Open"} ${mobileLabel}`}
        className="taxiro-sheet-drag-handle"
        onKeyDown={handleHandleKeyDown}
        onPointerCancel={cancelPointer}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        type="button"
      >
        <span className="taxiro-sheet-grabber" />
        {mobileOpen ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronUp className="size-4" />
        )}
      </button>

      <button
        aria-expanded={desktopOpen}
        aria-label={`${desktopOpen ? "Hide" : "Show"} ${mobileLabel}`}
        className="taxiro-sheet-side-toggle"
        onClick={() => setDesktopOpen((current) => !current)}
        type="button"
      >
        {desktopSide === "right" ? (
          desktopOpen ? (
            <ChevronRight className="size-5" />
          ) : (
            <ChevronLeft className="size-5" />
          )
        ) : desktopOpen ? (
          <ChevronLeft className="size-5" />
        ) : (
          <ChevronRight className="size-5" />
        )}
        <span className="taxiro-sheet-side-toggle-label">
          {desktopOpen ? "Hide" : "Open"}
        </span>
      </button>

      <div className="taxiro-sheet-surface min-w-0 max-w-full">{children}</div>
    </section>
  );
}
