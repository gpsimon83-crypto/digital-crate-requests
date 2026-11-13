import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchVenueNights } from "@/lib/venue/calendar-feed";

const KEY = "k".repeat(40);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("venue nights from the shared DCDJ calendar", () => {
  it("sends the partner key and the venue's names, and keeps only safe fields", async () => {
    vi.stubEnv("INQUIRY_PARTNER_SECRET", KEY);
    const calls: { url: string; key: string | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: URL, init: RequestInit) => {
      calls.push({ url: String(url), key: new Headers(init.headers).get("x-dcdj-partner-key") });
      return new Response(JSON.stringify({ nights: [
        { id: "gcal_abc", date: "2026-11-14", starts_at: "2026-11-14T21:00:00-06:00", ends_at: "2026-11-15T02:00:00-06:00", all_day: false, matched: "North 48", state: "confirmed", dj: { name: "DJ Que", photo_url: "https://digitalcratedjs.com/q.png" }, summary: "Private: Jordan Lee birthday", notes: "secret" },
        { id: "x", date: "not-a-date" },
        { id: "gcal_def", date: "2026-11-28", state: "weird", dj: { name: "DJ X", photo_url: "javascript:alert(1)" } }
      ] }), { status: 200 });
    }));
    const r = await fetchVenueNights(["North 48", "N48|bad"], "2026-11", 9);
    expect(calls[0].key).toBe(KEY);
    expect(calls[0].url).toContain("/wp-json/dcdj/v1/venue-nights");
    expect(new URL(calls[0].url).searchParams.get("names")).toBe("North 48");
    expect(new URL(calls[0].url).searchParams.get("months")).toBe("3");
    expect(r.status).toBe("ok");
    expect(r.nights).toHaveLength(2);
    expect(r.nights[0]).toEqual({ id: "gcal_abc", date: "2026-11-14", starts_at: "2026-11-14T21:00:00-06:00", ends_at: "2026-11-15T02:00:00-06:00", all_day: false, matched: "North 48", state: "confirmed", dj_text: "", dj: { name: "DJ Que", photo_url: "https://digitalcratedjs.com/q.png" } });
    expect(JSON.stringify(r)).not.toMatch(/Jordan|secret/);
    expect(r.nights[1].state).toBe("open");
    expect(r.nights[1].dj?.photo_url).toBeNull();
  });

  it("does nothing without names, reports 'off' without a key, and never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await fetchVenueNights([], "2026-11")).toEqual({ nights: [], status: "ok" });
    vi.stubEnv("INQUIRY_PARTNER_SECRET", "short");
    expect(await fetchVenueNights(["Casey Keys"], "2026-11")).toEqual({ nights: [], status: "off" });
    vi.stubEnv("INQUIRY_PARTNER_SECRET", KEY);
    expect(await fetchVenueNights(["Casey Keys"], "2026-11")).toEqual({ nights: [], status: "error" });
  });
});
