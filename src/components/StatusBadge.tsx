import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RideStatus } from "@/types/database";

const statusClasses: Record<RideStatus, string> = {
  assigned: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  completed: "bg-zinc-100 text-zinc-700",
  ready: "bg-amber-50 text-amber-700",
  scheduled: "bg-blue-50 text-blue-700",
  started: "bg-purple-50 text-purple-700",
};

export function StatusBadge({ status }: { status: RideStatus }) {
  return (
    <Badge className={cn("capitalize", statusClasses[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
