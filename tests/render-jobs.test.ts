import { describe, expect, it } from "vitest";
import { canMove, canRetry, canSeeJob, isStale, videoPath, STALE_MS } from "@/lib/flyers/render-jobs";
import { framingFor, safeArea } from "@/lib/flyers/motion/formats";

describe("render job states", () => {
  it("only move forward, and finished jobs stay finished", () => {
    expect(canMove("queued", "rendering")).toBe(true);
    expect(canMove("rendering", "encoding")).toBe(true);
    expect(canMove("encoding", "completed")).toBe(true);
    expect(canMove("rendering", "queued")).toBe(false);
    expect(canMove("completed", "rendering")).toBe(false);
    expect(canMove("cancelled", "rendering")).toBe(false);
    expect(canMove("failed", "encoding")).toBe(false);
    for (const s of ["queued", "rendering", "encoding"] as const) {
      expect(canMove(s, "failed")).toBe(true);
      expect(canMove(s, "cancelled")).toBe(true);
    }
  });
  it("a quiet active job is stale; finished ones never are", () => {
    const old = new Date(Date.now() - STALE_MS - 1000).toISOString();
    expect(isStale({ status: "rendering", heartbeat_at: old })).toBe(true);
    expect(isStale({ status: "completed", heartbeat_at: old })).toBe(false);
    expect(isStale({ status: "rendering", heartbeat_at: new Date().toISOString() })).toBe(false);
  });
  it("retries are bounded", () => {
    expect(canRetry({ status: "failed", attempts: 1 })).toBe(true);
    expect(canRetry({ status: "failed", attempts: 3 })).toBe(false);
    expect(canRetry({ status: "completed", attempts: 1 })).toBe(false);
  });
  it("only staff, the flyer's DJ or the starter see a job", () => {
    const j = { dj_id: "dj1", created_by: "u1" };
    expect(canSeeJob(j, { staff: false, userId: "u2", djId: "dj2" })).toBe(false);
    expect(canSeeJob(j, { staff: false, userId: "u2", djId: "dj1" })).toBe(true);
    expect(canSeeJob(j, { staff: false, userId: "u1", djId: null })).toBe(true);
    expect(canSeeJob(j, { staff: true, userId: "u9", djId: null })).toBe(true);
  });
  it("storage paths come from ids only, never from project data", () => {
    expect(videoPath({ id: "j1", design_id: "d1", dj_id: "dj1" })).toBe("dj1/d1/j1.mp4");
  });
});

describe("other sizes", () => {
  const story = { width: 1080, height: 1920 };
  it("fill crops evenly (no stretching) and fit shows everything", () => {
    const crop = framingFor(story, "square", { mode: "crop", x: 0, y: 0, zoom: 1 });
    expect(crop.scale).toBe(1);
    expect(crop.oy).toBe((1080 - 1920) / 2);
    const fit = framingFor(story, "square", { mode: "fit", x: 0, y: 0, zoom: 1 });
    expect(fit.scale).toBeCloseTo(1080 / 1920);
    expect(fit.ox).toBeCloseTo((1080 - 1080 * (1080 / 1920)) / 2);
    expect(fit.oy).toBeCloseTo(0);
  });
  it("position moves within the free space; the own size is untouched", () => {
    expect(framingFor(story, "square", { mode: "crop", x: 0, y: -1, zoom: 1 }).oy + 0).toBe(0);
    expect(framingFor(story, "square", { mode: "crop", x: 0, y: 1, zoom: 1 }).oy).toBe(1080 - 1920);
    expect(framingFor(story, "story")).toEqual({ width: 1080, height: 1920, scale: 1, ox: 0, oy: 0 });
  });
  it("story keeps clear of the apps' top bar and caption area", () => {
    expect(safeArea("story")).toMatchObject({ top: 250, bottom: 340 });
  });
});

describe("overlapping reports", () => {
  it("a second 'rendering' beat still applies after the first moved the job on", async () => {
    const { fromStates } = await import("@/lib/flyers/render-jobs");
    expect(fromStates("rendering")).toEqual(["queued", "rendering"]);
    expect(fromStates("encoding")).toEqual(["rendering", "encoding"]);
    expect(fromStates("rendering")).not.toContain("cancelled");
  });
});

describe("safe area warnings", () => {
  it("flags event details a crop pushes outside the safe area", async () => {
    const { cutOff } = await import("@/lib/flyers/motion/formats");
    const scene = { width: 1080, height: 1920, nodes: [{ id: "v", name: "Venue", visible: true, x: 90, y: 100, width: 900, height: 170 }, { id: "t", name: "Title", visible: true, x: 90, y: 900, width: 900, height: 170 }] } as never;
    expect(cutOff(scene, "square", { mode: "crop", x: 0, y: 0, zoom: 1 }, () => true)).toEqual(["Venue"]);
    expect(cutOff(scene, "square", { mode: "fit", x: 0, y: 0, zoom: 1 }, (n) => n.id === "v")).toEqual([]);
  });
});
