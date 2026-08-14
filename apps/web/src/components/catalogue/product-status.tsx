import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ProductStatus } from "@/types/domain";

const labels: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

const tones: Record<ProductStatus, BadgeTone> = {
  active: "success",
  draft: "warning",
  archived: "neutral",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

