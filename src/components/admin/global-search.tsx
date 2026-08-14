"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "event" | "client" | "dj" | "venue";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  event: "Events",
  client: "Clients",
  dj: "DJs",
  venue: "Venues"
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") closeSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults(null);
        return;
      }
      fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function go(href: string) {
    closeSearch();
    router.push(href);
  }

  const grouped = (["event", "client", "dj", "venue"] as const)
    .map((type) => ({ type, items: (results ?? []).filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <Search size={18} className="shrink-0" />
        <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100">Search</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => setOpen(false)}>
            <div className="w-full max-w-lg rounded-[3px] border border-black/10 bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 border-b border-black/10 px-4 py-3">
                <Search size={16} className="shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events, clients, DJs, venues..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
                {query.trim().length >= 2 && results === null && <Loader2 size={14} className="shrink-0 animate-spin text-muted" />}
              </div>

              <div className="max-h-[50vh] overflow-y-auto p-2">
                {query.trim().length < 2 && <p className="px-3 py-6 text-center text-xs text-muted">Type at least 2 characters to search.</p>}
                {query.trim().length >= 2 && results !== null && results.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted">No matches for &quot;{query}&quot;.</p>
                )}
                {grouped.map((g) => (
                  <div key={g.type} className="mb-2 last:mb-0">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{TYPE_LABEL[g.type]}</p>
                    {g.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => go(item.href)}
                        className={cn("flex w-full flex-col items-start gap-0.5 rounded-[2px] px-3 py-2 text-left transition-colors hover:bg-gold/10")}
                      >
                        <span className="text-sm">{item.title}</span>
                        {item.subtitle && <span className="text-xs text-muted">{item.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
