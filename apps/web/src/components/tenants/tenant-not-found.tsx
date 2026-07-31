import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function TenantNotFound() {
  return (
    <EmptyState
      icon={<Store size={24} aria-hidden="true" />}
      title="Tenant not found"
      description="This tenant ID is not available in the demo workspace. It may be incomplete or no longer valid."
      action={<Button href="/tenants">Return to tenants</Button>}
    />
  );
}
