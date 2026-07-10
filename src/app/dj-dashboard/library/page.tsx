"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import {
  Music, Boxes, Copy, Wand2, RefreshCw, Radio, Sparkles,
  BarChart3, Calendar, Users2, UsersRound, UserCircle,
  CheckCircle2, XCircle, FolderOpen, AlertTriangle,
} from "lucide-react";
import { errorMessage } from "@/lib/error-message";
import {
  walkAudioFiles, analyzeScan, planDedupe, executeDedupe,
  listCrates, buildCratesFromFolders, formatGB,
  type ScanResult, type CrateRow, type AudioFileEntry, type DedupePlanItem,
} from "@/lib/browser-serato";
import { saveRootHandle, loadRootHandle } from "@/lib/handle-store";

const COMING_SOON = [
  { icon: Radio, label: "Now Playing", desc: "Live track from Serato's active session" },
  { icon: Sparkles, label: "Recommendations", desc: "Next-song suggestions by key & energy" },
  { icon: BarChart3, label: "Analytics", desc: "BPM trends, top songs, crowd energy history" },
  { icon: Calendar, label: "Gig Calendar", desc: "Upcoming bookings at a glance" },
  { icon: UsersRound, label: "Clients", desc: "Client history and preferences" },
  { icon: Users2, label: "Team", desc: "Shared notes across your DJ team" },
];

const supportsFsAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

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
  const [buildResult, setBuildResult] = useState<{ created: string[]; skipped: string[] } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
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
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
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

  async function runBuildCrates() {
    if (!rootHandle) return;
    if (!confirm("This will ADD new Serato crates, one per top-level MUSIC folder. Existing crates are never modified or deleted. Continue?")) return;
    setBusyAction("build-live");
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const result = await buildCratesFromFolders(rootName, files, subcrates);
      setBuildResult(result);
      const updated = await listCrates(subcrates);
      setCrates(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-6 py-4 sm:px-8">
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
          <Link
            href="/dj-dashboard/bookings"
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-foreground"
          >
            <UserCircle size={14} /> My Bookings
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8">
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
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Folder Breakdown</p>
                  <div className="flex flex-col gap-1.5">
                    {scan.folders.slice(0, 12).map((f) => (
                      <div key={f.name} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-muted">{formatGB(f.sizeBytes)} GB · {f.count} files</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Serato Crates</p>
                  {crates && crates.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {crates.map((c) => (
                        <div key={c.name} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                          <span className="truncate">{c.name}</span>
                          <span className="shrink-0 text-xs text-muted">{c.error ? "error" : `${c.trackCount} tracks`}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No crates found yet.</p>
                  )}
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

                  <button onClick={scanLibrary} disabled={loading} className="flex items-center justify-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted hover:border-white/25 hover:text-foreground">
                    <RefreshCw size={13} /> Refresh
                  </button>
                </GlassCard>
              </div>
            </div>
          </>
        )}

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Coming Soon</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON.map(({ icon: Icon, label, desc }) => (
              <GlassCard key={label} className="flex items-start gap-3 opacity-60">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted"><Icon size={18} /></span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {label}
                    <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] font-medium text-muted">Preview</span>
                  </p>
                  <p className="text-xs text-muted">{desc}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
