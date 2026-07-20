"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import {
  Music, Boxes, Copy, Wand2, RefreshCw, UserCircle, ArrowLeft,
  CheckCircle2, XCircle, FolderOpen, AlertTriangle, Tags, Plus, Trash2, Eye, Pencil, ListMusic,
} from "lucide-react";
import { errorMessage } from "@/lib/error-message";
import {
  walkAudioFiles, analyzeScan, planDedupe, executeDedupe,
  listCrates, buildCratesFromFolders, formatGB,
  planFilenameCleanup, executeFilenameCleanup,
  type ScanResult, type CrateRow, type AudioFileEntry, type DedupePlanItem, type RenamePlanItem,
} from "@/lib/browser-serato";
import { saveRootHandle, loadRootHandle } from "@/lib/handle-store";
import { PhotoBanner } from "@/components/dashboard/photo-banner";
import { PageBackdrop } from "@/components/dashboard/page-backdrop";
import { ExpandableChip } from "@/components/dashboard/expandable-chip";
import { ManualCrateBuilder } from "@/components/dashboard/manual-crate-builder";
import { MasterPlayerProvider } from "@/components/dashboard/master-player";
import { CrateArtGrid } from "@/components/dashboard/crate-art-grid";
import { CrateDetailView } from "@/components/dashboard/crate-detail-view";
import type { CrateArt } from "@/lib/crate-art";
import {
  enrichFilesLocally, fillMissingYears, filterTracksByQuery, buildSmartCrate, availableGenreOptions,
  FIELD_LABELS, COMPARATORS_FOR_FIELD, NUMERIC_FIELDS,
  type EnrichedTrack, type SmartRule, type RuleField, type RuleComparator,
} from "@/lib/smart-crates";
import { CRATE_CATEGORIES, SONG_FUNCTIONS, CROWD_FIT_TAGS, CONTENT_RATINGS, CRATE_STATUSES } from "@/lib/crate-taxonomy";
import { GuidedCrateSetup, type GuidedSetup } from "@/components/dashboard/guided-crate-setup";
import { EliteCrateBrowser } from "@/components/dashboard/elite-crate-browser";
import { NewBadge } from "@/components/dashboard/new-badge";
import type { CrateProfileSummary } from "@/lib/crate-profile-types";

const ENERGY_OPTIONS = [
  { value: "warmup", label: "Warm Up" },
  { value: "smooth", label: "Smooth" },
  { value: "moderate", label: "Moderate" },
  { value: "high_energy", label: "High Energy" },
];

const supportsFsAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Crate paths are full volume-relative paths (e.g.
 * "CORE DCDJ/AUGPACK22/Blxst - About You (Clean).mp3"); folder-breakdown
 * entries are already bare filenames. Normalize both to just "Artist -
 * Song" by taking the basename and stripping the extension. */
function cleanTrackLabel(pathOrName: string): string {
  const base = pathOrName.split("/").pop() ?? pathOrName;
  return base.replace(/\.[a-zA-Z0-9]+$/, "");
}

let ruleIdCounter = 0;
function newRule(): SmartRule {
  ruleIdCounter += 1;
  return { id: `rule-${ruleIdCounter}`, field: "genre", comparator: "is", value: "" };
}

const TAG_BATCH_SIZE = 150;

/** Batches key lookups against /api/dj/library/tags (GET query strings
 * don't scale to a whole library at once) and merges the results onto
 * each track's `.tags`, so Advanced Song Filtering / Smart Crates can
 * filter by song_function/crowd_fit/content_rating/crate_status. */
async function mergeTrackTags(
  tracks: EnrichedTrack[],
  onProgress?: (done: number, total: number) => void
): Promise<EnrichedTrack[]> {
  const byKey = new Map(tracks.map((t) => [t.key, t]));
  const keys = [...new Set(tracks.map((t) => t.key))];
  let done = 0;

  for (let i = 0; i < keys.length; i += TAG_BATCH_SIZE) {
    const batch = keys.slice(i, i + TAG_BATCH_SIZE);
    try {
      const res = await fetch(`/api/dj/library/tags?keys=${encodeURIComponent(batch.join(","))}`);
      if (res.ok) {
        const data = await res.json();
        for (const [key, raw] of Object.entries(data.tags as Record<string, Record<string, string[]>>)) {
          const t = byKey.get(key);
          if (!t) continue;
          t.tags = {
            genre: raw.genre, era: raw.era, songFunction: raw.song_function, crowdFit: raw.crowd_fit,
            vocalType: raw.vocal_type, contentRating: raw.content_rating, crateStatus: raw.crate_status,
          };
        }
      }
    } catch {
      // tags are additive — filtering still works on the fields already loaded
    }
    done += batch.length;
    onProgress?.(done, keys.length);
  }

  return [...byKey.values()];
}

export default function LibraryDashboardPage() {
  const [supported, setSupported] = useState(true);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [rootName, setRootName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [files, setFiles] = useState<AudioFileEntry[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [crates, setCrates] = useState<CrateRow[] | null>(null);
  const [seratoFound, setSeratoFound] = useState(false);

  const [dedupePlan, setDedupePlan] = useState<DedupePlanItem[] | null>(null);
  const [dedupeResult, setDedupeResult] = useState<{ moved: number; errors: string[] } | null>(null);
  const [renamePlan, setRenamePlan] = useState<RenamePlanItem[] | null>(null);
  const [renameResult, setRenameResult] = useState<{ renamed: number; errors: string[] } | null>(null);
  const [buildResult, setBuildResult] = useState<{ created: string[]; skipped: string[] } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [enrichedTracks, setEnrichedTracks] = useState<EnrichedTrack[] | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<string | null>(null);
  const [smartRules, setSmartRules] = useState<SmartRule[]>([newRule()]);
  const [smartMatchType, setSmartMatchType] = useState<"all" | "any">("all");
  const [smartCrateName, setSmartCrateName] = useState("");
  const [smartBuildResult, setSmartBuildResult] = useState<{ created: boolean; reason?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [crateArtMap, setCrateArtMap] = useState<Record<string, CrateArt>>({});
  const [selectedCrate, setSelectedCrate] = useState<CrateRow | null>(null);

  const [guidedSetup, setGuidedSetup] = useState<GuidedSetup | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [crateProfiles, setCrateProfiles] = useState<Record<string, CrateProfileSummary>>({});
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setIsStaff(["owner", "admin", "manager"].includes(d.user?.role)))
      .catch(() => {});
  }, []);

  // Best-effort: fetch the shadow crate_profiles rows for whatever crates
  // are currently listed, so the category filter bar and Elite badges can
  // reflect them. Never blocks the core local-file crate list.
  useEffect(() => {
    if (!crates || crates.length === 0) return;
    const names = crates.map((c) => c.name.replace(/\.crate$/, ""));
    fetch(`/api/dj/library/crate-profiles?names=${encodeURIComponent(names.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, CrateProfileSummary> = {};
        for (const p of d.profiles ?? []) {
          map[p.name] = {
            category: p.category, is_elite: p.is_elite, elite_category: p.elite_category, is_shared: p.is_shared,
            energy_sections: p.energy_sections ?? [], dismissed_keys: p.dismissed_keys ?? [],
          };
        }
        setCrateProfiles(map);
      })
      .catch(() => {});
  }, [crates]);

  async function upsertCrateProfile(name: string, songKeys: { key: string; artist: string; title: string }[]) {
    try {
      await fetch("/api/dj/library/crate-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.replace(/\.crate$/, ""),
          category: guidedSetup ? "Event Crates" : undefined,
          guidedSetup: guidedSetup ?? undefined,
          songKeys,
        }),
      });
    } catch {
      // best-effort shadow record — never blocks the real local .crate save
    }
  }

  useEffect(() => {
    // Feature-detect only after mount (not during the lazy initializer) so
    // server-rendered HTML and the first client render match; correcting
    // `supported` here is the standard escape hatch for this exact case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(supportsFsAccess());
    loadRootHandle().then((h) => {
      if (h) {
        setRootHandle(h);
        setRootName(h.name);
      }
    }).catch(() => {});
  }, []);

  async function pickDrive() {
    setError(null);
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setRootHandle(handle);
      setRootName(handle.name);
      await saveRootHandle(handle);
      setScan(null);
      setCrates(null);
      setDedupePlan(null);
      setDedupeResult(null);
      setBuildResult(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(errorMessage(err));
    }
  }

  async function scanLibrary() {
    if (!rootHandle) return;
    setLoading(true);
    setError(null);
    setDedupePlan(null);
    setDedupeResult(null);
    setBuildResult(null);
    try {
      let musicHandle: FileSystemDirectoryHandle;
      try {
        musicHandle = await rootHandle.getDirectoryHandle("MUSIC");
      } catch {
        throw new Error(`No "MUSIC" folder found inside "${rootName}". Pick the drive's root folder (the one containing your MUSIC folder), not MUSIC itself.`);
      }

      setProgressMsg("Scanning files…");
      const audioFiles = await walkAudioFiles(musicHandle, (n) => {
        if (n % 500 === 0) setProgressMsg(`Scanning… ${n.toLocaleString()} files so far`);
      });
      setFiles(audioFiles);
      setScan(analyzeScan(audioFiles));

      try {
        const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
        setSeratoFound(true);
        try {
          const subcrates = await seratoHandle.getDirectoryHandle("Subcrates");
          setCrates(await listCrates(subcrates));
        } catch {
          setCrates([]);
        }
      } catch {
        setSeratoFound(false);
        setCrates(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  }

  function previewDedupe() {
    if (!scan) return;
    setDedupePlan(planDedupe(scan.dupeGroupsMap));
    setDedupeResult(null);
  }

  async function runDedupeLive() {
    if (!rootHandle || !dedupePlan) return;
    if (!confirm("This will MOVE duplicate files into a _DUPLICATES_REVIEW folder inside your MUSIC folder. Nothing is permanently deleted. Continue?")) return;
    setBusyAction("dedupe-live");
    setError(null);
    try {
      const musicHandle = await rootHandle.getDirectoryHandle("MUSIC");
      const result = await executeDedupe(musicHandle, dedupePlan, (done, total) =>
        setProgressMsg(`Moving duplicates… ${done}/${total}`)
      );
      setDedupeResult(result);
      await scanLibrary();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
      setProgressMsg(null);
    }
  }

  function previewRename() {
    setRenamePlan(planFilenameCleanup(files));
    setRenameResult(null);
  }

  async function runRenameLive() {
    if (!rootHandle || !renamePlan) return;
    if (!confirm(`This will rename ${renamePlan.length} file(s) in place to strip leading track numbers (e.g. "01. Artist - Song.mp3" -> "Artist - Song.mp3"). Continue?`)) return;
    setBusyAction("rename-live");
    setError(null);
    try {
      const musicHandle = await rootHandle.getDirectoryHandle("MUSIC");
      const result = await executeFilenameCleanup(musicHandle, renamePlan, (done, total) =>
        setProgressMsg(`Renaming files… ${done}/${total}`)
      );
      setRenameResult(result);
      await scanLibrary();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
      setProgressMsg(null);
    }
  }

  async function runEnrichMetadata() {
    if (files.length === 0) return;
    setBusyAction("enrich");
    setError(null);
    setSmartBuildResult(null);
    try {
      setEnrichProgress("Reading tags from files…");
      const local = await enrichFilesLocally(files, (done, total) =>
        setEnrichProgress(`Reading tags… ${done.toLocaleString()}/${total.toLocaleString()}`)
      );
      setEnrichedTracks(local);

      setEnrichProgress("Filling in missing release years…");
      const filled = await fillMissingYears(local, (done, total) =>
        setEnrichProgress(`Looking up years… ${done}/${total}`)
      );
      setEnrichedTracks(filled);

      setEnrichProgress("Loading song tags…");
      const withTags = await mergeTrackTags(filled, (done, total) =>
        setEnrichProgress(`Loading song tags… ${done}/${total}`)
      );
      setEnrichedTracks(withTags);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
      setEnrichProgress(null);
    }
  }

  const filesByFolder = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of files) {
      if (!map.has(f.top)) map.set(f.top, []);
      map.get(f.top)!.push(f.name);
    }
    return map;
  }, [files]);

  const brokenCrateCount = crates?.filter((c) => !c.error && c.paths.some((p) => !p.startsWith("MUSIC/"))).length ?? 0;

  const filteredCrates = crates?.filter((c) => {
    if (!categoryFilter) return true;
    const profileCategory = crateProfiles[c.name.replace(/\.crate$/, "")]?.category ?? "Personal DJ Crates";
    return profileCategory === categoryFilter;
  }) ?? null;

  const activeRules = smartRules.filter((r) => r.value.trim() !== "" || r.field === "energy");
  const smartMatches = enrichedTracks ? filterTracksByQuery(enrichedTracks, { rules: activeRules, matchType: smartMatchType }) : [];
  const availableGenres = enrichedTracks ? availableGenreOptions(enrichedTracks) : [];

  function updateRule(id: string, patch: Partial<SmartRule>) {
    setSmartRules((rules) => rules.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      // Reset comparator/value when field type changes so stale combos don't linger
      if (patch.field && patch.field !== r.field) {
        updated.comparator = COMPARATORS_FOR_FIELD[patch.field][0].value;
        updated.value = "";
        updated.value2 = "";
      }
      return updated;
    }));
  }

  async function runBuildSmartCrate() {
    if (!rootHandle || !smartCrateName.trim() || smartMatches.length === 0) return;
    setBusyAction("smart-build");
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const result = await buildSmartCrate(smartCrateName.trim(), smartMatches, "MUSIC", subcrates);
      setSmartBuildResult(result);
      if (result.created) {
        setCrates(await listCrates(subcrates));
        await upsertCrateProfile(smartCrateName.trim(), smartMatches.map((t) => ({ key: t.key, artist: t.artist, title: t.resolvedTitle })));
        setSmartCrateName("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function runBuildCrates() {
    if (!rootHandle) return;
    if (!confirm("This will ADD new Serato crates, one per top-level MUSIC folder. Existing crates are never modified or deleted. Continue?")) return;
    setBusyAction("build-live");
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const result = await buildCratesFromFolders("MUSIC", files, subcrates);
      setBuildResult(result);
      const updated = await listCrates(subcrates);
      setCrates(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  }

  // One-time fix for crates built before a path bug fix: those had the
  // wrong volume-relative prefix (missing "MUSIC"), so Serato can't find
  // their tracks. Deletes the broken .crate files (never touches
  // sub-folders like "Serato Stems", which predate this tool) and
  // rebuilds them with the corrected path logic.
  async function fixLegacyCrates() {
    if (!rootHandle || !crates) return;
    const brokenNames = crates.filter((c) => !c.error && c.paths.some((p) => !p.startsWith("MUSIC/"))).map((c) => c.name);
    if (brokenNames.length === 0) {
      alert("No broken crates found — nothing to fix.");
      return;
    }
    if (!confirm(`This will DELETE ${brokenNames.length} crate(s) with broken track paths and rebuild them correctly (one per top-level MUSIC folder). Crates already using the correct path format are left untouched. Continue?`)) return;

    setBusyAction("fix-legacy");
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      for (const name of brokenNames) {
        try {
          await subcrates.removeEntry(name);
        } catch (err) {
          console.error(`Failed to remove ${name}:`, err);
        }
      }
      const result = await buildCratesFromFolders("MUSIC", files, subcrates);
      setBuildResult(result);
      const updated = await listCrates(subcrates);
      setCrates(updated);
      setCrateArtMap({});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <MasterPlayerProvider>
    <div className="min-h-dvh bg-background relative z-0">
      {/* bg-background is a fallback for before PageBackdrop's photo loads.
          "relative z-0" (an explicit z-index, not just "relative") forces
          this div to establish its own stacking context — without that,
          a plain box's own background paints ABOVE a negative-z-index
          fixed descendant at the root stacking context, hiding the
          backdrop entirely. Verified this the hard way; don't remove. */}
      <PageBackdrop section="hero" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="glow-ring">
            <Logo variant="icon" color="gold" size={30} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-muted">Digital Crate DJs</p>
            <p className="gold-text-gradient text-base font-extrabold tracking-tight">Crate Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://digitalcratedjs.com/members"
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-foreground"
          >
            <ArrowLeft size={14} /> Back to Digital Crate DJs
          </a>
          <Link
            href="/dj-dashboard/bookings"
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-foreground"
          >
            <UserCircle size={14} /> My Bookings
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8">
        <PhotoBanner section="hero" title="Studio & Crate Gallery" height={280} />

        {!supported && (
          <GlassCard className="flex items-center gap-3 border-status-pending/30 text-sm">
            <AlertTriangle className="shrink-0 text-status-pending" size={18} />
            <span>Your browser doesn&apos;t support direct folder access (this needs Chrome or Edge). Open this page in Chrome to use Crate Builder.</span>
          </GlassCard>
        )}

        {error && (
          <GlassCard className="border-status-declined/30 text-sm text-status-declined">{error}</GlassCard>
        )}

        <GlassCard className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Library Location</p>
          <p className="-mt-2 text-xs text-muted">
            Pick the root folder of the drive that has your <code>MUSIC</code> and <code>_Serato_</code> folders on it (e.g. the drive itself, not a subfolder). Everything runs in your browser — nothing is uploaded anywhere.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <NeonButton color="gold" onClick={pickDrive} disabled={!supported} className="!min-h-0 !py-2.5 !px-6 text-xs">
              <FolderOpen size={14} /> {rootHandle ? `Change Drive (${rootName})` : "Choose Drive Folder"}
            </NeonButton>
            {rootHandle && (
              <button
                onClick={scanLibrary}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold"
              >
                <RefreshCw size={13} /> {loading ? (progressMsg ?? "Scanning…") : "Scan Library"}
              </button>
            )}
          </div>
        </GlassCard>

        {scan && (
          <>
            <GuidedCrateSetup value={guidedSetup} onChange={setGuidedSetup} isStaff={isStaff} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <GlassCard className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gold/10 text-gold"><Music size={20} /></span>
                <div>
                  <p className="text-2xl font-extrabold">{scan.totalFiles.toLocaleString()}</p>
                  <p className="text-xs text-muted">Total Songs · {formatGB(scan.totalSizeBytes)} GB</p>
                </div>
              </GlassCard>
              <GlassCard className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gold/10 text-gold"><Boxes size={20} /></span>
                <div>
                  <p className="text-2xl font-extrabold">{crates?.length ?? 0}</p>
                  <p className="text-xs text-muted">Serato Crates</p>
                </div>
              </GlassCard>
              <GlassCard className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-status-declined/10 text-status-declined"><Copy size={20} /></span>
                <div>
                  <p className="text-2xl font-extrabold">{scan.exactDuplicateGroups}</p>
                  <p className="text-xs text-muted">Duplicate Groups · {formatGB(scan.exactDuplicateWastedBytes)} GB reclaimable</p>
                </div>
              </GlassCard>
              <GlassCard className="flex items-center gap-3">
                <span className={`flex size-11 items-center justify-center rounded-xl ${seratoFound ? "bg-status-approved/10 text-status-approved" : "bg-status-declined/10 text-status-declined"}`}>
                  {seratoFound ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                </span>
                <div>
                  <p className="text-sm font-bold">{seratoFound ? "Serato Library Found" : "No _Serato_ folder found"}</p>
                  <p className="text-xs text-muted">On this drive</p>
                </div>
              </GlassCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col gap-6 lg:col-span-2">
                <GlassCard>
                  <p className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    Folder Breakdown
                    <span className="text-xs font-normal normal-case text-muted/70">{scan.folders.length} folders</span>
                  </p>
                  <div className={`grid grid-cols-1 gap-1.5 overflow-y-auto pr-1 transition-all sm:grid-cols-2 xl:grid-cols-3 ${openFolder ? "max-h-[36rem]" : "max-h-80"}`}>
                    {scan.folders.map((f) => (
                      <ExpandableChip
                        key={f.name}
                        title={f.name}
                        subtitle={`${formatGB(f.sizeBytes)} GB · ${f.count} files`}
                        tracks={(filesByFolder.get(f.name) ?? []).map(cleanTrackLabel)}
                        isOpen={openFolder === f.name}
                        dimmed={openFolder !== null && openFolder !== f.name}
                        onToggle={() => setOpenFolder((cur) => (cur === f.name ? null : f.name))}
                      />
                    ))}
                  </div>
                </GlassCard>
              </div>

              <div className="flex flex-col gap-6">
                <GlassCard neon className="flex flex-col gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted">Quick Tools</p>

                  <div className="flex flex-col gap-2 rounded-xl border border-white/8 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Copy size={14} /> Scan Duplicates</p>
                    <button onClick={previewDedupe} disabled={busyAction !== null} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold">
                      Preview
                    </button>
                    {dedupePlan && (
                      <div className="rounded-lg bg-panel/70 p-2 text-xs text-muted">
                        {dedupePlan.length} files would move to review.
                        {dedupePlan.length > 0 && !dedupeResult && (
                          <button onClick={runDedupeLive} disabled={busyAction !== null} className="mt-2 block rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-black">
                            {busyAction === "dedupe-live" ? (progressMsg ?? "Moving…") : "Run for real"}
                          </button>
                        )}
                        {dedupeResult && (
                          <p className="mt-2">Moved {dedupeResult.moved} files.{dedupeResult.errors.length > 0 && ` ${dedupeResult.errors.length} errors.`}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-white/8 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Pencil size={14} /> Clean Up Filenames</p>
                    <p className="text-xs text-muted">Strips leading track numbers like &quot;01. Artist - Song&quot; -&gt; &quot;Artist - Song&quot;. Never touches real artist names like &quot;50 Cent&quot; or &quot;3-6 Mafia&quot;.</p>
                    <button onClick={previewRename} disabled={busyAction !== null} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold">
                      Preview
                    </button>
                    {renamePlan && (
                      <div className="rounded-lg bg-panel/70 p-2 text-xs text-muted">
                        {renamePlan.length} file(s) would be renamed.
                        {renamePlan.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {renamePlan.slice(0, 5).map((r) => (
                              <p key={r.oldName} className="truncate" title={`${r.oldName} -> ${r.newName}`}>
                                {r.oldName} <span className="text-gold">-&gt;</span> {r.newName}
                              </p>
                            ))}
                            {renamePlan.length > 5 && <p>…and {renamePlan.length - 5} more</p>}
                          </div>
                        )}
                        {renamePlan.length > 0 && !renameResult && (
                          <button onClick={runRenameLive} disabled={busyAction !== null} className="mt-2 block rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-black">
                            {busyAction === "rename-live" ? (progressMsg ?? "Renaming…") : "Run for real"}
                          </button>
                        )}
                        {renameResult && (
                          <p className="mt-2">Renamed {renameResult.renamed} files.{renameResult.errors.length > 0 && ` ${renameResult.errors.length} errors.`}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-white/8 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Wand2 size={14} /> Build Crates from Folders</p>
                    <button
                      onClick={runBuildCrates}
                      disabled={busyAction !== null || !seratoFound}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold disabled:opacity-40"
                    >
                      {busyAction === "build-live" ? "Building…" : "Build New Crates"}
                    </button>
                    {buildResult && (
                      <div className="rounded-lg bg-panel/70 p-2 text-xs text-muted">
                        Created {buildResult.created.length} new crate(s).
                        {buildResult.skipped.length > 0 && ` ${buildResult.skipped.length} already existed and were skipped.`}
                      </div>
                    )}
                  </div>

                  {brokenCrateCount > 0 && (
                    <div className="flex flex-col gap-2 rounded-xl border border-status-declined/30 bg-status-declined/5 p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-status-declined"><AlertTriangle size={14} /> Fix Broken Crates</p>
                      <p className="text-xs text-muted">
                        {brokenCrateCount} crate(s) have a broken track path (built before a path-format fix) and Serato won&apos;t be able to find their tracks. This deletes and rebuilds just those — crates already using the correct format are untouched.
                      </p>
                      <button
                        onClick={fixLegacyCrates}
                        disabled={busyAction !== null}
                        className="rounded-full bg-status-declined px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
                      >
                        {busyAction === "fix-legacy" ? "Fixing…" : `Fix ${brokenCrateCount} Crate(s)`}
                      </button>
                    </div>
                  )}

                  <button onClick={scanLibrary} disabled={loading} className="flex items-center justify-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted hover:border-white/25 hover:text-foreground">
                    <RefreshCw size={13} /> Refresh
                  </button>
                </GlassCard>
              </div>
            </div>

            <GlassCard neon className="flex flex-col gap-4">
              <p className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Serato Crates
                {crates && <span className="text-xs font-normal normal-case text-muted/70">{crates.length} crates</span>}
              </p>

              {!selectedCrate && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <NewBadge />
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${!categoryFilter ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-white/25 hover:text-foreground"}`}
                  >
                    All
                  </button>
                  {CRATE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${categoryFilter === cat ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-white/25 hover:text-foreground"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {selectedCrate ? (
                <CrateDetailView
                  crate={selectedCrate}
                  art={crateArtMap[selectedCrate.name]}
                  rootHandle={rootHandle!}
                  profile={crateProfiles[selectedCrate.name.replace(/\.crate$/, "")]}
                  isStaff={isStaff}
                  enrichedTracks={enrichedTracks}
                  guidedSetup={guidedSetup}
                  onClose={() => setSelectedCrate(null)}
                  onArtUpdated={(url) => setCrateArtMap((m) => ({ ...m, [selectedCrate.name]: { source: "upload", url } }))}
                  onProfileUpdated={(profile) =>
                    setCrateProfiles((m) => ({ ...m, [selectedCrate.name.replace(/\.crate$/, "")]: profile }))
                  }
                  onCrateRebuilt={async () => {
                    if (!rootHandle) return;
                    const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
                    const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
                    const updated = await listCrates(subcrates);
                    setCrates(updated);
                    const refreshed = updated.find((c) => c.name === selectedCrate.name);
                    if (refreshed) setSelectedCrate(refreshed);
                  }}
                />
              ) : filteredCrates && filteredCrates.length > 0 ? (
                <CrateArtGrid
                  crates={filteredCrates}
                  rootHandle={rootHandle!}
                  artMap={crateArtMap}
                  setArtMap={setCrateArtMap}
                  onSelect={setSelectedCrate}
                  crateProfiles={crateProfiles}
                />
              ) : (
                <p className="text-sm text-muted">No crates in this category yet.</p>
              )}

              {!selectedCrate && categoryFilter === "Elite Crates" && (
                <div className="border-t border-white/8 pt-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Elite Packs From Other DJs <NewBadge />
                  </p>
                  <EliteCrateBrowser enrichedTracks={enrichedTracks} rootHandle={rootHandle} />
                </div>
              )}
            </GlassCard>

            <GlassCard neon className="flex flex-col gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  <ListMusic size={14} /> Manual Crate Builder
                </p>
                <p className="mt-1 text-xs text-muted">
                  Search your library, preview individual tracks, and hand-pick exactly what goes in a crate — full control instead of auto-grouping by folder.
                </p>
              </div>
              <ManualCrateBuilder
                files={files}
                rootHandle={rootHandle}
                seratoFound={seratoFound}
                onCrateSaved={async (info) => {
                  if (!rootHandle) return;
                  const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
                  const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
                  setCrates(await listCrates(subcrates));
                  await upsertCrateProfile(info.name, info.songKeys);
                }}
              />
            </GlassCard>

            <GlassCard neon className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    <Tags size={14} /> Smart Crates
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Build crates from rules — same field/comparison vocabulary as Serato&apos;s own Smart Crates (Genre, BPM, Year, etc. with Is/Contains/Between/Greater Than). Genre &amp; year come from each file&apos;s real tags (gaps filled via Spotify where possible). Energy is a heuristic estimate from BPM/genre/filename, not measured data — sanity-check it. This builds a regular crate from a one-time snapshot of matches, not a live auto-updating Serato Smart Crate.
                  </p>
                </div>
                <button
                  onClick={runEnrichMetadata}
                  disabled={busyAction !== null}
                  className="shrink-0 rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
                >
                  {busyAction === "enrich" ? (enrichProgress ?? "Working…") : enrichedTracks ? "Re-run Metadata Agent" : "Run Metadata Agent"}
                </button>
              </div>

              {enrichedTracks && (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted">Match</span>
                    <button
                      onClick={() => setSmartMatchType("all")}
                      className={`rounded-full border px-2.5 py-1 font-medium ${smartMatchType === "all" ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted"}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSmartMatchType("any")}
                      className={`rounded-full border px-2.5 py-1 font-medium ${smartMatchType === "any" ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted"}`}
                    >
                      Any
                    </button>
                    <span className="text-muted">of the following rules</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {smartRules.map((rule) => (
                      <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-panel/50 p-2.5">
                        <select
                          value={rule.field}
                          onChange={(e) => updateRule(rule.id, { field: e.target.value as RuleField })}
                          className="rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                        >
                          {Object.entries(FIELD_LABELS).map(([field, label]) => (
                            <option key={field} value={field}>{label}</option>
                          ))}
                        </select>

                        <select
                          value={rule.comparator}
                          onChange={(e) => updateRule(rule.id, { comparator: e.target.value as RuleComparator })}
                          className="rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                        >
                          {COMPARATORS_FOR_FIELD[rule.field].map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>

                        {rule.field === "genre" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {availableGenres.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        ) : rule.field === "energy" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {ENERGY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : rule.field === "songFunction" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {SONG_FUNCTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : rule.field === "crowdFit" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {CROWD_FIT_TAGS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : rule.field === "contentRating" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {CONTENT_RATINGS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : rule.field === "crateStatus" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            {CRATE_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : rule.field === "eliteStatus" ? (
                          <select
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                            className="min-w-[140px] rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                          >
                            <option value="">Choose…</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <>
                            <input
                              value={rule.value}
                              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                              type={NUMERIC_FIELDS.includes(rule.field) ? "number" : "text"}
                              placeholder={rule.field === "year" ? "e.g. 1990" : rule.field === "bpm" ? "e.g. 120" : "value"}
                              className="w-28 rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                            />
                            {rule.comparator === "between" && (
                              <>
                                <span className="text-xs text-muted">and</span>
                                <input
                                  value={rule.value2 ?? ""}
                                  onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                                  type="number"
                                  placeholder={rule.field === "year" ? "e.g. 1999" : "e.g. 128"}
                                  className="w-28 rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 text-xs focus:border-gold focus:outline-none"
                                />
                              </>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => setSmartRules((rules) => rules.filter((r) => r.id !== rule.id))}
                          disabled={smartRules.length === 1}
                          className="ml-auto rounded-lg p-1.5 text-muted hover:text-status-declined disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSmartRules((rules) => [...rules, newRule()])}
                        className="flex items-center gap-1.5 self-start rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold"
                      >
                        <Plus size={13} /> Add Rule
                      </button>
                      {activeRules.length > 0 && (
                        <button
                          onClick={() => setSmartRules([newRule()])}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-status-declined"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </div>

                  {activeRules.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted">Active filters</span>
                      <NewBadge />
                      {activeRules.map((r) => (
                        <span key={r.id} className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[11px] text-gold">
                          {FIELD_LABELS[r.field]} {COMPARATORS_FOR_FIELD[r.field].find((c) => c.value === r.comparator)?.label ?? r.comparator} {r.value}{r.value2 ? ` – ${r.value2}` : ""}
                          <button onClick={() => setSmartRules((rules) => rules.filter((rr) => rr.id !== r.id) )} className="hover:text-status-declined">
                            <Trash2 size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-panel/50 p-3">
                    <p className="text-sm">
                      <span className="font-bold text-gold">{smartMatches.length.toLocaleString()}</span> tracks match
                    </p>
                    <button
                      onClick={() => setShowPreview((v) => !v)}
                      disabled={smartMatches.length === 0}
                      className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold disabled:opacity-40"
                    >
                      <Eye size={13} /> {showPreview ? "Hide Preview" : "Preview Songs"}
                    </button>
                    <input
                      value={smartCrateName}
                      onChange={(e) => setSmartCrateName(e.target.value)}
                      placeholder="Crate name, e.g. Warm Up 90s R&B"
                      className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
                    />
                    <button
                      onClick={runBuildSmartCrate}
                      disabled={busyAction !== null || !smartCrateName.trim() || smartMatches.length === 0 || !seratoFound}
                      className="rounded-full bg-gold px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
                    >
                      {busyAction === "smart-build" ? "Building…" : "Build Crate"}
                    </button>
                  </div>

                  {showPreview && smartMatches.length > 0 && (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-white/8 bg-panel/30 p-2">
                      {smartMatches.slice(0, 300).map((t, i) => (
                        <div key={`${t.key}-${i}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5">
                          <span className="truncate">{t.artist} — {t.resolvedTitle}</span>
                          <span className="shrink-0 text-muted">
                            {t.genre ?? "—"}{t.year ? ` · ${t.year}` : ""}{t.bpm ? ` · ${t.bpm} BPM` : ""}
                          </span>
                        </div>
                      ))}
                      {smartMatches.length > 300 && (
                        <p className="p-2 text-center text-xs text-muted">…and {(smartMatches.length - 300).toLocaleString()} more</p>
                      )}
                    </div>
                  )}

                  {smartBuildResult && (
                    <p className="text-xs text-muted">
                      {smartBuildResult.created ? "Crate created." : smartBuildResult.reason}
                    </p>
                  )}
                </>
              )}
            </GlassCard>
          </>
        )}

        <PhotoBanner section="behind-the-decks" title="Behind the Decks" height={220} />
      </main>
    </div>
    </MasterPlayerProvider>
  );
}
