import { describe, expect, it } from "vitest";
import { CLIENT_FIELDS, EQUIPMENT_FIELDS, pickEditable } from "@/lib/editable-fields";

describe("pickEditable", () => {
  it("drops fields that aren't allowed", () => {
    const r = pickEditable({ first_name: " Ana ", id: "x", auth_user_id: "y", deleted_at: "z", created_at: "now" }, CLIENT_FIELDS);
    expect(r).toEqual({ ok: true, values: { first_name: "Ana" } });
  });
  it("clears empty strings to null", () => {
    const r = pickEditable({ phone: "", company_name: null }, CLIENT_FIELDS);
    expect(r).toEqual({ ok: true, values: { phone: null, company_name: null } });
  });
  it("checks emails and lower-cases them", () => {
    expect(pickEditable({ email: "Ana@Example.COM " }, CLIENT_FIELDS)).toEqual({ ok: true, values: { email: "ana@example.com" } });
    expect(pickEditable({ email: "not an email" }, CLIENT_FIELDS).ok).toBe(false);
  });
  it("only accepts listed choices", () => {
    expect(pickEditable({ status: "blocked" }, CLIENT_FIELDS).ok).toBe(true);
    expect(pickEditable({ status: "admin" }, CLIENT_FIELDS).ok).toBe(false);
  });
  it("takes any custom equipment name and category", () => {
    expect(pickEditable({ name: "Rev 7 controller", category: "controller", quantity_owned: "2" }, EQUIPMENT_FIELDS)).toEqual({
      ok: true,
      values: { name: "Rev 7 controller", category: "controller", quantity_owned: 2 }
    });
  });
  it("rejects bad numbers and dates", () => {
    expect(pickEditable({ quantity_owned: 1.5 }, EQUIPMENT_FIELDS).ok).toBe(false);
    expect(pickEditable({ quantity_owned: -1 }, EQUIPMENT_FIELDS).ok).toBe(false);
    expect(pickEditable({ purchase_date: "yesterday" }, EQUIPMENT_FIELDS).ok).toBe(false);
    expect(pickEditable({ purchase_date: "2026-03-04T00:00:00Z" }, EQUIPMENT_FIELDS)).toEqual({ ok: true, values: { purchase_date: "2026-03-04" } });
  });
  it("cleans tag lists", () => {
    expect(pickEditable({ tags: [" vip ", "", "wedding"] }, CLIENT_FIELDS)).toEqual({ ok: true, values: { tags: ["vip", "wedding"] } });
    expect(pickEditable({ tags: "vip" }, CLIENT_FIELDS).ok).toBe(false);
  });
});
