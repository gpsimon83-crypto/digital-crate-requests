"use client";

import { useEffect, useState } from "react";
import { X, Star } from "lucide-react";
import { TagPicker } from "@/components/dashboard/tag-picker";
import {
  GENRE_TAGS, ERA_OPTIONS, SONG_FUNCTIONS, CROWD_FIT_TAGS,
  VOCAL_REACTION_TYPES, CONTENT_RATINGS, CRATE_STATUSES, FEEDBACK_TAGS,
} from "@/lib/crate-taxonomy";
import type { TrackTags } from "@/lib/smart-crates";
import { errorMessage } from "@/lib/error-message";
import { NewBadge } from "@/components/dashboard/new-badge";

const SECTIONS: { type: keyof TrackTags; label: string; options: readonly string[]; multi: boolean }[] = [
  { type: "genre", label: "Genre (additional tags)", options: GENRE_TAGS, multi: true },
  { type: "era", label: "Era", options: ERA_OPTIONS, multi: false },
  { type: "songFunction", label: "Song Function", options: SONG_FUNCTIONS, multi: true },
  { type: "crowdFit", label: "Crowd Fit", options: CROWD_FIT_TAGS, multi: true },
  { type: "vocalType", label: "Vocal / Reaction Type", options: VOCAL_REACTION_TYPES, multi: false },
  { type: "contentRating", label: "Content Rating", options: CONTENT_RATINGS, multi: false },
  { type: "crateStatus", label: "Crate Status", options: CRATE_STATUSES, multi: false },
];

const TAG_TYPE_API: Record<keyof TrackTags, string> = {
  genre: "genre", era: "era", songFunction: "song_function", crowdFit: "crowd_fit",
  vocalType: "vocal_type", contentRating: "content_rating", crateStatus: "crate_status",
};

/** Modal for tagging a single song across every Phase 1 category. Nothing
 * is required — a DJ can set only what they care about and close. */
export function TrackTagEditor({
  trackKey,
  label,
  onClose,
}: {
  trackKey: string;
  label: string;
  onClose: () => void;
}) {
  const [tags, setTags] = useState<TrackTags>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stars, setStars] = useState(0);
  const [crowdReaction, setCrowdReaction] = useState<number | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tagsRes, ratingRes] = await Promise.all([
          fetch(`/api/dj/library/tags?keys=${encodeURIComponent(trackKey)}`),
          fetch(`/api/dj/library/ratings?keys=${encodeURIComponent(trackKey)}`),
        ]);
        const data = await tagsRes.json();
        const ratingData = await ratingRes.json();
        if (cancelled) return;
        const raw = data.tags?.[trackKey] ?? {};
        setTags({
          genre: raw.genre ?? [],
          era: raw.era ?? [],
          songFunction: raw.song_function ?? [],
          crowdFit: raw.crowd_fit ?? [],
          vocalType: raw.vocal_type ?? [],
          contentRating: raw.content_rating ?? [],
          crateStatus: raw.crate_status ?? [],
        });
        const rating = ratingData.ratings?.[trackKey];
        if (rating) {
          setStars(rating.stars ?? 0);
          setCrowdReaction(rating.crowdReaction ?? null);
          setFeedbackTags(rating.feedbackTags ?? []);
          setNotes(rating.notes ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackKey]);

  async function saveRating(patch: Partial<{ stars: number; crowdReaction: number | null; feedbackTags: string[]; notes: string }>) {
    const next = {
      stars: patch.stars ?? stars,
      crowdReaction: patch.crowdReaction !== undefined ? patch.crowdReaction : crowdReaction,
      feedbackTags: patch.feedbackTags ?? feedbackTags,
      notes: patch.notes ?? notes,
    };
    if (patch.stars !== undefined) setStars(patch.stars);
    if (patch.crowdReaction !== undefined) setCrowdReaction(patch.crowdReaction);
    if (patch.feedbackTags !== undefined) setFeedbackTags(patch.feedbackTags);
    if (patch.notes !== undefined) setNotes(patch.notes);

    setRatingSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/library/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackKey, ...next }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save rating");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRatingSaving(false);
    }
  }

  async function updateSection(type: keyof TrackTags, values: string[]) {
    setTags((t) => ({ ...t, [type]: values }));
    setSaving(type);
    setError(null);
    try {
      const res = await fetch("/api/dj/library/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackKey, tagType: TAG_TYPE_API[type], values }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save tags");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted">Tag Song</p>
            <p className="truncate text-sm font-semibold">{label}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-1.5 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {error && <p className="mb-3 text-xs text-status-declined">{error}</p>}

        {loading ? (
          <p className="text-xs text-muted">Loading tags…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {SECTIONS.map((section) => (
              <div key={section.type}>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {section.label}
                  {saving === section.type && <span className="text-[10px] normal-case text-gold">Saving…</span>}
                </p>
                <TagPicker
                  options={section.options}
                  selected={tags[section.type] ?? []}
                  onChange={(values) => updateSection(section.type, values)}
                  multi={section.multi}
                />
              </div>
            ))}

            <div className="border-t border-white/8 pt-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Rating &amp; Performance Notes <NewBadge />
                {ratingSaving && <span className="text-[10px] normal-case text-gold">Saving…</span>}
              </p>

              <div className="mb-3 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => saveRating({ stars: stars === n ? 0 : n })}>
                    <Star size={18} className={n <= stars ? "fill-gold text-gold" : "text-muted"} />
                  </button>
                ))}
              </div>

              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-muted">Crowd Reaction (1–10)</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={crowdReaction ?? 5}
                  onChange={(e) => saveRating({ crowdReaction: Number(e.target.value) })}
                  className="w-full accent-[var(--gold)]"
                />
              </label>

              <div className="mb-3">
                <p className="mb-1.5 text-xs text-muted">Feedback</p>
                <TagPicker options={FEEDBACK_TAGS} selected={feedbackTags} onChange={(v) => saveRating({ feedbackTags: v })} multi />
              </div>

              <label className="block">
                <span className="mb-1 block text-xs text-muted">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => saveRating({ notes })}
                  rows={2}
                  placeholder={'e.g. "Worked well after 2000s hip-hop." / "Use clean intro edit."'}
                  className="w-full rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
