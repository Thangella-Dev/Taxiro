import type { VehicleType } from "@/types/database";

export const VEHICLE_OPTIONS: Array<{
  description: string;
  label: string;
  surchargePerKm: number;
  type: VehicleType;
}> = [
  { description: "Fastest solo ride", label: "Bike", surchargePerKm: 0, type: "bike" },
  { description: "Covered three-wheeler", label: "Auto", surchargePerKm: 1, type: "auto" },
  { description: "Comfortable private ride", label: "Car", surchargePerKm: 2, type: "car" },
];

export function getVehicleLabel(type: VehicleType | null | undefined) {
  return VEHICLE_OPTIONS.find((option) => option.type === type)?.label ?? "Bike";
}

export function getVehicleSurcharge(type: VehicleType) {
  return VEHICLE_OPTIONS.find((option) => option.type === type)?.surchargePerKm ?? 0;
}