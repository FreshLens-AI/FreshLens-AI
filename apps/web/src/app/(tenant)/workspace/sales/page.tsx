import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShoppingBasket, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { loadTenantSales } from "@/lib/api/tenant-data";
import { formatNumber } from "@/lib/formatters";

export const metadata: Metadata = { title: "Tenant sales" };
const clock = new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" });

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ days?: string; page?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const sales = await loadTenantSales(days, page);
  const lastPage = Math.max(1, Math.ceil(sales.total / sales.limit));
  if (page > lastPage) redirect(`/workspace/sales?days=${days}&page=${lastPage}`);
  const units = sales.trend.reduce((n, d) => n + d.units, 0);
  const transactions = sales.trend.reduce((n, d) => n + d.transactions, 0);
  const maximum = Math.max(1, ...sales.trend.map((d) => d.units));
  return <div className="page-stack">
    <PageHeader eyebrow="Tenant private" title="Sales history" description="Confirmed sales across your tenant. Sales volume is measured in units; prices are not recorded." />
    <form action="/workspace/sales" className="analytics-filters card">
      <label className="compact-select"><span>Trend period</span><select name="days" defaultValue={days}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <button className="button button--secondary button--md">Apply</button>
    </form>
    <section className="stat-grid stat-grid--three">
      <StatCard label="Units sold" value={formatNumber(units)} helper={`last ${days} days`} icon={<ShoppingBasket size={21} />} />
      <StatCard label="Transactions" value={formatNumber(transactions)} helper={`last ${days} days`} icon={<TrendingUp size={21} />} tone="blue" />
      <StatCard label="Units per day" value={(units / days).toFixed(1)} helper="includes days without sales" icon={<TrendingUp size={21} />} tone="amber" />
    </section>
    <Card><CardHeader title="Daily sales volume" description={`Last ${days} calendar days, including today. Sri Lanka time.`} />
      <div className="trend-chart"><svg viewBox="0 0 720 238" role="img" aria-label={`Units sold per day over ${days} days`}>
        {sales.trend.map((d, i) => <rect key={d.date} x={i * 720 / days + 2} y={218 - d.units / maximum * 198} width={Math.max(1, 720 / days - 4)} height={d.units / maximum * 198} fill="var(--brand-600)"><title>{`${d.date}: ${d.units} units, ${d.transactions} transactions`}</title></rect>)}
      </svg><div className="trend-chart__labels"><span>{sales.trend[0]?.date}</span><span>{sales.trend.at(-1)?.date}</span></div></div>
      {!units ? <p className="context-note">No sales in this period.</p> : null}
      <details><summary className="context-note">View daily figures</summary><div className="table-wrap"><table><caption className="sr-only">Daily sales totals</caption><thead><tr><th>Date</th><th>Transactions</th><th>Units</th></tr></thead><tbody>{sales.trend.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.transactions}</td><td>{d.units}</td></tr>)}</tbody></table></div></details>
    </Card>
    <Card><CardHeader title="Sale line items" description="All-time history, newest first. Each product in a transaction appears separately. Times are in Sri Lanka time." />
      <div className="table-wrap"><table><caption className="sr-only">Confirmed sale line items</caption><thead><tr><th>Sold at</th><th>Transaction</th><th>Product / batch</th><th>Units sold</th><th>Sold by</th><th>Entry</th></tr></thead>
        <tbody>{sales.items.map((s) => <tr key={s.id}><td>{clock.format(new Date(s.created_at))}</td><td><code title={s.sale_id}>{s.sale_id.slice(0, 8)}</code></td><td>{s.product_name} <code title={s.batch_id}>{s.batch_id.slice(0, 8)}</code></td><td>{formatNumber(s.quantity_sold)}</td><td>{s.seller}</td><td>{s.source}</td></tr>)}</tbody>
      </table></div>{!sales.items.length ? <p className="context-note">{sales.total ? "No sales on this page." : "No sales recorded yet."}</p> : null}
      <ListPagination path="/workspace/sales" page={page} pageSize={sales.limit} total={sales.total} filters={{ days: String(days) }} />
    </Card>
  </div>;
}
