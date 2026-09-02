// Reusable pagination control for LimitOffset-paginated lists.
// `page` is 0-indexed; parent computes offset = page * pageSize.
export default function Pager({ page, pageSize, total, onPage }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void;
}) {
  if (total <= pageSize) return null; // nothing to page through
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-40";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-fg-muted tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="text-sm text-fg-dim tabular-nums">Page {page + 1} of {pages}</span>
        <button className={btn} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
