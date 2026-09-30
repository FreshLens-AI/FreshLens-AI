import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/catalogue/product-detail";
import { loadProductPage } from "@/lib/api/admin-data";
import { AdminDataProvider } from "@/store/admin-data-provider";

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(productId)) notFound();
  const products = await loadProductPage(1, "", undefined, productId);
  if (!products.items.length) notFound();
  return <AdminDataProvider initialData={{ tenants: [], products: products.items, alerts: [], trend: [], pipelineSummary: [] }}>
    <ProductDetailScreen />
  </AdminDataProvider>;
}
