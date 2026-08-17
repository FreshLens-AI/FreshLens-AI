"use client";

import { BrainCircuit, CircleCheck, Clock3, LockKeyhole, TriangleAlert } from "lucide-react";

import { TrendChart } from "@/components/analytics/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatNumber } from "@/lib/formatters";
import { scanStatusTone, titleCase } from "@/lib/presentation";
import { useAdminData } from "@/store/admin-data-provider";

const statusIcons = {
  pending: Clock3,
  processing: BrainCircuit,
  completed: CircleCheck,
  failed: TriangleAlert,
};

export function ScanActivity() {
  const { pipelineSummary, trend } = useAdminData();
  const today = trend.at(-1)?.scans ?? 0;
  const total = trend.reduce((sum, point) => sum + point.scans, 0);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Aggregate operations" title="Scan activity" description="Live asynchronous pipeline totals and classification throughput without tenant-private scan records." />
      <Card className="privacy-banner privacy-banner--blue"><div className="privacy-banner__icon"><LockKeyhole size={19} /></div><div><strong>Aggregate operational view</strong><p>Images, quantities, products, batches, and individual scan histories remain tenant-private.</p></div></Card>
      <section className="pipeline-grid" aria-label="Scan status summary">
        {pipelineSummary.map((item) => {
          const Icon = statusIcons[item.status];
          return <Card className="pipeline-card" key={item.status}><span className={`pipeline-card__icon pipeline-card__icon--${item.status}`}><Icon size={20} /></span><div><Badge tone={scanStatusTone(item.status)}>{titleCase(item.status)}</Badge><strong>{formatNumber(item.count)}</strong><p>{item.helper}</p></div></Card>;
        })}
      </section>
      <Card className="chart-card">
        <CardHeader title="Accepted scan throughput" description="Platform aggregate · last 90 days" action={<Badge tone="info">Live API aggregate</Badge>} />
        <div className="chart-summary-row"><div><strong>{formatNumber(today)}</strong><span>accepted today</span></div><div><strong>{formatNumber(total)}</strong><span>last 90 days</span></div></div>
        <TrendChart data={trend} />
      </Card>
      <Card><CardHeader title="Status semantics" description="The exact lifecycle used throughout FreshLens V1" /><div className="status-explainer-grid">{pipelineSummary.map((item) => <div key={item.status}><Badge tone={scanStatusTone(item.status)}>{titleCase(item.status)}</Badge><p>{item.helper}</p></div>)}</div></Card>
    </div>
  );
}
