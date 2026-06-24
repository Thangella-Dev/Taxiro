import { Card } from "@/components/ui/card";

export function DemandZoneCard({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{count}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        scheduled rides waiting near this area
      </p>
    </Card>
  );
}
