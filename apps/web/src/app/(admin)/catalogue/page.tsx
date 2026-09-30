import { CatalogueScreen } from "@/components/catalogue/catalogue-screen";
import { loadProductPage } from "@/lib/api/admin-data";

export default async function CataloguePage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; tenant?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const tenantId = typeof params.tenant === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(params.tenant) ? params.tenant : undefined;
  const result = await loadProductPage(Number(params.page) || 1, search, tenantId);
  return <CatalogueScreen result={result} search={search} tenantId={tenantId} />;
}
