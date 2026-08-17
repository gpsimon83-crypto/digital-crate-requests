"use client";

import { Suspense, useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/lib/pipeline-stage";
import { MilestoneStepper } from "@/components/project/milestone-stepper";

// The stepper shows the forward-moving path only — Declined/Archived are
// exceptions handled via the Pipeline Stage dropdown in the sidebar, not
// steps a project "arrives at" in sequence.
const FORWARD_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => s !== "Declined" && s !== "Archived");
import { type MergeContext } from "@/lib/merge-fields";
import { clientName } from "@/lib/format";
import { EmailThreadPanel } from "@/components/project/email-thread-panel";
import { TasksPanel } from "@/components/project/tasks-panel";
import { FilesPanel } from "@/components/project/files-panel";
import { ContractsPanel, type ContractRow } from "@/components/project/contracts-panel";
import { EquipmentAssignmentsPanel } from "@/components/project/equipment-assignments-panel";
import { QuestionnaireSummary } from "@/components/project/questionnaire-summary";
import { PackageRecommendation } from "@/components/project/package-recommendation";
import {
  ArrowLeft,
  Copy,
  Check,
  FileText,
  X,
  CalendarDays,
  MapPin,
  Camera,
  Music2,
  ExternalLink
} from "lucide-react";

interface ClientRow {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  referral_source: string | null;
  tags: string[] | null;
}

interface PaymentRow {
  id: string;
  kind: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface EventDetail {
  id: string;
  event_code: string;
  title: string;
  status: string;
  pipeline_stage: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  hero_image_url: string | null;
  event_type: string | null;
  service_type: string | null;
  expected_guests: number | null;
  special_requests: string | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  wedding_music_plan: (Record<string, string | string[] | undefined> & { spotify_ids?: Record<string, string> }) | null;
  wedding_music_plan_sent_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_amount: number | null;
  internal_notes: string | null;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: ClientRow | null;
}

interface Balance {
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
}

interface ClientOption {
  id: string;
  label: string;
}

const TABS = ["Activity", "Files", "Tasks", "Financials", "Notes", "Details"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = TABS.map((t) => ({ key: t, label: t }));

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "inquiry", label: "Inquiry" },
  { value: "pending_confirmation", label: "Pending Confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "live", label: "Live" },
  { value: "ended", label: "Completed" },
  { value: "declined", label: "Declined" }
];

const WEDDING_PLAN_FIELDS: { key: string; label: string }[] = [
  { key: "processional_song", label: "Processional" },
  { key: "wedding_party_entrance_song", label: "Wedding party entrance" },
  { key: "bride_entrance_song", label: "Bride entrance" },
  { key: "recessional_song", label: "Recessional" },
  { key: "bridal_party_order", label: "Bridal party order" },
  { key: "grand_march_song", label: "Grand march" },
  { key: "first_dance_song", label: "First dance" },
  { key: "father_daughter_song", label: "Father/daughter dance" },
  { key: "mother_son_song", label: "Mother/son dance" },
  { key: "special_dances", label: "Special dances" },
  { key: "special_dance_songs", label: "Special dance songs" },
  { key: "games", label: "Reception games" }
];

const WEDDING_SONG_FIELDS = WEDDING_PLAN_FIELDS.filter(
  ({ key }) => key.endsWith("_song") && key !== "special_dance_songs"
);

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminEventDetailInner params={params} />
    </Suspense>
  );
}

function AdminEventDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab | null) ?? "Activity";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [changingContact, setChangingContact] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingPipelineStage, setSavingPipelineStage] = useState(false);
  const [sendingMusicPlan, setSendingMusicPlan] = useState(false);

  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const [leadSourceDraft, setLeadSourceDraft] = useState("");
  const [newTag, setNewTag] = useState("");

  const [copied, setCopied] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileInput = useRef<HTMLInputElement | null>(null);

  function buildMergeContext(): MergeContext {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!event) return { portalLink: `${origin}/portal/events/${id}`, schedulerLink: `${origin}/schedule` };
    const name = clientName(event.clients);
    const totalDueCents = balance?.totalDueCents ?? 0;
    const balanceCents = balance?.balanceCents ?? 0;

    return {
      clientFirstName: event.clients?.first_name ?? name ?? undefined,
      clientFullName: name ?? undefined,
      eventType: event.event_type ?? undefined,
      eventDate: event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : undefined,
      eventTime: event.starts_at ? new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
      eventEndTime: event.ends_at ? new Date(event.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
      venueName: event.venues?.name ?? undefined,
      guestCount: event.expected_guests != null ? String(event.expected_guests) : undefined,
      djName: event.djs?.display_name ?? undefined,
      totalAmount: totalDueCents ? money(totalDueCents) : undefined,
      depositAmount: event.deposit_amount != null ? money(Math.round(event.deposit_amount * 100)) : undefined,
      balanceDue: money(balanceCents),
      portalLink: `${origin}/portal/events/${id}`,
      schedulerLink: `${origin}/schedule`,
      eventCode: event.event_code
    };
  }

  async function load() {
    try {
      const [eventRes, clientsRes, contractsRes] = await Promise.all([
        fetch(`/api/admin/events/${id}`),
        fetch("/api/admin/clients"),
        fetch(`/api/events/${id}/contracts`)
      ]);
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.error || "Failed to load project");
      setEvent(eventData.event);
      setPayments(eventData.payments ?? []);
      setBalance(eventData.balance);

      const contractsData = await contractsRes.json();
      setContracts(contractsRes.ok ? contractsData.contracts ?? [] : []);
      setNotesDraft(eventData.event.internal_notes ?? "");
      setLeadSourceDraft(eventData.event.clients?.referral_source ?? "");

      const clientsData = await clientsRes.json();
      if (clientsRes.ok) {
        setClientOptions(
          (clientsData.clients ?? []).map((c: ClientRow) => ({ id: c.id, label: clientName(c) ?? "Unnamed client" }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patchEvent(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save");
    return data.event as EventDetail;
  }

  async function handleStageChange(status: string) {
    setSavingStage(true);
    try {
      const updated = await patchEvent({ status });
      setEvent((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingStage(false);
    }
  }

  async function handlePipelineStageChange(pipelineStage: string) {
    setSavingPipelineStage(true);
    try {
      const updated = await patchEvent({ pipelineStage });
      setEvent((prev) => (prev ? { ...prev, pipeline_stage: updated.pipeline_stage } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingPipelineStage(false);
    }
  }

  async function handleSendMusicPlan() {
    setSendingMusicPlan(true);
    try {
      const updated = await patchEvent({ sendWeddingMusicPlan: true });
      setEvent((prev) => (prev ? { ...prev, wedding_music_plan_sent_at: updated.wedding_music_plan_sent_at } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingMusicPlan(false);
    }
  }

  async function handleContactChange(clientId: string) {
    try {
      await patchEvent({ clientId: clientId || null });
      setChangingContact(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await patchEvent({ internalNotes: notesDraft });
      setNotesSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function patchClient(body: Record<string, unknown>) {
    if (!event?.clients) return;
    const res = await fetch(`/api/admin/clients/${event.clients.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save");
    setEvent((prev) => (prev ? { ...prev, clients: data.client } : prev));
  }

  async function handleSaveLeadSource() {
    try {
      await patchClient({ referral_source: leadSourceDraft || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleAddTag() {
    if (!newTag.trim() || !event?.clients) return;
    const tags = [...(event.clients.tags ?? []), newTag.trim()];
    setNewTag("");
    try {
      await patchClient({ tags });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!event?.clients) return;
    const tags = (event.clients.tags ?? []).filter((t) => t !== tag);
    try {
      await patchClient({ tags });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleHeroPhotoSelected(file: File) {
    setUploadingHero(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("heroPhoto", file);
      const res = await fetch(`/api/events/${id}/settings`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      setEvent((prev) => (prev ? { ...prev, hero_image_url: data.event.hero_image_url } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploadingHero(false);
    }
  }

  async function handleRemoveHeroPhoto() {
    setUploadingHero(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("clearHero", "true");
      const res = await fetch(`/api/events/${id}/settings`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      setEvent((prev) => (prev ? { ...prev, hero_image_url: data.event.hero_image_url } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploadingHero(false);
    }
  }

  function copyPortalLink() {
    const url = `${window.location.origin}/portal`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copySpotifyLinks() {
    const ids = event?.wedding_music_plan?.spotify_ids ?? {};
    const links = WEDDING_SONG_FIELDS.map(({ key }) => ids[key]).filter(Boolean).map((trackId) => `https://open.spotify.com/track/${trackId}`);
    if (links.length === 0) return;
    navigator.clipboard.writeText(links.join("\n"));
    setCopiedLinks(true);
    setTimeout(() => setCopiedLinks(false), 1500);
  }

  if (error && !event) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/events" className="mt-4 inline-block text-sm text-gold">← Back to Projects</Link>
      </div>
    );
  }

  if (!event) {
    return <div className="p-8 text-sm text-muted">Loading...</div>;
  }

  const activity: { label: string; at: string }[] = [
    { label: "Project created", at: event.created_at },
    ...contracts.filter((c) => c.sent_at).map((c) => ({ label: `Contract sent — ${c.title}`, at: c.sent_at as string })),
    ...contracts
      .filter((c) => c.signed_at)
      .map((c) => ({ label: `Contract signed by ${c.signed_by_name}`, at: c.signed_at as string })),
    ...payments
      .filter((p) => p.status === "succeeded")
      .map((p) => ({ label: `${money(p.amount_cents)} ${p.kind} payment received`, at: p.paid_at ?? p.created_at }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const name = clientName(event.clients);

  return (
    <div className="pb-16">
      <Link
        href="/admin/events"
        className="ml-6 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1.5px] text-muted hover:text-foreground sm:ml-8"
      >
        <ArrowLeft size={14} /> Projects
      </Link>

      <div
        className={cn(
          "relative mx-6 mt-3 flex min-h-[160px] flex-col justify-end overflow-hidden border border-border bg-cover bg-center p-6 sm:mx-8 sm:p-8",
          !event.hero_image_url && "bg-none"
        )}
        style={
          event.hero_image_url
            ? { backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${event.hero_image_url})` }
            : { background: "linear-gradient(135deg, var(--gold-dim), var(--gold) 70%, var(--gold-light))" }
        }
      >
        <input
          ref={heroFileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleHeroPhotoSelected(file);
          }}
        />
        <div className="absolute right-4 top-4 flex gap-1.5">
          {event.hero_image_url && (
            <button
              onClick={handleRemoveHeroPhoto}
              disabled={uploadingHero}
              title="Remove banner photo"
              className="rounded-[10px] bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => heroFileInput.current?.click()}
            disabled={uploadingHero}
            title={event.hero_image_url ? "Change banner photo" : "Add a banner photo"}
            className="rounded-[10px] bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
          >
            <Camera size={14} />
          </button>
        </div>

        <p
          className={cn(
            "font-display text-4xl font-light sm:text-5xl",
            event.hero_image_url ? "text-white" : "text-[#1A140A]"
          )}
        >
          {event.title}
        </p>
        <p
          className={cn(
            "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm",
            event.hero_image_url ? "text-white/85" : "text-[#1A140A]/80"
          )}
        >
          {event.event_type && <span className="capitalize">{event.event_type}</span>}
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {event.starts_at
              ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })
              : "Date TBD"}
          </span>
          {event.venues?.name && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {event.venues.name}
            </span>
          )}
        </p>
      </div>
      <p className="mx-6 mt-2 text-[11px] text-muted sm:mx-8">
        This banner photo also becomes the hero image guests see on the event&rsquo;s Crate Request page.
      </p>

      <div className="mx-6 mt-6 sm:mx-8">
        <MilestoneStepper
          stages={FORWARD_PIPELINE_STAGES}
          current={event.pipeline_stage ?? "Inquiry"}
          onSelect={handlePipelineStageChange}
          disabled={savingPipelineStage}
        />
      </div>

      <div className="mx-6 mt-6 flex flex-col gap-8 sm:mx-8 lg:flex-row">
        <div className="flex-1">
          <p className="mb-2 text-[10px] uppercase tracking-[1.5px] text-muted">Contact</p>
          {!changingContact ? (
            <div className="flex items-center gap-3">
              {name ? (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)] text-xs font-bold text-black">
                    {initials(name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                      {event.clients?.email && <span>{event.clients.email}</span>}
                      {event.clients?.phone && <span>{event.clients.phone}</span>}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">No contact linked</p>
              )}
              <button onClick={() => setChangingContact(true)} className="ml-2 text-xs text-gold hover:underline">
                {name ? "Change" : "Link a client"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                defaultValue={event.clients?.id ?? ""}
                onChange={(e) => handleContactChange(e.target.value)}
                className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">No client linked</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button onClick={() => setChangingContact(false)} className="text-xs text-muted hover:text-foreground">
                Cancel
              </button>
            </div>
          )}

          <Tabs items={TAB_ITEMS} active={activeTab} hrefFor={(key) => `/admin/events/${id}?tab=${key}`} className="mt-6" />

          {error && <p className="mt-3 text-sm text-status-declined">{error}</p>}

          {activeTab === "Activity" && (
            <div className="mt-6 flex flex-col gap-8">
              <EmailThreadPanel
                eventId={id}
                hasClient={!!event.clients}
                clientDisplayName={clientName(event.clients)}
                clientEmail={event.clients?.email ?? null}
                mergeContext={buildMergeContext()}
              />

              <section className="flex flex-col divide-y divide-border border-y border-border">
                <p className="pb-2 text-xs font-semibold uppercase tracking-[1.5px] text-muted">Timeline</p>
                {activity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-3 last:pb-0">
                    <span className="text-sm">{a.label}</span>
                    <span className="text-xs text-muted">{new Date(a.at).toLocaleString()}</span>
                  </div>
                ))}
              </section>
            </div>
          )}

          {activeTab === "Files" && (
            <div className="mt-6 flex flex-col gap-4">
              <GlassCard className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gold" />
                  <div>
                    <p className="text-sm font-medium">Invoice</p>
                    <p className="text-xs text-muted">Auto-built from the booking price and payments on file.</p>
                  </div>
                </div>
                <a href={`/admin/events/${id}/invoice`} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    View Invoice
                  </Button>
                </a>
              </GlassCard>

              <FilesPanel eventId={id} />

              {event.event_type?.toLowerCase() === "wedding" && (
                <GlassCard className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Music2 size={16} className="text-gold" />
                    <div>
                      <p className="text-sm font-medium">Wedding Music Plan</p>
                      <p className="text-xs text-muted">
                        {event.wedding_music_plan_sent_at
                          ? `Sent ${new Date(event.wedding_music_plan_sent_at).toLocaleDateString()}`
                          : "Not sent yet — the client won't see this form until you send it."}
                      </p>
                    </div>
                  </div>
                  {!event.wedding_music_plan_sent_at && (
                    <Button variant="primary" size="sm" onClick={handleSendMusicPlan} disabled={sendingMusicPlan}>
                      {sendingMusicPlan ? "Sending…" : "Send"}
                    </Button>
                  )}
                </GlassCard>
              )}

              {event.event_type?.toLowerCase() === "wedding" && event.wedding_music_plan_sent_at && (() => {
                const plan = event.wedding_music_plan ?? {};
                const spotifyIds = plan.spotify_ids ?? {};
                const rows = WEDDING_SONG_FIELDS.map(({ key, label }) => ({
                  key,
                  label,
                  text: plan[key] as string | undefined,
                  spotifyId: spotifyIds[key]
                })).filter((row) => row.text);
                const linkCount = rows.filter((row) => row.spotifyId).length;

                return (
                  <GlassCard className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Music2 size={16} className="text-gold" />
                        <p className="text-sm font-medium">Wedding Playlist</p>
                      </div>
                      {linkCount > 0 && (
                        <Button variant="secondary" size="sm" onClick={copySpotifyLinks}>
                          {copiedLinks ? "Copied!" : `Copy ${linkCount} Spotify link${linkCount === 1 ? "" : "s"}`}
                        </Button>
                      )}
                    </div>
                    {rows.length === 0 ? (
                      <p className="text-xs text-muted">The couple hasn&rsquo;t added any songs yet.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border">
                        {rows.map((row) => (
                          <div key={row.key} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted">{row.label}</p>
                              <p className="truncate text-sm">{row.text}</p>
                            </div>
                            {row.spotifyId && (
                              <a
                                href={`https://open.spotify.com/track/${row.spotifyId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex shrink-0 items-center gap-1 text-xs text-gold hover:underline"
                              >
                                Open <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                );
              })()}

            </div>
          )}

          {activeTab === "Tasks" && (
            <div className="mt-6">
              <TasksPanel eventId={id} />
            </div>
          )}

          {activeTab === "Financials" && (
            <div className="mt-6 flex flex-col gap-4">
              <GlassCard className="flex flex-col gap-1">
                <Row label="Quoted amount" value={event.quoted_amount != null ? `$${event.quoted_amount.toFixed(2)}` : "—"} />
                <Row label="Final amount" value={event.final_amount != null ? `$${event.final_amount.toFixed(2)}` : "—"} />
                <Row label="Deposit" value={event.deposit_amount != null ? `$${event.deposit_amount.toFixed(2)}` : "—"} />
                {balance && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <Row label="Paid so far" value={money(balance.paidCents)} />
                    <Row label="Balance due" value={money(balance.balanceCents)} bold />
                  </>
                )}
              </GlassCard>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[1.5px] text-muted">Payment history</p>
                <div className="flex flex-col divide-y divide-border border-y border-border">
                  {payments.length === 0 && <p className="py-3 text-sm text-muted">No payments yet.</p>}
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <span className="text-sm capitalize">{p.kind}</span>
                      <span className="text-xs text-muted">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</span>
                      <span className="text-sm font-semibold">{money(p.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Notes" && (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-xs text-muted">Internal only — never visible to the client.</p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Anything your team should know about this project..."
                className="min-h-[160px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <Button variant="cta" onClick={handleSaveNotes} disabled={savingNotes} className="w-fit">
                  {savingNotes ? "Saving..." : "Save notes"}
                </Button>
                {notesSaved && <span className="text-xs text-status-approved">Saved.</span>}
              </div>
            </div>
          )}

          {activeTab === "Details" && (
            <div className="mt-6 flex flex-col gap-4">
              <QuestionnaireSummary eventId={id} />

              <PackageRecommendation eventId={id} />

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <GlassCard className="flex flex-col gap-1">
                  <Row label="Event type" value={event.event_type ?? "—"} />
                  <Row label="Service" value={event.service_type ?? "—"} />
                  <Row label="Expected guests" value={event.expected_guests != null ? String(event.expected_guests) : "—"} />
                  <Row label="DJ" value={event.djs?.display_name ?? "Unassigned"} />
                  <Row label="Venue" value={event.venues?.name ?? "No venue"} />
                </GlassCard>

                <ContractsPanel eventId={id} contracts={contracts} onChange={load} />

                <EquipmentAssignmentsPanel eventId={id} />

                {(event.must_play?.length || event.do_not_play?.length) ? (
                  <GlassCard className="flex flex-col gap-3">
                    {event.must_play && event.must_play.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Must-play songs</p>
                        <p className="text-sm">{event.must_play.join(", ")}</p>
                      </div>
                    )}
                    {event.do_not_play && event.do_not_play.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Do-not-play songs</p>
                        <p className="text-sm">{event.do_not_play.join(", ")}</p>
                      </div>
                    )}
                  </GlassCard>
                ) : null}

                {event.wedding_music_plan && Object.keys(event.wedding_music_plan).length > 0 && (
                  <GlassCard className="flex flex-col gap-1">
                    <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Wedding music plan</p>
                    {WEDDING_PLAN_FIELDS.map(({ key, label }) => {
                      const value = event.wedding_music_plan?.[key];
                      if (!value || (Array.isArray(value) && value.length === 0)) return null;
                      return <Row key={key} label={label} value={Array.isArray(value) ? value.join(", ") : value} />;
                    })}
                  </GlassCard>
                )}

                {event.special_requests && (
                  <GlassCard className="flex flex-col gap-1">
                    <p className="text-xs uppercase tracking-[1.5px] text-muted">Client notes</p>
                    <p className="text-sm">{event.special_requests}</p>
                  </GlassCard>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-64 lg:shrink-0">
          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Client portal</p>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/portal`}
                className="flex-1 truncate rounded-[10px] border border-black/10 bg-panel px-2.5 py-2 text-xs text-muted"
              />
              <button onClick={copyPortalLink} className="shrink-0 rounded-[10px] border border-black/10 p-2 hover:border-gold">
                {copied ? <Check size={13} className="text-status-approved" /> : <Copy size={13} />}
              </button>
            </div>
            <p className="text-[11px] text-muted">Your client signs in here with the email on file.</p>
          </GlassCard>

          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Status</p>
            <select
              value={event.status}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={savingStage}
              className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">Whether a DJ has accepted this booking.</p>
          </GlassCard>

          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Pipeline Stage</p>
            <select
              value={event.pipeline_stage ?? "Inquiry"}
              onChange={(e) => handlePipelineStageChange(e.target.value)}
              disabled={savingPipelineStage}
              className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">Where this project sits in the sales &amp; planning funnel.</p>
          </GlassCard>

          {event.clients && (
            <>
              <GlassCard className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Lead Source</p>
                <input
                  value={leadSourceDraft}
                  onChange={(e) => setLeadSourceDraft(e.target.value)}
                  onBlur={handleSaveLeadSource}
                  placeholder="Instagram, referral, website..."
                  className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </GlassCard>

              <GlassCard className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(event.clients.tags ?? []).map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-[10px] bg-gold-soft px-2 py-1 text-[11px] text-gold-dim">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-status-declined">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {(event.clients.tags ?? []).length === 0 && <span className="text-xs text-muted">No tags yet.</span>}
                </div>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-xs focus:border-gold focus:outline-none"
                />
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
