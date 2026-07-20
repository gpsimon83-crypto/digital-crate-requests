"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Compass } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { TagPicker } from "@/components/dashboard/tag-picker";
import { NewBadge } from "@/components/dashboard/new-badge";
import {
  EVENT_TYPES, CROWD_AGE_RANGES, CLEAN_MUSIC_OPTIONS, GENRE_TAGS, ERA_OPTIONS,
} from "@/lib/crate-taxonomy";

export interface GuidedSetup {
  crateName: string;
  eventType: string;
  venueId: string | null;
  crowdAgeRange: string;
  expectedAttendance: string;
  cleanRequirement: string;
  preferredGenres: string[];
  preferredEras: string[];
  desiredEnergy: string;
  crateSize: string;
  assignedDjId: string | null;
  eventDurationMinutes: string;
  templateId: string | null;
}

const ENERGY_CHOICES = ["Low", "Moderate", "High", "Peak / Wild"];

interface Venue { id: string; name: string; location: string | null }
interface DjOption { id: string; display_name: string }
interface TemplateOption {
  id: string; name: string; event_type: string | null;
  target_genres: string[]; target_eras: string[]; clean_requirement: string | null;
}

/** Optional guided setup panel — collapsible, skippable. Populates a
 * starting point for filters/guidance; never required to build a crate
 * manually. */
export function GuidedCrateSetup({
  value,
  onChange,
  isStaff,
}: {
  value: GuidedSetup | null;
  onChange: (setup: GuidedSetup | null) => void;
  isStaff: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [djs, setDjs] = useState<DjOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/venues")
      .then((r) => r.json())
      .then((d) => setVenues(d.venues ?? []))
      .catch(() => setVenues([]));
    fetch("/api/admin/crate-templates")
      .then((r) => r.json())
      .then((d) => setTemplates((d.templates ?? []).filter((t: { active: boolean }) => t.active)))
      .catch(() => setTemplates([]));
    if (isStaff) {
      fetch("/api/admin/djs")
        .then((r) => r.json())
        .then((d) => setDjs((d.djs ?? []).map((dj: { id: string; display_name: string }) => ({ id: dj.id, display_name: dj.display_name }))))
        .catch(() => setDjs([]));
    }
  }, [isStaff]);

  const setup: GuidedSetup =
    value ?? {
      crateName: "",
      eventType: "",
      venueId: null,
      crowdAgeRange: "",
      expectedAttendance: "",
      cleanRequirement: "",
      preferredGenres: [],
      preferredEras: [],
      desiredEnergy: "",
      crateSize: "",
      assignedDjId: null,
      eventDurationMinutes: "",
      templateId: null,
    };

  function update(patch: Partial<GuidedSetup>) {
    onChange({ ...setup, ...patch });
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (!t) {
      update({ templateId: null });
      return;
    }
    update({
      templateId: t.id,
      eventType: t.event_type || setup.eventType,
      preferredGenres: t.target_genres.length > 0 ? t.target_genres : setup.preferredGenres,
      preferredEras: t.target_eras.length > 0 ? t.target_eras : setup.preferredEras,
      cleanRequirement: t.clean_requirement || setup.cleanRequirement,
    });
  }

  return (
    <GlassCard neon className="flex flex-col gap-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Compass size={14} /> Guided Crate Setup <span className="text-xs font-normal normal-case text-muted/70">(optional)</span>
          <NewBadge />
        </span>
        {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {!expanded && (
        <p className="text-xs text-muted">
          Answer a few questions about the event and crowd to guide your crate — or skip this and build manually below.
        </p>
      )}

      {expanded && (
        <div className="flex flex-col gap-4">
          {templates.length > 0 && (
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-xs text-muted">
                Start from Template <NewBadge />
              </span>
              <select
                value={setup.templateId ?? ""}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full rounded-xl border border-gold/30 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">None — build from scratch</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Crate Name</span>
              <input
                value={setup.crateName}
                onChange={(e) => update({ crateName: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Event Type</span>
              <select
                value={setup.eventType}
                onChange={(e) => update({ eventType: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Choose…</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Venue</span>
              <select
                value={setup.venueId ?? ""}
                onChange={(e) => update({ venueId: e.target.value || null })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">None</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Crowd Age Range</span>
              <select
                value={setup.crowdAgeRange}
                onChange={(e) => update({ crowdAgeRange: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Choose…</option>
                {CROWD_AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Expected Attendance</span>
              <input
                value={setup.expectedAttendance}
                onChange={(e) => update({ expectedAttendance: e.target.value })}
                placeholder="e.g. 150"
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Clean Music Requirement</span>
              <select
                value={setup.cleanRequirement}
                onChange={(e) => update({ cleanRequirement: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Choose…</option>
                {CLEAN_MUSIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Desired Energy Level</span>
              <select
                value={setup.desiredEnergy}
                onChange={(e) => update({ desiredEnergy: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Choose…</option>
                {ENERGY_CHOICES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Crate Size (target # of songs)</span>
              <input
                value={setup.crateSize}
                onChange={(e) => update({ crateSize: e.target.value })}
                placeholder="e.g. 60"
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Event Duration (minutes)</span>
              <input
                value={setup.eventDurationMinutes}
                onChange={(e) => update({ eventDurationMinutes: e.target.value })}
                placeholder="e.g. 240"
                className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            {isStaff && (
              <label className="block">
                <span className="mb-1 block text-xs text-muted">DJ Assigned</span>
                <select
                  value={setup.assignedDjId ?? ""}
                  onChange={(e) => update({ assignedDjId: e.target.value || null })}
                  className="w-full rounded-xl border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  <option value="">Me</option>
                  {djs.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">Preferred Genres</p>
            <TagPicker options={GENRE_TAGS} selected={setup.preferredGenres} onChange={(v) => update({ preferredGenres: v })} />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">Preferred Eras</p>
            <TagPicker options={ERA_OPTIONS} selected={setup.preferredEras} onChange={(v) => update({ preferredEras: v })} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange(null)}
              className="rounded-full border border-black/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-black/25 hover:text-foreground"
            >
              Skip / Clear Guided Setup
            </button>
            <p className="text-[11px] text-muted">Applied automatically when you save a crate below.</p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
