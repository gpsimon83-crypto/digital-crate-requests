"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { TagPicker } from "@/components/dashboard/tag-picker";
import { SongSlotField } from "@/components/portal/song-slot-field";
import { PortalFilesList } from "@/components/portal/portal-files-list";
import { PortalHeroPhoto, PortalWelcomeRow } from "@/components/portal/portal-hero";
import { PortalTopHeader } from "@/components/portal/portal-top-header";
import { DjProfileCard } from "@/components/portal/dj-profile-card";
import { ConversationPanel } from "@/components/portal/conversation-panel";
import { NextStepsCard } from "@/components/portal/next-steps-card";
import { ChangeOrdersPanel, type ChangeOrderData } from "@/components/project/change-orders-panel";
import { ArrowLeft, X, FileText, FileSignature, DollarSign, Music2, ChevronRight, MessageCircle, ClipboardList, type LucideIcon } from "lucide-react";
import type { HeroSettings } from "@/lib/hero-settings";
import type { EventCategory } from "@/lib/event-category";

interface WeddingMusicPlan {
  processional_song?: string;
  wedding_party_entrance_song?: string;
  bride_entrance_song?: string;
  recessional_song?: string;
  bridal_party_order?: string;
  wedding_party?: { name: string; pronunciation?: string }[];
  mc_announcements?: string;
  grand_march_song?: string;
  first_dance_song?: string;
  father_daughter_song?: string;
  mother_son_song?: string;
  special_dances?: string[];
  special_dance_songs?: string;
  games?: string[];
  spotify_ids?: Record<string, string>;
}

interface TimelineEntry {
  time: string;
  label: string;
  note?: string;
}

interface VendorContact {
  role: string;
  name: string;
  phone?: string;
  email?: string;
}

interface EventDetail {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  event_type: string | null;
  event_category: EventCategory | null;
  service_type: string | null;
  expected_guests: number | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  special_requests: string | null;
  wedding_music_plan: WeddingMusicPlan | null;
  wedding_music_plan_sent_at: string | null;
  vendor_contacts: VendorContact[] | null;
  day_timeline: TimelineEntry[] | null;
  weather_backup_plan: string | null;
  vendor_meal_count: number | null;
  venue_load_in_notes: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_amount: number | null;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  couple_display_name: string | null;
  portal_hero_image_url: string | null;
  portal_hero_settings: Partial<HeroSettings> | null;
  portal_hero_headline_override: string | null;
  portal_hero_subheading_override: string | null;
  timezone: string | null;
  djs: { display_name: string; photo_url: string | null; bio: string | null; hero_settings: Partial<HeroSettings> | null } | null;
  venues: { name: string } | null;
}

interface Branding {
  imageUrl: string | null;
  heading: string | null;
  subheading: string | null;
}

const SPECIAL_DANCE_OPTIONS = ["Snowball Dance", "Anniversary Dance", "Surprise Guest First Dance", "None"] as const;
const GAME_OPTIONS = ["Shoe Game", "Table Dash Game"] as const;

const SPECIAL_DANCE_INFO: Record<string, string> = {
  "Snowball Dance":
    "An up-tempo song plays as the wedding party is called to the floor and starts dancing. When the music stops, the bridal party each bring back a guest partner — the fun continues until every able-bodied dancer is on the floor.",
  "Anniversary Dance":
    "Every married couple at the wedding takes the floor. The MC asks anyone married less than 12 hours to sit (that's you two), then 1 year, 5 years, 10 years, and so on until only the longest-married couple remains. The bride and groom usually give them a flower and sometimes dance together to one more song."
};

const GAME_INFO: Record<string, string> = {
  "Shoe Game":
    "A reception favorite that tests how well you know each other — you'll each answer questions (who's the better cook, who's funnier) without seeing the other's answer.",
  "Table Dash Game":
    "The wedding party visits every table for a photo within the length of two songs (three if it's a big guest list)."
};

interface Balance {
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
}

interface ContractInfo {
  id: string;
  status: "draft" | "sent" | "signed" | "void";
  title: string;
  body: string | null;
  file_url: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  esign_document_id: string | null;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "conversations", label: "Conversations" },
  { key: "contracts", label: "Contracts" },
  { key: "forms", label: "Forms" },
  { key: "documents", label: "Documents" },
  { key: "music", label: "Music" },
  { key: "payments", label: "Payments" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PortalEventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">Loading...</div>}>
      <PortalEventPageInner params={params} />
    </Suspense>
  );
}

function PortalEventPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  const [lastMessage, setLastMessage] = useState<{ body: string; created_at: string; direction: "inbound" | "outbound"; from_name: string | null } | null>(null);
  const [documentCount, setDocumentCount] = useState(0);

  const [mustPlay, setMustPlay] = useState<string[]>([]);
  const [doNotPlay, setDoNotPlay] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [newMustPlay, setNewMustPlay] = useState("");
  const [newDoNotPlay, setNewDoNotPlay] = useState("");
  const [weddingPlan, setWeddingPlan] = useState<WeddingMusicPlan>({});
  const [vendorContacts, setVendorContacts] = useState<VendorContact[]>([]);
  const [weatherBackupPlan, setWeatherBackupPlan] = useState("");
  const [vendorMealCount, setVendorMealCount] = useState("");
  const [venueLoadInNotes, setVenueLoadInNotes] = useState("");
  const [savingVendors, setSavingVendors] = useState(false);
  const [vendorsSaved, setVendorsSaved] = useState(false);
  const [dayTimeline, setDayTimeline] = useState<TimelineEntry[]>([]);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [timelineSaved, setTimelineSaved] = useState(false);

  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderData[]>([]);
  const [signName, setSignName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/portal/events/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load event");
      setEvent(data.event);
      setBalance(data.balance);
      setContract(data.contract ?? null);
      setChangeOrders(data.changeOrders ?? []);
      setMustPlay(data.event.must_play ?? []);
      setDoNotPlay(data.event.do_not_play ?? []);
      setSpecialRequests(data.event.special_requests ?? "");
      setWeddingPlan(data.event.wedding_music_plan ?? {});
      setVendorContacts(data.event.vendor_contacts ?? []);
      setWeatherBackupPlan(data.event.weather_backup_plan ?? "");
      setVendorMealCount(data.event.vendor_meal_count != null ? String(data.event.vendor_meal_count) : "");
      setVenueLoadInNotes(data.event.venue_load_in_notes ?? "");
      setDayTimeline(data.event.day_timeline ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches for this event, doesn't set state synchronously from a prop
    load();
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((data) => setFirstName(data.client?.first_name ?? null))
      .catch(() => {});
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => setBranding(data.portalHero ?? null))
      .catch(() => {});
    fetch(`/api/portal/events/${id}/questionnaire`)
      .then((r) => r.json())
      .then((data) => setQuestionnaireCompleted(!!data.response?.completed_at))
      .catch(() => {});
    fetch(`/api/portal/events/${id}/messages`)
      .then((r) => r.json())
      .then((data) => setLastMessage(data.messages?.[data.messages.length - 1] ?? null))
      .catch(() => {});
    fetch(`/api/portal/events/${id}/files`)
      .then((r) => r.json())
      .then((data) => setDocumentCount(data.files?.length ?? 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mustPlay, doNotPlay, specialRequests })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMusicPlan() {
    setSavingPlan(true);
    setPlanSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingMusicPlan: weddingPlan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setPlanSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSaveVendors() {
    setSavingVendors(true);
    setVendorsSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorContacts,
          weatherBackupPlan: weatherBackupPlan || null,
          vendorMealCount: vendorMealCount ? Number(vendorMealCount) : null,
          venueLoadInNotes: venueLoadInNotes || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setVendorsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingVendors(false);
    }
  }

  async function handleSign() {
    if (signName.trim().length < 2) {
      setSignError("Enter your full legal name.");
      return;
    }
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: signName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign");
      await load();
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSigning(false);
    }
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-gold">← Back to your events</Link>
      </div>
    );
  }

  if (!event) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">Loading...</div>;
  }

  function updatePlan<K extends keyof WeddingMusicPlan>(key: K, value: WeddingMusicPlan[K]) {
    setWeddingPlan((prev) => ({ ...prev, [key]: value }));
  }

  function updateSong(key: string, text: string, spotifyId?: string) {
    setWeddingPlan((prev) => {
      const ids = { ...(prev.spotify_ids ?? {}) };
      if (spotifyId) ids[key] = spotifyId;
      else delete ids[key];
      return { ...prev, [key]: text, spotify_ids: ids };
    });
  }

  function goTo(tab: TabKey) {
    router.push(`/portal/events/${id}?tab=${tab}`);
  }

  const isWedding = event.event_category === "wedding";
  const heroImage = event.portal_hero_image_url ?? branding?.imageUrl ?? null;
  const heroSettings = event.portal_hero_image_url ? event.portal_hero_settings : null;
  const headline = event.portal_hero_headline_override ?? branding?.heading ?? null;
  const displayName = event.couple_display_name ?? event.title;

  return (
    <>
      <PortalTopHeader eventId={id} firstName={firstName} />

      <PortalHeroPhoto
        imageUrl={heroImage}
        heroSettings={heroSettings}
        headline={headline}
        displayName={displayName}
        eventDateLabel={event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null}
        venueName={event.venues?.name ?? null}
        tagline="Great music brings people closer."
      />

      <div className="px-[4%] py-8">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <ArrowLeft size={14} /> Your events
          </Link>
          <Link href={`/portal/events/${id}/package`} className="shrink-0 text-sm font-medium text-gold hover:underline">
            Build Your Package →
          </Link>
        </div>

        <PortalWelcomeRow firstName={firstName} startsAt={event.starts_at} timezone={event.timezone} />

        <div className="mt-6 overflow-x-auto">
          <Tabs items={TABS} active={activeTab} hrefFor={(key) => `/portal/events/${id}?tab=${key}`} className="min-w-max" />
        </div>

        {activeTab === "overview" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <ChangeOrdersPanel
                changeOrders={changeOrders}
                role="client"
                onAcknowledge={async (changeOrderId, fullName) => {
                  const res = await fetch(`/api/portal/events/${id}/change-orders/${changeOrderId}/acknowledge`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullName })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to acknowledge");
                  setChangeOrders((prev) => prev.map((c) => (c.id === changeOrderId ? data.changeOrder : c)));
                }}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  icon={FileSignature}
                  label="Contract"
                  value={event.contract_status === "signed" ? "Signed" : event.contract_status === "sent" ? "Awaiting signature" : "Not sent yet"}
                  onClick={() => goTo("contracts")}
                />
                <SummaryCard icon={DollarSign} label="Balance due" value={balance ? `$${(balance.balanceCents / 100).toFixed(2)}` : "—"} onClick={() => goTo("payments")} />
                <SummaryCard
                  icon={Music2}
                  label="Music plan"
                  value={event.wedding_music_plan_sent_at ? (weddingPlan.first_dance_song ? "In progress" : "Not started") : "Not sent yet"}
                  onClick={() => goTo("music")}
                />
              </div>

              <NextStepsCard
                questionnaireCompleted={questionnaireCompleted}
                firstDanceSongSet={!!weddingPlan.first_dance_song}
                isWedding={isWedding}
                onOpenForms={() => goTo("forms")}
                onOpenMusic={() => goTo("music")}
              />

              <GlassCard className="flex flex-col gap-1">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-semibold">Recent conversations</p>
                  <button onClick={() => goTo("conversations")} className="text-xs font-medium text-gold hover:underline">
                    View all
                  </button>
                </div>
                {lastMessage ? (
                  <button onClick={() => goTo("conversations")} className="flex items-center gap-3 rounded-[10px] px-1 py-2 text-left hover:bg-panel">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-semibold text-muted">
                      {(lastMessage.direction === "inbound" ? "You" : (lastMessage.from_name ?? "DJ")).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{lastMessage.body}</span>
                      <span className="text-xs text-muted">{new Date(lastMessage.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-muted" />
                  </button>
                ) : (
                  <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted">
                    <MessageCircle size={14} /> No messages yet — say hello from the Conversations tab.
                  </p>
                )}
              </GlassCard>

              <GlassCard className="flex flex-col gap-1">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-semibold">Forms &amp; documents</p>
                  <button onClick={() => goTo("documents")} className="text-xs font-medium text-gold hover:underline">
                    View all
                  </button>
                </div>
                <button onClick={() => goTo("forms")} className="flex items-center gap-3 rounded-[10px] px-1 py-2 text-left hover:bg-panel">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
                    <ClipboardList size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Wedding questionnaire</span>
                    <span className="text-xs text-muted">{questionnaireCompleted ? "Completed" : "Not started"}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${questionnaireCompleted ? "bg-status-approved/15 text-status-approved" : "bg-panel text-muted"}`}>
                    {questionnaireCompleted ? "Done" : "Not started"}
                  </span>
                </button>
                <button onClick={() => goTo("documents")} className="flex items-center gap-3 rounded-[10px] px-1 py-2 text-left hover:bg-panel">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
                    <FileText size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Shared documents</span>
                    <span className="text-xs text-muted">{documentCount} file{documentCount === 1 ? "" : "s"}</span>
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-muted" />
                </button>
              </GlassCard>
            </div>

            <DjProfileCard
              name={event.djs?.display_name ?? null}
              photoUrl={event.djs?.photo_url ?? null}
              heroSettings={event.djs?.hero_settings ?? null}
              bio={event.djs?.bio ?? null}
              onStartConversation={() => goTo("conversations")}
            />
          </div>
        )}

      {activeTab === "conversations" && (
        <div className="mt-6">
          <ConversationPanel eventId={id} />
        </div>
      )}

      {activeTab === "contracts" && (
        <div className="mt-6">
          {contract ? (
            <GlassCard neon className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{contract.title}</p>

              {contract.file_url && (
                <a href={contract.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-gold hover:underline">
                  <FileText size={14} /> View contract document
                </a>
              )}
              {contract.body && <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-black/10 bg-panel/60 p-3 text-sm">{contract.body}</div>}

              {contract.status === "signed" ? (
                <p className="text-sm text-status-approved">
                  Signed {contract.esign_document_id ? "via SignWell" : `by ${contract.signed_by_name}`} on{" "}
                  {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : "—"}
                </p>
              ) : contract.esign_document_id ? (
                <p className="text-sm text-muted">
                  We sent a secure link to sign this contract to your email. Check your inbox (and spam folder) — once you sign there, it&rsquo;ll show as signed here automatically.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted">Typing your full legal name below and clicking Sign counts as your electronic signature on this contract.</p>
                  <input
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="Your full legal name"
                    className="rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  />
                  {signError && <p className="text-xs text-status-declined">{signError}</p>}
                  <Button variant="cta" onClick={handleSign} disabled={signing} className="w-fit">
                    {signing ? "Signing..." : "Sign Contract"}
                  </Button>
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col gap-1">
              <p className="text-sm font-semibold">No contract yet</p>
              <p className="text-sm text-muted">Your contract will show up here once it&rsquo;s sent.</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "forms" && (
        <div className="mt-6 flex flex-col gap-4">
          <GlassCard neon className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Planning Questionnaire</p>
            <p className="text-sm text-muted">A quick, guided walkthrough to tell us everything about your event — songs, timeline, and all the details your DJ needs.</p>
            <Link href={`/portal/questionnaire/${id}`} className="w-fit">
              <Button variant="cta">{questionnaireCompleted ? "Review Questionnaire →" : "Open Questionnaire →"}</Button>
            </Link>
          </GlassCard>

          {(event.event_type || event.service_type || event.expected_guests) && (
            <GlassCard className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Your booking</p>
              {event.event_type && <Row label="Event type" value={event.event_type} />}
              {event.service_type && <Row label="Service" value={event.service_type} />}
              {event.expected_guests != null && <Row label="Expected guests" value={String(event.expected_guests)} />}
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="mt-6">
          <PortalFilesList eventId={id} />
        </div>
      )}

      {activeTab === "music" && (
        <div className="mt-6 flex flex-col gap-6">
          {isWedding ? (
            !event.wedding_music_plan_sent_at ? (
              <GlassCard className="flex flex-col gap-1">
                <p className="text-sm font-semibold">Wedding Music Plan</p>
                <p className="text-sm text-muted">Your DJ sends this planning form once your deposit is in — check back after your first payment.</p>
              </GlassCard>
            ) : (
              <>
                <div>
                  <p className="font-display text-2xl font-light">Wedding Music Plan</p>
                  <p className="mt-1 text-sm text-muted">Type each song yourself, or search Spotify to fill it in for you. Changes save separately from the rest of this page.</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">Ceremony</p>
                    <div className="flex flex-col gap-3">
                      <SongSlotField label="Processional Song" value={weddingPlan.processional_song ?? ""} onChange={(v, sid) => updateSong("processional_song", v, sid)} />
                      <SongSlotField label="Wedding Party Entrance Song" value={weddingPlan.wedding_party_entrance_song ?? ""} onChange={(v, sid) => updateSong("wedding_party_entrance_song", v, sid)} required />
                      <SongSlotField label="Bride Entrance Song" value={weddingPlan.bride_entrance_song ?? ""} onChange={(v, sid) => updateSong("bride_entrance_song", v, sid)} required />
                      <SongSlotField label="Recessional Song" value={weddingPlan.recessional_song ?? ""} onChange={(v, sid) => updateSong("recessional_song", v, sid)} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">Reception</p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Wedding Party Order of Entry (bride &amp; groom last)</span>
                        <div className="flex flex-col gap-2">
                          {(weddingPlan.wedding_party ?? []).map((person, i) => (
                            <div key={i} className="flex gap-2">
                              <input
                                value={person.name}
                                onChange={(e) => {
                                  const next = [...(weddingPlan.wedding_party ?? [])];
                                  next[i] = { ...next[i], name: e.target.value };
                                  updatePlan("wedding_party", next);
                                }}
                                placeholder="Name"
                                className="flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                              />
                              <input
                                value={person.pronunciation ?? ""}
                                onChange={(e) => {
                                  const next = [...(weddingPlan.wedding_party ?? [])];
                                  next[i] = { ...next[i], pronunciation: e.target.value };
                                  updatePlan("wedding_party", next);
                                }}
                                placeholder="Pronunciation (optional)"
                                className="flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updatePlan("wedding_party", (weddingPlan.wedding_party ?? []).filter((_, idx) => idx !== i))}
                                className="shrink-0 rounded-[10px] border border-black/10 px-2.5 text-xs text-muted hover:text-status-declined"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <Button variant="secondary" size="sm" className="w-fit" onClick={() => updatePlan("wedding_party", [...(weddingPlan.wedding_party ?? []), { name: "" }])}>
                            + Add person
                          </Button>
                        </div>
                      </div>
                      <label className="block">
                        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Additional entry notes</span>
                        <textarea
                          value={weddingPlan.bridal_party_order ?? ""}
                          onChange={(e) => updatePlan("bridal_party_order", e.target.value)}
                          placeholder="e.g. groomsmen enter from the left, bridesmaids from the right..."
                          className="min-h-[50px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">MC announcements &amp; name pronunciations</span>
                        <textarea
                          value={weddingPlan.mc_announcements ?? ""}
                          onChange={(e) => updatePlan("mc_announcements", e.target.value)}
                          placeholder="Anything specific you want announced, and how to say tricky names..."
                          className="min-h-[70px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                        />
                      </label>
                      <SongSlotField label="Grand March Song" value={weddingPlan.grand_march_song ?? ""} onChange={(v, sid) => updateSong("grand_march_song", v, sid)} required />
                      <SongSlotField label="First Dance" value={weddingPlan.first_dance_song ?? ""} onChange={(v, sid) => updateSong("first_dance_song", v, sid)} required />
                      <SongSlotField label="Father/Daughter Dance" value={weddingPlan.father_daughter_song ?? ""} onChange={(v, sid) => updateSong("father_daughter_song", v, sid)} />
                      <SongSlotField label="Mother/Son Dance" value={weddingPlan.mother_son_song ?? ""} onChange={(v, sid) => updateSong("mother_son_song", v, sid)} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                      Special Dances <span className="text-muted normal-case">(at most 2 recommended)</span>
                    </p>
                    <TagPicker options={SPECIAL_DANCE_OPTIONS} selected={weddingPlan.special_dances ?? []} onChange={(v) => updatePlan("special_dances", v)} />
                    <div className="mt-2 flex flex-col gap-1.5">
                      {(weddingPlan.special_dances ?? [])
                        .filter((d) => SPECIAL_DANCE_INFO[d])
                        .map((d) => (
                          <p key={d} className="text-xs text-muted">
                            <span className="font-medium text-foreground">{d}:</span> {SPECIAL_DANCE_INFO[d]}
                          </p>
                        ))}
                    </div>
                    {(weddingPlan.special_dances ?? []).some((d) => d !== "None") && (
                      <textarea
                        value={weddingPlan.special_dance_songs ?? ""}
                        onChange={(e) => updatePlan("special_dance_songs", e.target.value)}
                        placeholder="A song for each special dance picked above..."
                        className="mt-2 min-h-[60px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">Reception Games</p>
                    <TagPicker options={GAME_OPTIONS} selected={weddingPlan.games ?? []} onChange={(v) => updatePlan("games", v)} />
                    <div className="mt-2 flex flex-col gap-1.5">
                      {(weddingPlan.games ?? [])
                        .filter((g) => GAME_INFO[g])
                        .map((g) => (
                          <p key={g} className="text-xs text-muted">
                            <span className="font-medium text-foreground">{g}:</span> {GAME_INFO[g]}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="mb-1 text-sm font-semibold">Day-Of Timeline</p>
                  <p className="mb-3 text-xs text-muted">Your actual schedule with real clock times — the one sheet your DJ prints for the day. You know it better than we do.</p>
                  <div className="flex flex-col gap-2">
                    {dayTimeline.map((entry, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
                        <input
                          value={entry.time}
                          onChange={(e) => setDayTimeline(dayTimeline.map((x, idx) => (idx === i ? { ...x, time: e.target.value } : x)))}
                          placeholder="5:00 PM"
                          className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                        />
                        <input
                          value={entry.label}
                          onChange={(e) => setDayTimeline(dayTimeline.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                          placeholder="Ceremony begins"
                          className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                        />
                        <input
                          value={entry.note ?? ""}
                          onChange={(e) => setDayTimeline(dayTimeline.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)))}
                          placeholder="Note (optional)"
                          className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setDayTimeline(dayTimeline.filter((_, idx) => idx !== i))}
                          className="shrink-0 rounded-[10px] border border-black/10 px-2.5 text-xs text-muted hover:text-status-declined"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" className="w-fit" onClick={() => setDayTimeline([...dayTimeline, { time: "", label: "" }])}>
                      + Add moment
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={async () => {
                      setSavingTimeline(true);
                      setTimelineSaved(false);
                      setError(null);
                      try {
                        const res = await fetch(`/api/portal/events/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ dayTimeline })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to save");
                        setTimelineSaved(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Something went wrong.");
                      } finally {
                        setSavingTimeline(false);
                      }
                    }} disabled={savingTimeline} className="w-fit">
                      {savingTimeline ? "Saving..." : "Save timeline"}
                    </Button>
                    {timelineSaved && <span className="text-xs text-status-approved">Saved</span>}
                  </div>
                </div>

                {error && <p className="text-sm text-status-declined">{error}</p>}
                {planSaved && <p className="text-sm text-status-approved">Saved.</p>}

                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <Button variant="cta" onClick={handleSaveMusicPlan} disabled={savingPlan} className="w-fit">
                    {savingPlan ? "Saving..." : "Save Music Plan"}
                  </Button>
                </div>
              </>
            )
          ) : (
            <GlassCard className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Music preferences</p>
              <p className="text-sm text-muted">Build your night below — tell your DJ exactly what to play and what to skip.</p>
            </GlassCard>
          )}

          <GlassCard neon className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Must-Play List</p>
            <SongList items={mustPlay} onRemove={(i) => setMustPlay(mustPlay.filter((_, idx) => idx !== i))} />
            <div className="flex gap-2">
              <input
                value={newMustPlay}
                onChange={(e) => setNewMustPlay(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMustPlay.trim()) {
                    e.preventDefault();
                    setMustPlay([...mustPlay, newMustPlay.trim()]);
                    setNewMustPlay("");
                  }
                }}
                placeholder="Song title — Artist"
                className="flex-1 rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newMustPlay.trim()) {
                    setMustPlay([...mustPlay, newMustPlay.trim()]);
                    setNewMustPlay("");
                  }
                }}
                className="rounded-[10px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
              >
                Add
              </button>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Do-Not-Play List</p>
            <SongList items={doNotPlay} onRemove={(i) => setDoNotPlay(doNotPlay.filter((_, idx) => idx !== i))} />
            <div className="flex gap-2">
              <input
                value={newDoNotPlay}
                onChange={(e) => setNewDoNotPlay(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDoNotPlay.trim()) {
                    e.preventDefault();
                    setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                    setNewDoNotPlay("");
                  }
                }}
                placeholder="Song title — Artist"
                className="flex-1 rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newDoNotPlay.trim()) {
                    setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                    setNewDoNotPlay("");
                  }
                }}
                className="rounded-[10px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
              >
                Add
              </button>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Notes for your DJ</p>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Timeline details, anything else your DJ should know..."
              className="min-h-[100px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </GlassCard>

          <GlassCard className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold">Vendor Contacts &amp; Day-of Logistics</p>
              <p className="text-xs text-muted">Photographer, planner, venue coordinator, and anything else your DJ needs to know before showing up.</p>
            </div>
            <div className="flex flex-col gap-2">
              {vendorContacts.map((v, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <input
                    value={v.role}
                    onChange={(e) => setVendorContacts(vendorContacts.map((x, idx) => (idx === i ? { ...x, role: e.target.value } : x)))}
                    placeholder="Role (e.g. Photographer)"
                    className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <input
                    value={v.name}
                    onChange={(e) => setVendorContacts(vendorContacts.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Name"
                    className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <input
                    value={v.phone ?? ""}
                    onChange={(e) => setVendorContacts(vendorContacts.map((x, idx) => (idx === i ? { ...x, phone: e.target.value } : x)))}
                    placeholder="Phone"
                    className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <input
                    value={v.email ?? ""}
                    onChange={(e) => setVendorContacts(vendorContacts.map((x, idx) => (idx === i ? { ...x, email: e.target.value } : x)))}
                    placeholder="Email"
                    className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setVendorContacts(vendorContacts.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-[10px] border border-black/10 px-2.5 text-xs text-muted hover:text-status-declined"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="sm" className="w-fit" onClick={() => setVendorContacts([...vendorContacts, { role: "", name: "" }])}>
                + Add vendor
              </Button>
            </div>

            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Vendor meal count</span>
                <input
                  type="number"
                  value={vendorMealCount}
                  onChange={(e) => setVendorMealCount(e.target.value)}
                  placeholder="How many vendor meals to plan for"
                  className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Venue load-in / parking notes</span>
                <input
                  value={venueLoadInNotes}
                  onChange={(e) => setVenueLoadInNotes(e.target.value)}
                  placeholder="Loading dock, parking instructions, load-in time..."
                  className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Weather backup plan (outdoor ceremony/reception)</span>
              <textarea
                value={weatherBackupPlan}
                onChange={(e) => setWeatherBackupPlan(e.target.value)}
                placeholder="What happens if it rains — alternate location, tent, timing change..."
                className="min-h-[60px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleSaveVendors} disabled={savingVendors} className="w-fit">
                {savingVendors ? "Saving..." : "Save vendors"}
              </Button>
              {vendorsSaved && <span className="text-xs text-status-approved">Saved</span>}
            </div>
          </GlassCard>

          {error && <p className="text-sm text-status-declined">{error}</p>}
          {saved && <p className="text-sm text-status-approved">Saved.</p>}

          <Button variant="cta" onClick={handleSave} disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="mt-6">
          {balance && balance.totalDueCents > 0 ? (
            <GlassCard neon className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Payment</p>
              <div className="flex flex-col gap-1 text-sm">
                <Row label="Total" value={`$${(balance.totalDueCents / 100).toFixed(2)}`} />
                <Row label="Paid so far" value={`$${(balance.paidCents / 100).toFixed(2)}`} />
                <Row label="Balance due" value={`$${(balance.balanceCents / 100).toFixed(2)}`} bold />
              </div>
              {balance.balanceCents > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.deposit_amount && balance.paidCents === 0 && (
                    <Link href={`/portal/events/${id}/pay?kind=deposit&amount=${Math.min(Math.round(event.deposit_amount * 100), balance.balanceCents)}`}>
                      <Button variant="cta">Pay Deposit (${event.deposit_amount.toFixed(2)})</Button>
                    </Link>
                  )}
                  <Link href={`/portal/events/${id}/pay?kind=balance&amount=${balance.balanceCents}`}>
                    <Button variant="cta">Pay Full Balance (${(balance.balanceCents / 100).toFixed(2)})</Button>
                  </Link>
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Nothing due</p>
              <p className="text-sm text-muted">You&rsquo;re all paid up, or a total hasn&rsquo;t been set yet.</p>
            </GlassCard>
          )}
        </div>
      )}
      </div>
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, onClick }: { icon: LucideIcon; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <GlassCard className="flex items-center gap-3 transition-colors hover:border-gold/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>
          <span className="block truncate text-sm font-semibold">{value}</span>
        </span>
        <ChevronRight size={15} className="shrink-0 text-muted" />
      </GlassCard>
    </button>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function SongList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">Nothing added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-1.5 rounded-[10px] border border-black/10 bg-panel px-3 py-1.5 text-xs">
          {item}
          <button onClick={() => onRemove(i)} className="text-muted hover:text-status-declined">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
