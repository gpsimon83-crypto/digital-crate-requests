"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  /** Hide this column below the given breakpoint, for tables with more columns than a phone screen can hold. */
  hideBelow?: "sm" | "md" | "lg";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Enabling this renders a built-in search box above the table. */
  searchFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** Extra controls (filter tabs, etc.) rendered in the toolbar row alongside search. */
  toolbar?: ReactNode;
  /** Rows per page. Omit or 0 to disable pagination. */
  pageSize?: number;
  loading?: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyBody?: string;
}

const ALIGN_CLASSES = { left: "text-left", right: "text-right", center: "text-center" } as const;
const HIDE_CLASSES = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

/**
 * The one table component for dense, real data — sticky header, optional
 * search, client-side sort, and pagination. Replaces raw `<table
 * className="data-table">` markup that every list page re-implemented on
 * its own `<thead>/<tbody>`.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  searchFn,
  searchPlaceholder = "Search…",
  toolbar,
  pageSize = 25,
  loading = false,
  emptyIcon,
  emptyTitle,
  emptyBody
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!searchFn || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchFn(r, q));
  }, [rows, searchFn, query]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const withKeys = filtered.map((row) => ({ row, v: col.sortValue!(row) }));
    withKeys.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : 0));
    if (sortDir === "desc") withKeys.reverse();
    return withKeys.map((x) => x.row);
  }, [filtered, columns, sortKey, sortDir]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = pageSize > 0 ? sorted.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize) : sorted;

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
    setPage(0);
  }

  const showToolbar = !!searchFn || !!toolbar;

  return (
    <div className="flex flex-col gap-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          {searchFn && (
            <div className="relative w-full max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-[10px] border border-border bg-card py-1.5 pl-8 pr-3 text-xs focus:border-gold focus:outline-none"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {!loading && sorted.length === 0 && <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />}

      {!loading && sorted.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(ALIGN_CLASSES[col.align ?? "left"], col.hideBelow && HIDE_CLASSES[col.hideBelow], "sticky top-0 z-10 bg-background")}
                    >
                      {col.sortValue ? (
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {col.header}
                          {sortKey === col.key &&
                            (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? "is-linked" : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn(ALIGN_CLASSES[col.align ?? "left"], col.hideBelow && HIDE_CLASSES[col.hideBelow], col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageSize > 0 && pageCount > 1 && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {pageSafe * pageSize + 1}–{Math.min(sorted.length, (pageSafe + 1) * pageSize)} of {sorted.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={pageSafe === 0}
                  className="rounded-[10px] border border-border px-2.5 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  Page {pageSafe + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={pageSafe >= pageCount - 1}
                  className="rounded-[10px] border border-border px-2.5 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
