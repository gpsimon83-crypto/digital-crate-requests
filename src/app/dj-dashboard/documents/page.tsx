"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, ImageIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Col, Grid, INPUT, PageShell, SectionCard } from "@/components/layout/grid";
import { ListState } from "@/components/dj/booking-list";
import { useMyBookings } from "@/lib/dj/use-my-bookings";

type EventFile = { id: string; event_id: string; category: "contract" | "email_attachment" | "other"; file_url: string; file_name: string; source: string; created_at: string };
const CATEGORY: Record<EventFile["category"], string> = { contract: "Contract", email_attachment: "Email attachment", other: "File" };

/**
 * Documents & Library: the files on the DJ's bookings (contracts, email
 * attachments, uploads), searchable, plus a link to their flyer photo
 * uploads. Files open through the same protected links as on the booking.
 */
export default function DjDocumentsPage() {
  const { bookings, loading, error } = useMyBookings();
  const [files, setFiles] = useState<(EventFile & { title: string })[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (loading) return;
    let live = true;
    Promise.all(
      bookings.slice(0, 30).map((b) =>
        fetch(`/api/events/${b.id}/files`)
          .then((r) => (r.ok ? r.json() : { files: [] }))
          .then((d) => ((d.files ?? []) as EventFile[]).map((f) => ({ ...f, title: b.title })))
          .catch(() => [])
      )
    ).then((lists) => live && setFiles(lists.flat().sort((a, b) => b.created_at.localeCompare(a.created_at))));
    return () => {
      live = false;
    };
  }, [bookings, loading]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (files ?? []).filter((f) => !t || f.file_name.toLowerCase().includes(t) || f.title.toLowerCase().includes(t));
  }, [files, q]);
  const busy = loading || (files === null && !error);

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Resources" }, { label: "Documents & Library" }]} title="Documents & Library" subtitle="Files on your bookings, in one place." />
      <PageShell>
        <Grid>
          <Col span={8}>
            <SectionCard
              icon={FileText}
              title="Booking files"
              description="Contracts, email attachments and uploads on your bookings."
              actions={
                <label className="relative block w-full sm:w-64">
                  <span className="sr-only">Search files</span>
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file or booking" className={`${INPUT} pl-9`} type="search" />
                </label>
              }
            >
              <ListState loading={busy} error={error} empty={!shown.length} emptyText={q ? "No files match that search." : "No files on your bookings yet."} />
              {!busy && shown.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {shown.map((f) => (
                    <li key={f.id} className="flex min-w-0 items-start gap-3 rounded-[12px] border border-border p-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gold/12 text-gold" aria-hidden>
                        <FileText size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="block truncate rounded-[4px] text-sm font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                          {f.file_name}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {CATEGORY[f.category]} · {new Date(f.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <Link href={`/dj-dashboard/projects/${f.event_id}`} className="mt-0.5 block truncate text-xs text-muted hover:text-gold">
                          {f.title}
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </Col>
          <Col span={4}>
            <SectionCard icon={ImageIcon} title="My Uploads" description="Your photos and images for flyers. Only you and the office can see them.">
              <Link href="/dj-dashboard/flyers/library" className="inline-flex h-10 w-fit items-center rounded-[10px] border border-border px-4 text-sm font-semibold hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                Open My Uploads
              </Link>
            </SectionCard>
          </Col>
        </Grid>
      </PageShell>
    </>
  );
}
