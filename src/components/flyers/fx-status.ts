/** Which photo layers are re-rendering their effects (the effects panel shows "Applying…" / errors). */
type Status = "working" | "ready" | "error";
const map = new Map<string, Status>();
const subs = new Set<() => void>();
export function setFxStatus(id: string, s: Status | null) {
  if (s === null) map.delete(id);
  else if (map.get(id) === s) return;
  else map.set(id, s);
  subs.forEach((f) => f());
}
export const fxStatusOf = (id: string | null | undefined) => (id ? (map.get(id) ?? null) : null);
export function subscribeFx(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
