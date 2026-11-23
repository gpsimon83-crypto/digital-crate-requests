"use client";

import { Suspense, useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/lib/pipeline-stage";
import { EVENT_TYPES } from "@/lib/event-types";
import { priceLabel } from "@/lib/data/catalog";
import { DjOfferPanel } from "@/components/project/dj-offer-panel";
import { PackageRecommendation } from "@/components/project/package-recommendation";
import { ContactEditDrawer, type EditableContact } from "@/components/admin/contact-edit-drawer";
import { BookingPanel } from "@/components/project/booking-panel";
import { EquipmentPlanCard } from "@/components/project/equipment-plan-card";
import { ProjectDayCards } from "@/components/project/project-day-cards";
import { ThemeMenu } from "@/components/project/theme-menu";
import { stageGuide } from "@/lib/pipeline-guide";
import { PROJECT_THEMES, defaultProjectTheme, isProjectTheme, type ProjectThemeId } from "@/lib/project-themes";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";

// The stepper shows the forward-moving path only — Declined/Archived are
// exceptions handled via the Pipeline Stage dropdown in the sidebar, not
// steps a project "arrives at" in sequence.
const FORWARD_PIPELINE_STAGES = PIPELINE_STAGES.filter((s) => s !== "Declined" && s !== "Archived");
import { type MergeContext } from "@/lib/merge-fields";
import { clientName } from "@/lib/format";
import { EmailThreadPanel } from "@/components/project/email-thread-panel";
import { PlaybookPanel } from "@/components/project/playbook-panel";
import { PaymentLedger, type LedgerPayment } from "@/components/project/payment-ledger";
import { CLASSIC_TABS, MakeRecurringCard, RESIDENCY_TABS, ResidencyBody, ResidencyTop, type Drawer } from "@/components/residency/residency-view";
import type { ResidencyData } from "@/components/residency/types";
import { FilesPanel } from "@/components/project/files-panel";
import { ContractsPanel, type ContractRow } from "@/components/project/contracts-panel";
import { type ChangeOrderData } from "@/components/project/change-orders-panel";
import { QuestionnaireSummary } from "@/components/project/questionnaire-summary";
import { PackageTemplatePicker } from "@/components/project/package-template-picker";
import { PackageSelectionPanel } from "@/components/project/package-selection-panel";
import { PortalHeroPanel } from "@/components/project/portal-hero-panel";
import { MeetingsPanel } from "@/components/project/meetings-panel";
import { EventFlyerPanel } from "@/components/flyers/event-flyer-panel";
import { WeddingBasicsPanel } from "@/components/project/wedding-basics-panel";
import { choiceLabels } from "@/lib/wedding-labels";
import type { EventCategory } from "@/lib/event-category";
import type { HeroSettings } from "@/lib/hero-settings";
import type { PortalHeroExtras } from "@/components/project/portal-hero-panel";
import {
  ArrowLeft,
  Copy,
  Check,
  FileText,
  X,
  CalendarDays,
  ChevronRight,
  Clock,
  ImagePlus,
  MapPin,
  Camera,
  Music2,
  ExternalLink,
  Trash2
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
  // From Wedding Basics (migration 0056).
  partner_first_name?: string | null;
  partner_last_name?: string | null;
  partner_phone?: string | null;
  married_last_name?: string | null;
  contact_methods?: string[] | null;
  best_days?: string[] | null;
  best_times?: string[] | null;
}

type PaymentRow = LedgerPayment;

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
  event_category: EventCategory | null;
  service_type: string | null;
  expected_guests: number | null;
  venue_name: string | null;
  budget_range: string | null;
  /** The Services package the client asked about, as shown then (migration 0066). */
  package_snapshot?: { name: string; category: string | null; pricing_type: "fixed" | "starting_at" | "quote"; price: number | null; hours: number | null; captured_at: string } | null;
  special_requests: string | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  wedding_music_plan:
    | (Record<string, string | string[] | undefined> & {
        spotify_ids?: Record<string, string>;
        wedding_party?: { name: string; pronunciation?: string }[];
      })
    | null;
  wedding_music_plan_sent_at: string | null;
  vendor_contacts: { role: string; name: string; phone?: string; email?: string }[] | null;
  day_timeline: { time: string; label: string; note?: string }[] | null;
  weather_backup_plan: string | null;
  vendor_meal_count: number | null;
  venue_load_in_notes: string | null;
  quoted_amount: number | null;
  package_selection_id?: string | null;
  final_amount: number | null;
  deposit_amount: number | null;
  internal_notes: string | null;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  couple_display_name: string | null;
  portal_hero_image_url: string | null;
  portal_hero_settings: (Partial<HeroSettings> & PortalHeroExtras) | null;
  portal_hero_headline_override: string | null;
  portal_hero_subheading_override: string | null;
  timezone: string | null;
  dj_id: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  venue_id?: string | null;
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
  { key: "games", label: "Reception games" },
  { key: "mc_announcements", label: "MC announcements & pronunciations" }
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

/** An ISO instant as the value a datetime-local input expects, in the viewer's time. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
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
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  // Recurring Bar / Club booking: undefined while loading, null when this project isn't one.
  const [residency, setResidency] = useState<ResidencyData | null | undefined>(undefined);
  const [resDrawer, setResDrawer] = useState<Drawer>(null);
  const tabParam = searchParams.get("tab");
  const activeTab = (tabParam ?? (residency ? "Coverage" : "Activity")) as Tab;
  const resTab = !!residency && ((RESIDENCY_TABS as readonly string[]).includes(activeTab) || !(CLASSIC_TABS as readonly string[]).includes(activeTab));
  // Page look: picked in the Theme menu (remembered per project in this browser), else the event type's default.
  const [themePick, setThemePick] = useState<ProjectThemeId | null>(null);
  const themeKey = `dcdj-project-theme:${id}`;
  useEffect(() => {
    try {
      const v = localStorage.getItem(themeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after mount
      if (isProjectTheme(v)) setThemePick(v);
    } catch {
      // storage blocked: use the default look
    }
  }, [themeKey]);
  // The look covers the whole admin shell while this project is open (sidebar, tab bar, pop-ups), then goes back.
  const themeCategory = event ? event.event_category ?? "" : null;
  useEffect(() => {
    if (themeCategory === null) return;
    const t = themePick ?? defaultProjectTheme(themeCategory);
    const body = document.body;
    body.dataset.projectTheme = t;
    if (PROJECT_THEMES.find((x) => x.id === t)?.dark) body.dataset.projectThemeDark = "";
    else delete body.dataset.projectThemeDark;
    return () => {
      delete body.dataset.projectTheme;
      delete body.dataset.projectThemeDark;
    };
  }, [themeCategory, themePick]);
  function pickTheme(t: ProjectThemeId) {
    setThemePick(t);
    try {
      localStorage.setItem(themeKey, t);
    } catch {
      // storage blocked: the pick lasts until the page reloads
    }
  }
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [venueOptions, setVenueOptions] = useState<ClientOption[]>([]);
  const [djOptions, setDjOptions] = useState<ClientOption[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderData[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<{ title?: string; eventType?: string; expectedGuests?: string; startsAt: string; endsAt: string; venueId: string; finalAmount: string; djId: string }>({
    startsAt: "",
    endsAt: "",
    venueId: "",
    finalAmount: "",
    djId: ""
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [changingContact, setChangingContact] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
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

  async function refreshPayments() {
    const r = await fetch(`/api/admin/events/${id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setPayments(j.payments ?? []);
    setBalance(j.balance);
    setEvent(j.event);
  }

  const isBar = event?.event_category === "bar_nightclub";
  async function loadResidency() {
    try {
      const r = await fetch(`/api/admin/events/${id}/residency`, { cache: "no-store" });
      const j = await r.json();
      setResidency(r.ok && j.residency ? (j as ResidencyData) : null);
    } catch {
      setResidency(null);
    }
  }
  useEffect(() => {
    if (!event) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only Bar / Club projects can be recurring
    if (!isBar) setResidency(null);
    else void loadResidency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, isBar]);
  // Open a gig from a link (?gig=<id>), e.g. from a notification.
  const gigParam = searchParams.get("gig");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the link once the gigs are in
    if (gigParam && residency) setResDrawer({ kind: "gig", id: gigParam });
  }, [gigParam, residency?.residency.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [eventRes, clientsRes, contractsRes, venuesRes, djsRes] = await Promise.all([
        fetch(`/api/admin/events/${id}`),
        fetch("/api/admin/clients"),
        fetch(`/api/events/${id}/contracts`),
        fetch("/api/admin/venues"),
        fetch("/api/admin/djs")
      ]);
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.error || "Failed to load project");
      setEvent(eventData.event);
      setPayments(eventData.payments ?? []);
      setBalance(eventData.balance);
      setChangeOrders(eventData.changeOrders ?? []);

      const contractsData = await contractsRes.json();
      setContracts(contractsRes.ok ? contractsData.contracts ?? [] : []);

      const venuesData = await venuesRes.json();
      if (venuesRes.ok) setVenueOptions((venuesData.venues ?? []).map((v: { id: string; name: string }) => ({ id: v.id, label: v.name })));

      const djsData = await djsRes.json();
      if (djsRes.ok) setDjOptions((djsData.djs ?? []).map((d: { id: string; display_name: string }) => ({ id: d.id, label: d.display_name })));
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

  async function handleDeleteProject() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete project");
      router.push("/admin/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
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

  // Bar / Club: wait to know whether it's a recurring booking so the page doesn't swap layouts.
  if (event.event_category === "bar_nightclub" && residency === undefined) {
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

  const defaultTheme = defaultProjectTheme(event.event_category);
  const theme = themePick ?? defaultTheme;
  const themeDark = PROJECT_THEMES.find((t) => t.id === theme)?.dark ?? false;
  const isWedding = event.event_category === "wedding";
  const stage = event.pipeline_stage ?? "Inquiry";
  const tz = event.timezone || undefined;
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const venueLabel = event.venues?.name ?? event.venue_name ?? null;
  const latestSigned = contracts.filter((c) => c.signed_at).map((c) => c.signed_at as string).sort().pop() ?? null;
  const retainerPaid = payments.filter((p) => p.status === "succeeded" && p.kind === "deposit").map((p) => p.paid_at ?? p.created_at).sort().pop() ?? null;
  const guide = stageGuide(stage, { createdAt: event.created_at, signedAt: latestSigned, retainerPaidAt: retainerPaid, startsAt: event.starts_at, isWedding });
  const stats = [
    { label: "Event type", value: (event.event_category && EVENT_CATEGORY_LABELS[event.event_category]) || event.event_type || "—" },
    { label: "Guests", value: event.expected_guests != null ? String(event.expected_guests) : "—" },
    { label: "Service", value: event.service_type || "—" }
  ];
  const gala = theme === "gala";
  const washPhoto = (residency ? residency.venue?.cover_url : null) ?? event.hero_image_url;
  // Final amount: staff-entered final, else the total agreed in an approved proposal or a signed contract.
  const signedContract = contracts.some((c) => c.status === "signed");
  const agreed: { amount: number; source: string } | null =
    event.final_amount != null
      ? { amount: event.final_amount, source: "final amount" }
      : event.quoted_amount != null && (event.package_selection_id || signedContract)
        ? { amount: event.quoted_amount, source: signedContract ? "signed contract" : "accepted proposal" }
        : null;
  const detailFacts: { label: string; value: string; muted?: boolean }[] = [
    { label: "Event type", value: (event.event_category && EVENT_CATEGORY_LABELS[event.event_category]) || event.event_type || "—" },
    { label: "Event date", value: event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { timeZone: event.timezone || undefined, month: "short", day: "numeric", year: "numeric" }) : "Not set", muted: !event.starts_at },
    { label: "Expected guests", value: event.expected_guests != null ? String(event.expected_guests) : "Not set", muted: event.expected_guests == null },
    { label: "Service", value: event.service_type || "—" },
    { label: "Venue", value: event.venues?.name ?? (event.venue_name ? `${event.venue_name} (not linked)` : "No venue"), muted: !event.venues?.name && !event.venue_name },
    { label: "DJ", value: event.djs?.display_name ?? "Unassigned", muted: !event.djs?.display_name }
  ];

  return (
    <div data-project-theme={theme} data-project-theme-dark={themeDark ? "" : undefined} className="relative isolate min-h-dvh pb-16">
      {/* Muted wash of the banner photo behind the page; it shows in the gaps between sections. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1200px] overflow-hidden">
        {washPhoto ? (
          <div className="absolute inset-0 scale-110 bg-cover bg-center blur-[56px] saturate-[0.85]" style={{ backgroundImage: `url(${washPhoto})`, opacity: "var(--wash-opacity)" }} />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_10%,var(--gold-soft),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_35%,var(--background)_100%)]" />
      </div>

      <div className="mx-6 flex flex-wrap items-center justify-between gap-3 pt-5 sm:mx-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <Link href="/admin/events" className="inline-flex shrink-0 items-center gap-1.5 text-gold hover:underline">
            <ArrowLeft size={14} className="sm:hidden" /> Projects
          </Link>
          <ChevronRight size={14} className="hidden shrink-0 text-muted sm:block" aria-hidden />
          <span className="hidden truncate text-foreground/90 sm:block">{event.title}</span>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeMenu value={theme} defaultId={defaultTheme} onChange={pickTheme} />
          <a
            href={`/portal/events/${id}`}
            target="_blank"
            rel="noreferrer"
            data-tour="event-client-portal"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card/60 px-3 py-1.5 text-xs font-medium hover:border-gold"
          >
            <ExternalLink size={13} /> View client portal
          </a>
        </div>
      </div>

      {residency && (
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
      )}
      {residency ? (
        <ResidencyTop
          eventId={id}
          data={residency}
          activeTab={activeTab}
          projectPhoto={event.hero_image_url}
          onAddPhoto={() => heroFileInput.current?.click()}
          onOpenGig={(g, focus) => {
            if (!resTab) router.push(`/admin/events/${id}?tab=Coverage`);
            setResDrawer({ kind: "gig", id: g.id, focus });
          }}
          onSchedule={() => {
            if (!resTab) router.push(`/admin/events/${id}?tab=Coverage`);
            setResDrawer({ kind: "add" });
          }}
        />
      ) : (
        <>
          {/* Split header: banner photo, then the project's title and key facts. */}
          <header data-tour="project-header" className="mx-6 mt-4 grid gap-6 sm:mx-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-stretch">
            <div>
              <div
                className={cn("relative aspect-[16/8] w-full overflow-hidden rounded-[16px] border border-border bg-cover bg-center shadow-[var(--shadow-card)] lg:aspect-auto lg:h-full lg:min-h-[280px]", !event.hero_image_url && "bg-panel")}
                style={event.hero_image_url ? { backgroundImage: `url(${event.hero_image_url})` } : { backgroundImage: "radial-gradient(120% 90% at 30% 20%, var(--gold-soft), transparent 70%)" }}
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
                {!event.hero_image_url && (
                  <button onClick={() => heroFileInput.current?.click()} disabled={uploadingHero} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted hover:text-foreground">
                    <ImagePlus size={28} strokeWidth={1.4} className="text-gold" /> Add a banner photo
                  </button>
                )}
                <div className="absolute right-3 top-3 flex gap-1.5">
                  {event.hero_image_url && (
                    <button
                      onClick={handleRemoveHeroPhoto}
                      disabled={uploadingHero}
                      title="Remove banner photo"
                      className="rounded-[10px] bg-[rgba(0,0,0,0.38)] p-2 text-white backdrop-blur-sm hover:bg-[rgba(0,0,0,0.55)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => heroFileInput.current?.click()}
                    disabled={uploadingHero}
                    title={event.hero_image_url ? "Change banner photo" : "Add a banner photo"}
                    className="rounded-[10px] bg-[rgba(0,0,0,0.38)] p-2 text-white backdrop-blur-sm hover:bg-[rgba(0,0,0,0.55)]"
                  >
                    <Camera size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted">This banner photo also becomes the hero image guests see on the event&rsquo;s Crate Request page.</p>
            </div>

            <div className={cn("flex flex-col justify-center rounded-[16px] bg-[var(--header-panel)] text-[var(--header-fg)]", gala ? "px-7 py-7" : "lg:px-2")}>
              <p className="text-[11px] font-semibold uppercase tracking-[3px] text-gold" style={gala ? { color: "var(--gold-light)" } : undefined}>
                Project detail
              </p>
              <h1 className="mt-2 font-display text-4xl leading-[1.08] sm:text-[44px]">{event.title}</h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
                <span className="flex items-center gap-2">
                  <CalendarDays size={17} strokeWidth={1.6} className="opacity-80" />
                  {event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Date TBD"}
                </span>
                {event.starts_at && (
                  <span className="flex items-center gap-2">
                    <Clock size={17} strokeWidth={1.6} className="opacity-80" />
                    {timeOf(event.starts_at)}
                    {event.ends_at ? ` – ${timeOf(event.ends_at)}` : ""}
                  </span>
                )}
                {venueLabel && (
                  <span className="flex items-center gap-2">
                    <MapPin size={17} strokeWidth={1.6} className="opacity-80" /> {venueLabel}
                  </span>
                )}
              </p>
              <div className="mt-5 h-px bg-[color-mix(in_srgb,var(--header-fg)_14%,transparent)]" aria-hidden />
              <dl className="mt-4 grid grid-cols-3">
                {stats.map((st, i) => (
                  <div key={st.label} className={cn("min-w-0 px-4 first:pl-0", i > 0 && "border-l border-[color-mix(in_srgb,var(--header-fg)_14%,transparent)]")}>
                    <dt className="text-[10px] font-semibold uppercase tracking-[2.5px] text-[var(--header-muted)]">{st.label}</dt>
                    <dd className="mt-1 truncate font-display text-xl capitalize">{st.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </header>

          <div className="mx-6 mt-6 sm:mx-8">
            <BookingPanel
              stages={FORWARD_PIPELINE_STAGES}
              current={stage}
              onSelect={handlePipelineStageChange}
              disabled={savingPipelineStage}
              guide={guide}
              actionHref={(a) => `/admin/events/${id}?tab=${a.tab ?? "Activity"}${a.anchor ? `#${a.anchor}` : ""}`}
              onMove={handlePipelineStageChange}
            />
          </div>

          {isBar && residency === null && (
            <div className="mx-6 mt-6 sm:mx-8">
              <MakeRecurringCard eventId={id} venueLinked={!!event.venue_id} startsAt={event.starts_at} endsAt={event.ends_at} timezone={event.timezone} onCreated={() => void loadResidency()} />
            </div>
          )}

          <div className="mx-6 mt-6 sm:mx-8" data-tour="project-tabs">
            <Tabs items={TAB_ITEMS} active={activeTab} hrefFor={(key) => `/admin/events/${id}?tab=${key}`} emphasis />
          </div>

          <div className="mx-6 mt-6 sm:mx-8">
            <ProjectDayCards
              eventId={id}
              isWedding={isWedding}
              venueName={venueLabel}
              venueId={event.venue_id ?? null}
              heroUrl={event.hero_image_url}
              startsAt={event.starts_at}
              endsAt={event.ends_at}
              timezone={event.timezone}
              serviceType={event.service_type}
              guests={event.expected_guests}
            />
          </div>
        </>
      )}

      {residency && resTab ? (
        <ResidencyBody
          eventId={id}
          data={residency}
          activeTab={activeTab}
          reload={() => void loadResidency()}
          drawer={resDrawer}
          setDrawer={setResDrawer}
          ledger={
            <PaymentLedger
              eventId={id}
              payments={payments}
              balanceCents={balance?.balanceCents ?? null}
              depositCents={event.deposit_amount != null ? Math.round(event.deposit_amount * 100) : null}
              onChange={refreshPayments}
            />
          }
        />
      ) : (
          <div className="mx-6 mt-6 flex flex-col gap-8 sm:mx-8 lg:flex-row">
            {event.clients && editingContact && (
              <ContactEditDrawer
                contact={event.clients as unknown as EditableContact}
                open
                onClose={() => setEditingContact(false)}
                onSaved={(c) => {
                  setEvent((prev) => (prev ? { ...prev, clients: { ...prev.clients!, ...(c as unknown as Partial<ClientRow>) } } : prev));
                  setEditingContact(false);
                }}
              />
            )}
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
                  {event.clients && (
                    <button onClick={() => setEditingContact(true)} className="ml-2 rounded-[6px] text-xs text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" data-tour="project-edit-contact">
                      Edit
                    </button>
                  )}
                  <button onClick={() => setChangingContact(true)} className="ml-2 rounded-[6px] text-xs text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
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

                  {(event.event_category === "wedding" || !event.event_category) && (
                    <div data-tour="wb-panel" id="wedding-basics" className="scroll-mt-6"><WeddingBasicsPanel eventId={id} clientPhone={event.clients?.phone ?? null} clientFirstName={event.clients?.first_name ?? null} /></div>
                  )}

                  {event.event_category === "wedding" && (
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

                  {event.event_category === "wedding" && event.wedding_music_plan_sent_at && (() => {
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
                  <PlaybookPanel eventId={id} />
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

                  <PaymentLedger
                    eventId={id}
                    payments={payments}
                    balanceCents={balance?.balanceCents ?? null}
                    depositCents={event.deposit_amount != null ? Math.round(event.deposit_amount * 100) : null}
                    onChange={refreshPayments}
                  />
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
                <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                  <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">





                  <GlassCard className="flex flex-col gap-3" data-tour="event-details">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xl">Event Details</p>
                      {!editingDetails && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setDetailsDraft({
                              title: event.title,
                              eventType: event.event_type ?? "",
                              expectedGuests: event.expected_guests != null ? String(event.expected_guests) : "",
                              // The inputs show local time: convert from the stored UTC instant (slicing it would shift the time on save).
                              startsAt: event.starts_at ? toLocalInput(event.starts_at) : "",
                              endsAt: event.ends_at ? toLocalInput(event.ends_at) : "",
                              venueId: event.venues ? (venueOptions.find((v) => v.label === event.venues?.name)?.id ?? "") : "",
                              finalAmount: event.final_amount != null ? String(event.final_amount) : "",
                              djId: event.dj_id ?? ""
                            });
                            setEditingDetails(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingDetails ? (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-status-declined">
                          If this contract is already signed, changing these creates a change order both the client and DJ must acknowledge — nothing is silently altered.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem]" data-tour="event-details-name">
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Project name</span>
                            <input
                              value={detailsDraft.title ?? ""}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, title: e.target.value }))}
                              maxLength={200}
                              required
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Event type</span>
                            <input
                              value={detailsDraft.eventType ?? ""}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, eventType: e.target.value }))}
                              list="event-type-options"
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                            <datalist id="event-type-options">
                              {EVENT_TYPES.map((t) => (
                                <option key={t} value={t} />
                              ))}
                            </datalist>
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Guests</span>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={detailsDraft.expectedGuests ?? ""}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, expectedGuests: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Start time</span>
                            <input
                              type="datetime-local"
                              value={detailsDraft.startsAt}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, startsAt: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">End time</span>
                            <input
                              type="datetime-local"
                              value={detailsDraft.endsAt}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, endsAt: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">DJ</span>
                            <select
                              value={detailsDraft.djId}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, djId: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            >
                              <option value="">Unassigned</option>
                              {djOptions.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Venue</span>
                            <select
                              value={detailsDraft.venueId}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, venueId: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            >
                              <option value="">No venue</option>
                              {venueOptions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Final amount ($)</span>
                            <input
                              type="number"
                              value={detailsDraft.finalAmount}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, finalAmount: e.target.value }))}
                              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={savingDetails}
                            onClick={async () => {
                              setSavingDetails(true);
                              try {
                                const res = await fetch(`/api/admin/events/${id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    ...(detailsDraft.title !== undefined && detailsDraft.title.trim() !== event.title ? { title: detailsDraft.title } : {}),
                                    ...(detailsDraft.eventType !== undefined && (detailsDraft.eventType.trim() || null) !== (event.event_type ?? null) ? { eventType: detailsDraft.eventType.trim() || null } : {}),
                                    ...(detailsDraft.expectedGuests !== undefined && (detailsDraft.expectedGuests === "" ? null : Number(detailsDraft.expectedGuests)) !== (event.expected_guests ?? null) ? { expectedGuests: detailsDraft.expectedGuests === "" ? null : Number(detailsDraft.expectedGuests) } : {}),
                                    startsAt: detailsDraft.startsAt ? new Date(detailsDraft.startsAt).toISOString() : null,
                                    endsAt: detailsDraft.endsAt ? new Date(detailsDraft.endsAt).toISOString() : null,
                                    venueId: detailsDraft.venueId || null,
                                    finalAmount: detailsDraft.finalAmount ? Number(detailsDraft.finalAmount) : null,
                                    djId: detailsDraft.djId || null
                                  })
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to save");
                                setEditingDetails(false);
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Something went wrong.");
                              } finally {
                                setSavingDetails(false);
                              }
                            }}
                          >
                            {savingDetails ? "Saving..." : "Save"}
                          </Button>
                          <Button variant="text" size="sm" onClick={() => setEditingDetails(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-3" data-tour="event-details-grid">
                          {detailFacts.map((f) => (
                            <div key={f.label} className="min-w-0 sm:border-l sm:border-border sm:pl-4 sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(3n+1)]:pl-0">
                              <dt className="text-xs text-muted">{f.label}</dt>
                              <dd className={cn("mt-0.5 truncate text-[17px] font-medium leading-snug", f.muted && "text-muted")} title={f.value}>
                                {f.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {event.package_snapshot && (
                          <p className="text-sm" data-tour="event-requested-package">
                            <span className="text-muted">Asked about: </span>
                            <strong>{event.package_snapshot.name}</strong>
                            {" · "}
                            {priceLabel({ pricing_type: event.package_snapshot.pricing_type, price: event.package_snapshot.price })}
                            {event.package_snapshot.category ? ` · ${event.package_snapshot.category}` : ""}
                            <span className="text-xs text-muted"> (as shown {new Date(event.package_snapshot.captured_at).toLocaleDateString()}; later Services edits don&apos;t change it)</span>
                          </p>
                        )}
                        {(event.clients?.partner_first_name || event.clients?.partner_last_name || event.clients?.married_last_name || choiceLabels(event.clients?.contact_methods)) && (
                          <div className="flex flex-col gap-1 border-t border-border pt-3">
                            {(event.clients?.partner_first_name || event.clients?.partner_last_name) && (
                              <Row label="Partner" value={[event.clients.partner_first_name, event.clients.partner_last_name].filter(Boolean).join(" ") + (event.clients.partner_phone ? ` · ${event.clients.partner_phone}` : "")} />
                            )}
                            {event.clients?.married_last_name && <Row label="Married last name" value={event.clients.married_last_name} />}
                            {choiceLabels(event.clients?.contact_methods) && (
                              <Row label="Best way to reach" value={[choiceLabels(event.clients?.contact_methods), choiceLabels(event.clients?.best_days), choiceLabels(event.clients?.best_times)].filter(Boolean).join(" · ")} />
                            )}
                          </div>
                        )}
                        <p className="border-t border-border pt-3 text-sm">
                          <span className="text-muted">Final amount: </span>
                          <span className="font-semibold">{agreed ? `$${agreed.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Not finalized"}</span>
                          {agreed && <span className="text-xs text-muted"> · {agreed.source}</span>}
                        </p>
                      </>
                    )}
                  </GlassCard>

                  {changeOrders.length > 0 && (
                    <GlassCard className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-[1.5px] text-muted">Change orders</p>
                      {changeOrders.map((c) => (
                        <div key={c.id} className="flex flex-col gap-1 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                          <p className="text-xs text-muted">{new Date(c.created_at).toLocaleString()}</p>
                          {c.changes.map((change, i) => (
                            <p key={i}>
                              <span className="font-medium">{change.label}:</span> {change.oldValue} → {change.newValue}
                            </p>
                          ))}
                          <p className="text-xs">
                            Client: {c.client_acknowledged_at ? `Acknowledged by ${c.client_acknowledged_by}` : "Pending"} · DJ:{" "}
                            {c.dj_acknowledged_at ? "Acknowledged" : "Pending"}
                          </p>
                        </div>
                      ))}
                    </GlassCard>
                  )}

                  <EquipmentPlanCard eventId={id} />

                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                    <div id="project-contracts" className="scroll-mt-6">
                      <ContractsPanel eventId={id} contracts={contracts} onChange={load} />
                    </div>
                    <GlassCard className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-[1.5px] text-muted">Client notes</p>
                      {event.special_requests ? <p className="whitespace-pre-wrap text-sm">{event.special_requests}</p> : <p className="text-sm text-muted">No notes from the client yet.</p>}
                    </GlassCard>
                  </div>

                  <div id="project-recommendation" className="scroll-mt-6">
                    <PackageRecommendation eventId={id} linkControls="event" />
                  </div>

                  <div id="project-dj-offer" className="scroll-mt-6">
                    <DjOfferPanel eventId={id} djs={djOptions} />
                  </div>

                  <div id="project-questionnaire" className="scroll-mt-6">
                    <QuestionnaireSummary eventId={id} />
                  </div>

                  <div id="project-meetings" className="scroll-mt-6">
                    <MeetingsPanel eventId={id} />
                  </div>

                  <div id="project-packages" className="scroll-mt-6">
                    <PackageTemplatePicker eventId={id} />
                  </div>

                  <PackageSelectionPanel eventId={id} />

                  <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">


                    {event.event_category !== "wedding" && <div data-tour="event-flyer"><EventFlyerPanel eventId={id} /></div>}

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
                        {(event.wedding_music_plan.wedding_party ?? []).length > 0 && (
                          <div className="pb-1">
                            <p className="text-xs font-medium text-muted">Wedding party order of entry</p>
                            {event.wedding_music_plan.wedding_party!.map((p, i) => (
                              <p key={i} className="text-sm">
                                {i + 1}. {p.name}
                                {p.pronunciation ? ` (${p.pronunciation})` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                        {WEDDING_PLAN_FIELDS.map(({ key, label }) => {
                          const value = event.wedding_music_plan?.[key];
                          if (!value || (Array.isArray(value) && value.length === 0)) return null;
                          return <Row key={key} label={label} value={Array.isArray(value) ? value.join(", ") : value} />;
                        })}
                      </GlassCard>
                    )}

                    {event.day_timeline && event.day_timeline.length > 0 && (
                      <GlassCard className="flex flex-col gap-1">
                        <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Day-of timeline</p>
                        {event.day_timeline.map((entry, i) => (
                          <Row key={i} label={entry.time || "—"} value={entry.label + (entry.note ? ` — ${entry.note}` : "")} />
                        ))}
                      </GlassCard>
                    )}

                    {event.vendor_contacts && event.vendor_contacts.length > 0 && (
                      <GlassCard className="flex flex-col gap-1">
                        <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Vendor contacts</p>
                        {event.vendor_contacts.map((v, i) => (
                          <Row key={i} label={v.role || "Vendor"} value={[v.name, v.phone, v.email].filter(Boolean).join(" · ") || "—"} />
                        ))}
                      </GlassCard>
                    )}

                    {(event.vendor_meal_count != null || event.venue_load_in_notes || event.weather_backup_plan) && (
                      <GlassCard className="flex flex-col gap-1">
                        <p className="mb-1 text-xs uppercase tracking-[1.5px] text-muted">Day-of logistics</p>
                        {event.vendor_meal_count != null && <Row label="Vendor meal count" value={String(event.vendor_meal_count)} />}
                        {event.venue_load_in_notes && <Row label="Load-in / parking" value={event.venue_load_in_notes} />}
                        {event.weather_backup_plan && <Row label="Weather backup plan" value={event.weather_backup_plan} />}
                      </GlassCard>
                    )}

                  </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
                  <PortalHeroPanel
                    eventId={id}
                    initial={{
                      couple_display_name: event.couple_display_name,
                      portal_hero_image_url: event.portal_hero_image_url,
                      portal_hero_settings: event.portal_hero_settings,
                      portal_hero_headline_override: event.portal_hero_headline_override,
                      portal_hero_subheading_override: event.portal_hero_subheading_override,
                      timezone: event.timezone
                    }}
                    eventCategory={event.event_category}
                  />

                    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-status-declined/25 bg-status-declined/5 px-4 py-3" data-tour="delete-project">
                      <p className="text-[11px] text-muted">Permanently delete this project. This can&rsquo;t be undone.</p>
                      <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="shrink-0 gap-1.5">
                        <Trash2 size={13} />
                        Delete Project
                      </Button>
                    </div>
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
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete this project?"
        body="This permanently deletes the project and everything attached to it — contracts, files, messages, tasks, and the client portal. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete Project"}
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteConfirm(false)}
      />
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
