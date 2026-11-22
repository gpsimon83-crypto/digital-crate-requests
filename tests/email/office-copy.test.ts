import { describe, expect, it } from "vitest";
import { isDjOwnClient, officeCopyFor } from "@/lib/office-copy";

function db(row: { office_copy_email?: string | null } | null, error: unknown = null) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error }) };
  return { from: () => q } as never;
}

describe("isDjOwnClient", () => {
  it("is true only for clients the DJ added through Leads", () => {
    expect(isDjOwnClient({ referral_source: "added by DJ Penny" }, "DJ Penny")).toBe(true);
    expect(isDjOwnClient({ referral_source: " Added by dj penny " }, "DJ Penny")).toBe(true);
    expect(isDjOwnClient({ referral_source: "added by DJ Peace" }, "DJ Penny")).toBe(false);
    expect(isDjOwnClient({ referral_source: "Website" }, "DJ Penny")).toBe(false);
    expect(isDjOwnClient({ referral_source: null }, "DJ Penny")).toBe(false);
    expect(isDjOwnClient(null, "DJ Penny")).toBe(false);
    expect(isDjOwnClient({ referral_source: "added by " }, "")).toBe(false);
  });
});

describe("officeCopyFor", () => {
  it("copies the office on DCDJ clients", async () => {
    expect(await officeCopyFor(db({ office_copy_email: "office@example.com" }), { referral_source: "Website" }, "DJ Penny")).toBe("office@example.com");
  });
  it("skips the DJ's own clients", async () => {
    expect(await officeCopyFor(db({ office_copy_email: "office@example.com" }), { referral_source: "added by DJ Penny" }, "DJ Penny")).toBeNull();
  });
  it("sends no copy when the address is unset, invalid, or the column is missing", async () => {
    expect(await officeCopyFor(db({ office_copy_email: null }), null, "DJ Penny")).toBeNull();
    expect(await officeCopyFor(db({ office_copy_email: "nope" }), null, "DJ Penny")).toBeNull();
    expect(await officeCopyFor(db(null, { message: "column does not exist" }), null, "DJ Penny")).toBeNull();
  });
});
