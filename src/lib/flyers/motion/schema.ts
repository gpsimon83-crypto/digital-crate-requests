import { z } from "zod";
import { ROLES, type Role } from "../types";
import { PRESET_BY_ID } from "./presets";
import { ANIMATION_VERSION, DURATIONS, MAX_STACK, type Animation } from "./types";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const num = (lo: number, hi: number, d: number) => z.preprocess((v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d), z.number());

const item = z.object({
  id: z.string().min(1).max(40),
  preset: z.string().refine((p) => PRESET_BY_ID.has(p), "Unknown motion preset"),
  strength: num(0, 1, 0.25),
  cycles: z.preprocess((v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(8, Math.max(1, Math.round(v))) : 1), z.number()),
  phase: num(0, 1, 0),
  easing: z.enum(["easeInOut", "linear", "easeOut"]).catch("easeInOut"),
  direction: z.enum(["left", "right", "up", "down"]).optional().catch(undefined),
  color: hex.optional().catch(undefined),
  blend: z.enum(["normal", "screen", "overlay", "soft-light", "multiply"]).optional().catch(undefined),
  seed: z.preprocess((v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.abs(v)) % 100000 : undefined), z.number().optional()),
  timing: z.object({ in: num(0.02, 0.48, 0.18), out: num(0.02, 0.48, 0.18) }).optional().catch(undefined)
});

const layer = z.object({
  stack: z.array(item).max(MAX_STACK),
  role: z.enum(Object.keys(ROLES) as [Role, ...Role[]]).optional().catch(undefined),
  muted: z.boolean().optional().catch(undefined),
  solo: z.boolean().optional().catch(undefined)
});

const animation = z.object({
  v: z.literal(ANIMATION_VERSION),
  enabled: z.boolean(),
  duration: z.preprocess((v) => ((DURATIONS as readonly number[]).includes(v as number) ? v : 8), z.number()),
  fps: z.literal(30).catch(30),
  intensity: z.enum(["subtle", "balanced", "high"]).catch("balanced"),
  readableLock: z.boolean().catch(true),
  recipe: z.string().max(40).nullable().catch(null),
  layers: z.record(z.string().max(60), layer).refine((l) => Object.keys(l).length <= 80, "Too many animated layers")
});

/** Checks saved animation settings (null = no animation). */
export function parseAnimation(v: unknown): { ok: true; value: Animation | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  const r = animation.safeParse(v);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Invalid animation settings" };
  return { ok: true, value: r.data as Animation };
}
