/**
 * Animate video export jobs. The browser that starts a job draws and
 * encodes the video (frame by frame, see video-export.tsx), reports
 * progress here, and uploads the MP4 to private storage. These rules keep
 * jobs honest:
 *
 * - states only move forward: queued → rendering → encoding → completed,
 *   or to failed / cancelled from any active state (a retry re-queues);
 * - a job whose browser stops reporting for 90 s is marked failed, so a
 *   closed tab never leaves a job stuck;
 * - a person has at most 2 active jobs, and a job is tried at most 3 times;
 * - finished files are kept for 30 days.
 */

export const JOB_STATES = ["queued", "rendering", "encoding", "completed", "failed", "cancelled"] as const;
export type JobState = (typeof JOB_STATES)[number];
export const ACTIVE: JobState[] = ["queued", "rendering", "encoding"];

export const STALE_MS = 90_000;
export const MAX_ACTIVE_PER_USER = 2;
export const MAX_ATTEMPTS = 3;
export const KEEP_DAYS = 30;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const VIDEO_BUCKET = "flyer-videos";

export type RenderJob = {
  id: string;
  design_id: string;
  dj_id: string | null;
  created_by: string;
  format: "story" | "portrait" | "square";
  width: number;
  height: number;
  duration: number;
  fps: number;
  status: JobState;
  progress: number;
  error: string | null;
  attempts: number;
  codec: string | null;
  storage_path: string | null;
  bytes: number | null;
  heartbeat_at: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

const NEXT: Record<JobState, JobState[]> = {
  queued: ["rendering", "failed", "cancelled"],
  rendering: ["rendering", "encoding", "failed", "cancelled"],
  encoding: ["encoding", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

/** May a job go from one state to another (as reported by the browser)? */
export function canMove(from: JobState, to: JobState) {
  return NEXT[from].includes(to);
}

export const isActive = (s: JobState) => ACTIVE.includes(s);

/** The states a job may be in for a report of `to` to apply (so two reports in flight at once can't clash). */
export function fromStates(to: JobState): JobState[] {
  return JOB_STATES.filter((f) => canMove(f, to));
}

/** An active job nobody has heard from in a while: its tab was closed or crashed. */
export function isStale(j: Pick<RenderJob, "status" | "heartbeat_at">, now = Date.now()) {
  return isActive(j.status) && now - new Date(j.heartbeat_at).getTime() > STALE_MS;
}

export function canRetry(j: Pick<RenderJob, "status" | "attempts">) {
  return (j.status === "failed" || j.status === "cancelled") && j.attempts < MAX_ATTEMPTS;
}

/** Where a finished video is stored: inside the flyer's DJ folder, named by the job (never by project data). */
export function videoPath(j: Pick<RenderJob, "id" | "design_id" | "dj_id">) {
  return `${j.dj_id ?? "staff"}/${j.design_id}/${j.id}.mp4`;
}

/** Who may see a job: staff, the flyer's DJ, or whoever started it. */
export function canSeeJob(j: Pick<RenderJob, "dj_id" | "created_by">, who: { staff: boolean; userId: string; djId: string | null }) {
  return who.staff || j.created_by === who.userId || (!!who.djId && j.dj_id === who.djId);
}

/** A short, actionable message for a failure the browser reported. */
export function cleanError(e: unknown) {
  const s = typeof e === "string" ? e : "The video couldn't be made.";
  return s.replace(/\s+/g, " ").trim().slice(0, 300) || "The video couldn't be made.";
}
