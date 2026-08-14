import { Badge } from "@/components/ui/badge";
import type { TenantStatus } from "@/types/domain";

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
