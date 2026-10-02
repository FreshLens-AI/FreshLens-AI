import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadTenantStock } from "@/lib/api/tenant-data";
import { formatNumber } from "@/lib/formatters";

export const metadata: Metadata = { title: "Tenant stock" };
const clock = new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" });
const when = (date: string | null) => date ? clock.format(new Date(date)) : "Not scheduled";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ freshness?: string; search?: string }> }) {
  const { freshness = "", search = "" } = await searchParams;
  const stock = await loadTenantStock();
  const rows = stock.filter((b) => (!freshness || (b.current_freshness ?? "unknown") === freshness) && b.product_name.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-stack">
    <PageHeader eyebrow="Tenant private" title="Available stock" description="Every batch with remaining stock, including spoiled stock that needs attention." />
    <form action="/workspace/stock" className="analytics-filters card">
      <label className="compact-select"><span>Product</span><input name="search" defaultValue={search} placeholder="Search products" /></label>
      <label className="compact-select"><span>Freshness</span><select name="freshness" defaultValue={freshness}><option value="">All stages</option><option value="fresh">Fresh</option><option value="medium">Medium</option><option value="spoiled">Spoiled</option><option value="unknown">Unclassified</option></select></label>
      <button className="button button--secondary button--md">Apply</button>
    </form>
    <Card><CardHeader title={`${formatNumber(rows.reduce((n, b) => n + b.quantity_remaining, 0))} units in ${rows.length} batches`} description="Freshness advances from the initial scan using saved shelf-life estimates. Dates are estimates, not confirmed expiry dates. Times are in Sri Lanka time." />
      <div className="table-wrap"><table><caption className="sr-only">Available batches and estimated freshness deadlines</caption>
        <thead><tr><th>Product / batch</th><th>Remaining / received</th><th>Received</th><th>Freshness</th><th>Expected medium</th><th>Expected spoilage</th></tr></thead>
        <tbody>{rows.map((b) => <tr key={b.id}>
          <td>{b.product_name} <code title={b.id}>{b.id.slice(0, 8)}</code></td><td>{formatNumber(b.quantity_remaining)} / {formatNumber(b.quantity_received)}</td><td>{when(b.intake_date)}</td>
          <td><Badge tone={b.current_freshness === "fresh" ? "success" : b.current_freshness === "medium" ? "warning" : b.current_freshness === "spoiled" ? "danger" : "neutral"}>{b.current_freshness ?? "Unclassified"}</Badge></td>
          <td>{when(b.fresh_to_medium_at)}</td><td>{when(b.medium_to_spoiled_at)}</td>
        </tr>)}</tbody>
      </table></div>{!rows.length ? <p className="context-note">{stock.length ? "No batches match these filters." : "No stock available. Completed produce scans add inventory here."}</p> : null}
    </Card>
  </div>;
}
