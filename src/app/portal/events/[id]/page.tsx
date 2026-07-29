"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Tabs } from "@/components/ui/tabs";
import { TagPicker } from "@/components/dashboard/tag-picker";
import { SongSlotField } from "@/components/portal/song-slot-field";
import { ArrowLeft, X, CalendarDays, FileText } from "lucide-react";

interface WeddingMusicPlan {
  processional_song?: string;
  wedding_party_entrance_song?: string;
  bride_entrance_song?: string;
  recessional_song?: string;
  bridal_party_order?: string;
  grand_march_song?: string;
  first_dance_song?: string;
  father_daughter_song?: string;
  mother_son_song?: string;
  special_dances?: string[];
  special_dance_songs?: string;
  games?: string[];
  spotify_ids?: Record<string, string>;
}

interface EventDetail {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  event_type: string | null;
  service_type: string | null;
  expected_guests: number | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  special_requests: string | null;
  wedding_music_plan: WeddingMusicPlan | null;
  wedding_music_plan_sent_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_amount: number | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  contract_signed_by: string | null;
  contract_document_url: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
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

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files" },
  { key: "payment", label: "Payment" },
  { key: "services", label: "Services" }
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
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

  const [mustPlay, setMustPlay] = useState<string[]>([]);
  const [doNotPlay, setDoNotPlay] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [newMustPlay, setNewMustPlay] = useState("");
  const [newDoNotPlay, setNewDoNotPlay] = useState("");
  const [weddingPlan, setWeddingPlan] = useState<WeddingMusicPlan>({});

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
      setMustPlay(data.event.must_play ?? []);
      setDoNotPlay(data.event.do_not_play ?? []);
      setSpecialRequests(data.event.special_requests ?? "");
      setWeddingPlan(data.event.wedding_music_plan ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
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

  const isWedding = event.event_type?.toLowerCase() === "wedding";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-12">
      <Link href="/portal" className="mb-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Your events
      </Link>

      <h1 className="font-display text-4xl font-light">{event.title}</h1>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
        <CalendarDays size={13} />
        {event.starts_at ? new Date(event.starts_at).toLocaleString() : "Date TBD"}
        {event.venues?.name ? ` · ${event.venues.name}` : ""}
        {event.djs?.display_name ? ` · ${event.djs.display_name}` : ""}
      </p>

      <Tabs items={TABS} active={activeTab} hrefFor={(key) => `/portal/events/${id}?tab=${key}`} className="mt-6" />

      {activeTab === "overview" && (
        <div className="mt-6 flex flex-col gap-4">
          <GlassCard className="flex flex-col gap-2">
            <p className="text-sm font-semibold">At a glance</p>
            <Row
              label="Contract"
              value={event.contract_signed_at ? "Signed" : event.contract_sent_at ? "Awaiting signature" : "Not sent yet"}
            />
            <Row
              label="Balance due"
              value={balance ? `$${(balance.balanceCents / 100).toFixed(2)}` : "—"}
            />
            <Row label="Night plan" value={`${mustPlay.length} must-play · ${doNotPlay.length} do-not-play`} />
          </GlassCard>
          {event.djs?.display_name && (
            <GlassCard className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Your DJ</p>
              <p className="text-sm text-muted">{event.djs.display_name}</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "files" && (
        <div className="mt-6 flex flex-col gap-8">
          <section>
            {event.contract_document_url ? (
              <GlassCard neon className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Contract</p>
                <a
                  href={event.contract_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gold hover:underline"
                >
                  <FileText size={14} /> View contract document
                </a>

                {event.contract_signed_at ? (
                  <p className="text-sm text-status-approved">
                    Signed by {event.contract_signed_by} on {new Date(event.contract_signed_at).toLocaleDateString()}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted">
                      Typing your full legal name below and clicking Sign counts as your electronic signature on this
                      contract.
                    </p>
                    <input
                      value={signName}
                      onChange={(e) => setSignName(e.target.value)}
                      placeholder="Your full legal name"
                      className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                    />
                    {signError && <p className="text-xs text-status-declined">{signError}</p>}
                    <NeonButton color="gold" onClick={handleSign} disabled={signing} className="w-fit">
                      {signing ? "Signing..." : "Sign Contract"}
                    </NeonButton>
                  </div>
                )}
              </GlassCard>
            ) : (
              <GlassCard className="flex flex-col gap-1">
                <p className="text-sm font-semibold">No files yet</p>
                <p className="text-sm text-muted">Your contract will show up here once it&rsquo;s sent.</p>
              </GlassCard>
            )}
          </section>

          {isWedding && !event.wedding_music_plan_sent_at && (
            <section className="border border-border p-4">
              <p className="text-sm font-medium">Wedding Music Plan</p>
              <p className="mt-1 text-sm text-muted">
                Your DJ sends this planning form once your deposit is in — check back after your first payment.
              </p>
            </section>
          )}

          {isWedding && event.wedding_music_plan_sent_at && (
            <section className="flex flex-col gap-6">
              <div>
                <p className="font-display text-2xl font-light">Wedding Music Plan</p>
                <p className="mt-1 text-sm text-muted">
                  Type each song yourself, or search Spotify to fill it in for you. Changes save separately from the
                  rest of this page.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Ceremony
                  </p>
                  <div className="flex flex-col gap-3">
                    <SongSlotField
                      label="Processional Song"
                      value={weddingPlan.processional_song ?? ""}
                      onChange={(v, sid) => updateSong("processional_song", v, sid)}
                    />
                    <SongSlotField
                      label="Wedding Party Entrance Song"
                      value={weddingPlan.wedding_party_entrance_song ?? ""}
                      onChange={(v, sid) => updateSong("wedding_party_entrance_song", v, sid)}
                      required
                    />
                    <SongSlotField
                      label="Bride Entrance Song"
                      value={weddingPlan.bride_entrance_song ?? ""}
                      onChange={(v, sid) => updateSong("bride_entrance_song", v, sid)}
                      required
                    />
                    <SongSlotField
                      label="Recessional Song"
                      value={weddingPlan.recessional_song ?? ""}
                      onChange={(v, sid) => updateSong("recessional_song", v, sid)}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Reception
                  </p>
                  <div className="flex flex-col gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
                        Bridal Party Order of Entry (bride &amp; groom last)
                      </span>
                      <textarea
                        value={weddingPlan.bridal_party_order ?? ""}
                        onChange={(e) => updatePlan("bridal_party_order", e.target.value)}
                        placeholder="Names in order..."
                        className="min-h-[70px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                      />
                    </label>
                    <SongSlotField
                      label="Grand March Song"
                      value={weddingPlan.grand_march_song ?? ""}
                      onChange={(v, sid) => updateSong("grand_march_song", v, sid)}
                      required
                    />
                    <SongSlotField
                      label="First Dance"
                      value={weddingPlan.first_dance_song ?? ""}
                      onChange={(v, sid) => updateSong("first_dance_song", v, sid)}
                      required
                    />
                    <SongSlotField
                      label="Father/Daughter Dance"
                      value={weddingPlan.father_daughter_song ?? ""}
                      onChange={(v, sid) => updateSong("father_daughter_song", v, sid)}
                    />
                    <SongSlotField
                      label="Mother/Son Dance"
                      value={weddingPlan.mother_son_song ?? ""}
                      onChange={(v, sid) => updateSong("mother_son_song", v, sid)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Special Dances <span className="text-muted normal-case">(at most 2 recommended)</span>
                  </p>
                  <TagPicker
                    options={SPECIAL_DANCE_OPTIONS}
                    selected={weddingPlan.special_dances ?? []}
                    onChange={(v) => updatePlan("special_dances", v)}
                  />
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
                      className="mt-2 min-h-[60px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Reception Games
                  </p>
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

              {error && <p className="text-sm text-status-declined">{error}</p>}
              {planSaved && <p className="text-sm text-status-approved">Saved.</p>}

              <div className="flex items-center gap-3 border-t border-border pt-4">
                <NeonButton color="gold" onClick={handleSaveMusicPlan} disabled={savingPlan} className="w-fit">
                  {savingPlan ? "Saving..." : "Save Music Plan"}
                </NeonButton>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "payment" && (
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
                    <Link
                      href={`/portal/events/${id}/pay?kind=deposit&amount=${Math.min(Math.round(event.deposit_amount * 100), balance.balanceCents)}`}
                    >
                      <NeonButton color="gold">Pay Deposit (${event.deposit_amount.toFixed(2)})</NeonButton>
                    </Link>
                  )}
                  <Link href={`/portal/events/${id}/pay?kind=balance&amount=${balance.balanceCents}`}>
                    <NeonButton color="gold">Pay Full Balance (${(balance.balanceCents / 100).toFixed(2)})</NeonButton>
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

      {activeTab === "services" && (
        <div className="mt-6 flex flex-col gap-4">
          {(event.event_type || event.service_type || event.expected_guests) && (
            <GlassCard className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Your booking</p>
              {event.event_type && <Row label="Event type" value={event.event_type} />}
              {event.service_type && <Row label="Service" value={event.service_type} />}
              {event.expected_guests != null && <Row label="Expected guests" value={String(event.expected_guests)} />}
            </GlassCard>
          )}

          <p className="text-sm text-muted">
            Build your night — tell your DJ exactly what to play and what to skip. Changes save to your event
            automatically for the DJ to see.
          </p>

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
                className="flex-1 rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newMustPlay.trim()) {
                    setMustPlay([...mustPlay, newMustPlay.trim()]);
                    setNewMustPlay("");
                  }
                }}
                className="rounded-[2px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
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
                className="flex-1 rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newDoNotPlay.trim()) {
                    setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                    setNewDoNotPlay("");
                  }
                }}
                className="rounded-[2px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
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
              placeholder="First dance song, timeline details, anything else your DJ should know..."
              className="min-h-[100px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </GlassCard>

          {error && <p className="text-sm text-status-declined">{error}</p>}
          {saved && <p className="text-sm text-status-approved">Saved.</p>}

          <NeonButton color="gold" onClick={handleSave} disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save changes"}
          </NeonButton>
        </div>
      )}
    </div>
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
        <span key={`${item}-${i}`} className="flex items-center gap-1.5 rounded-[2px] border border-black/10 bg-panel px-3 py-1.5 text-xs">
          {item}
          <button onClick={() => onRemove(i)} className="text-muted hover:text-status-declined">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
