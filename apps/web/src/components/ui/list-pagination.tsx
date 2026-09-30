import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function ListPagination({ path, page, pageSize, total, filters = {} }: {
  path: string;
  page: number;
  pageSize: number;
  total: number;
  filters?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    params.set("page", String(target));
    return `${path}?${params}`;
  }
  return <nav className="list-pagination" aria-label="Results pagination">
    <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
    <div>
      {page > 1 ? <Link href={href(page - 1)} aria-label="Previous page"><ArrowLeft size={16} /></Link> : null}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)} aria-label="Next page"><ArrowRight size={16} /></Link> : null}
    </div>
  </nav>;
}
