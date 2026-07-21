import type { VehicleType } from "@/types/database";

export const CUSTOMER_VEHICLE_TYPES = [
  "bike",
  "auto",
  "hatchback",
  "sedan",
  "suv",
] as const satisfies readonly VehicleType[];

export const VEHICLE_OPTIONS: Array<{
  description: string;
  label: string;
  type: VehicleType;
}> = [
  { description: "Fast solo city trips", label: "Bike", type: "bike" },
  { description: "Open local three-wheeler", label: "Auto", type: "auto" },
  { description: "Compact private car", label: "Hatchback", type: "hatchback" },
  { description: "Comfort city sedan", label: "Sedan", type: "sedan" },
  { description: "Large family ride", label: "SUV", type: "suv" },
];

export function getVehicleLabel(type: VehicleType | null | undefined) {
  if (type === "car") return "Sedan";
  return VEHICLE_OPTIONS.find((option) => option.type === type)?.label ?? "Bike";
}

export function normalizeVehicleType(type: VehicleType | string): VehicleType {
  return type === "car" ? "sedan" : (type as VehicleType);
}