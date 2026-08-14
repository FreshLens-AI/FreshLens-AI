import { Suspense } from "react";

import {
  ProductDetailScreen,
  ProductDetailSkeleton,
} from "@/components/catalogue/product-detail";

export default function ProductPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetailScreen />
    </Suspense>
  );
}

