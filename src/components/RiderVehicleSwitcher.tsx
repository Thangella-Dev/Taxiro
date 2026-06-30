"use client";

import { Bike, CarFront, CarTaxiFront, ShieldCheck } from "lucide-react";

import { VEHICLE_OPTIONS } from "@/lib/vehicles";
import type { RiderVehicle, VehicleType } from "@/types/database";

export function RiderVehicleSwitcher({
  activeType,
  busy,
  disabled,
  onSwitch,
  vehicles,
}: {
  activeType: VehicleType | null;
  busy: boolean;
  disabled: boolean;
  onSwitch: (type: VehicleType) => void;
  vehicles: RiderVehicle[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">Active vehicle</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only verified vehicles can receive matching rides.
          </p>
        </div>
        <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {VEHICLE_OPTIONS.map((option) => {
          const Icon = option.type === "bike" ? Bike : option.type === "auto" ? CarTaxiFront : CarFront;
          const vehicle = vehicles.find((item) => item.vehicle_type === option.type);
          const verified = vehicle?.verification_status === "verified";
          const active = activeType === option.type;
          return (
            <button
              aria-pressed={active}
              className={active ? "min-w-0 rounded-lg bg-primary p-2.5 text-primary-foreground" : "min-w-0 rounded-lg bg-muted p-2.5 disabled:cursor-not-allowed disabled:opacity-45"}
              disabled={busy || disabled || !verified}
              key={option.type}
              onClick={() => onSwitch(option.type)}
              type="button"
            >
              <Icon className="mx-auto size-5" />
              <span className="mt-1 block truncate text-xs font-black">{option.label}</span>
              <span className="mt-0.5 block truncate text-[9px] capitalize opacity-70">
                {active ? "active" : vehicle?.verification_status ?? "not added"}
              </span>
            </button>
          );
        })}
      </div>
      {disabled ? <p className="mt-2 text-xs font-semibold text-amber-700">Finish the active ride before switching vehicles.</p> : null}
      {!vehicles.some((vehicle) => vehicle.verification_status === "verified") ? (
        <p className="mt-2 text-xs font-semibold text-amber-700">Add a vehicle in the menu and wait for admin verification before going online.</p>
      ) : null}
    </section>
  );
}