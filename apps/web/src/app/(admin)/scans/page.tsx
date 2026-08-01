import type { Metadata } from "next";
import { Activity, BrainCircuit, CircleCheck, Clock3, LockKeyhole, ServerCog, TriangleAlert } from "lucide-react";

import { TrendChart } from "@/components/analytics/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { platformTrend, pipelineSummary } from "@/data/mock-data";
import { formatNumber } from "@/lib/formatters";
import { scanStatusTone, titleCase } from "@/lib/presentation";

export const metadata: Metadata = { title: "Scan activity" };

const statusIcons = {
  pending: Clock3,
  processing: BrainCircuit,
  completed: CircleCheck,
  failed: TriangleAlert,
};

export default function ScansPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Aggregate operations" title="Scan activity" description="Monitor asynchronous pipeline health and classification throughput without opening tenant-private scan records." />

      <Card className="privacy-banner privacy-banner--blue">
        <div className="privacy-banner__icon"><LockKeyhole size={19} /></div>
        <div><strong>Aggregate operational view</strong><p>Platform administrators can see queue totals and service health. Images, quantities, products, batches, and individual scan histories remain tenant-private.</p></div>
      </Card>

      <section className="pipeline-grid" aria-label="Scan status summary">
        {pipelineSummary.map((item) => {
          const Icon = statusIcons[item.status];
          return (
            <Card className="pipeline-card" key={item.status}>
              <span className={`pipeline-card__icon pipeline-card__icon--${item.status}`}><Icon size={20} /></span>
              <div><Badge tone={scanStatusTone(item.status)}>{titleCase(item.status)}</Badge><strong>{formatNumber(item.count)}</strong><p>{item.helper}</p></div>
            </Card>
          );
        })}
      </section>

      <section className="dashboard-main-grid">
        <Card className="chart-card">
          <CardHeader title="Accepted scan throughput" description="Platform aggregate · last 12 days" action={<Badge tone="success">Within target</Badge>} />
          <div className="chart-summary-row"><div><strong>241</strong><span>accepted today</span></div><div><strong>1.4s</strong><span>median acceptance</span></div><div><strong>18s</strong><span>median classification</span></div></div>
          <TrendChart data={platformTrend} />
        </Card>
        <Card>
          <CardHeader title="Pipeline services" description="Representative local environment health" />
          <div className="service-list">
            <div><span className="service-list__icon"><ServerCog size={18} /></span><div><strong>FastAPI accept path</strong><p>Returns before model inference</p></div><Badge tone="success">Operational</Badge></div>
            <div><span className="service-list__icon"><Activity size={18} /></span><div><strong>Redis queue</strong><p>12 jobs waiting</p></div><Badge tone="success">Healthy</Badge></div>
            <div><span className="service-list__icon"><BrainCircuit size={18} /></span><div><strong>Celery classifier</strong><p>5 jobs processing</p></div><Badge tone="success">Operational</Badge></div>
            <div><span className="service-list__icon"><CircleCheck size={18} /></span><div><strong>Model version</strong><p>Stub classifier for mid-evaluation</p></div><Badge tone="info" dot={false}>stub-v0</Badge></div>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader title="Status semantics" description="The exact lifecycle used throughout FreshLens V1" />
        <div className="status-explainer-grid">
          {pipelineSummary.map((item) => <div key={item.status}><Badge tone={scanStatusTone(item.status)}>{titleCase(item.status)}</Badge><p>{item.status === "pending" ? "Accepted and safely queued; no final result yet." : item.status === "processing" ? "Background classification is in progress; no final result yet." : item.status === "completed" ? "A valid Fresh, Medium, or Spoiled label was persisted." : "Classification stopped with a terminal failure and can be retried by the vendor."}</p></div>)}
        </div>
      </Card>
    </div>
  );
}
