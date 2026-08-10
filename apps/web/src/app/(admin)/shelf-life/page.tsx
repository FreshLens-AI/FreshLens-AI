import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Shelf-life rules" };

export default function StubPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coming next"
        title="Shelf-life rules"
        description="This screen ships in a follow-up split PR from mega-PR #70."
      />
      <Card>
        <p>Category shelf-life rules UI is intentionally stubbed here so auth, shell, and overview can review independently.</p>
      </Card>
    </div>
  );
}
