import { describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: unknown }[] = [];
const rec = (fn: string) => vi.fn(async (args?: unknown) => {
  calls.push({ fn, args });
  return fn === "createInquiry" ? { id: "event-1" } : undefined;
});

vi.mock("@/lib/data/inquiries", () => ({ createInquiry: rec("createInquiry") }));
vi.mock("@/lib/send-sms", () => ({ sendInquiryAlertSms: rec("sms") }));
vi.mock("@/lib/activity", () => ({ logActivity: rec("activity") }));
vi.mock("@/lib/automations-engine", () => ({ runAutomations: rec("automations") }));
vi.mock("@/lib/notify-submission", () => ({ alertStaffOfSubmission: rec("staffAlert"), sendTrackedEmail: rec("clientEmail") }));
vi.mock("@/lib/send-system-email", () => ({ sendSystemEmail: vi.fn(async (a: unknown) => { calls.push({ fn: "systemEmail", args: a }); return "msg_1"; }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

describe("existing inquiry behaviour after verification", () => {
  it("a verified inquiry runs the same steps as before: lead, automations, SMS, staff alert, client email", async () => {
    const { leadActivator } = await import("@/lib/security/inquiry-activation");
    const id = await leadActivator.activate({
      id: "s1", kind: "inquiry", source: "website", name: "Jordan Lee", email: "jordan@example.com", phone: "3125550100",
      event_date: "2026-12-12", event_type: "Wedding", venue_name: "The Drake", expected_guests: 150, budget_range: "$2,000–$3,500",
      message: "R&B please", preferred_dj_id: null
    } as never);
    expect(id).toBe("event-1");
    expect(calls.map((c) => c.fn)).toEqual(["createInquiry", "activity", "automations", "sms", "staffAlert", "clientEmail"]);
    expect(calls[0].args).toMatchObject({ name: "Jordan Lee", email: "jordan@example.com", eventDate: "2026-12-12", eventType: "Wedding", venueName: "The Drake", expectedGuests: 150 });
    expect(calls[2].args).toBe("lead_created");
    expect(String((calls[5].args as { text: string }).text)).toMatch(/isn't reserved until we confirm/);
  });

  it("the confirmation email contains only fixed text and the link — nothing the visitor typed", async () => {
    calls.length = 0;
    const { systemInquiryMailer } = await import("@/lib/security/inquiry-activation");
    // The mailer's signature has no parameter for submitted text (name, message, venue…).
    await systemInquiryMailer.sendVerification("victim@example.com", "https://www.cratesdjs.com/inquiry/verify#t=abc", 24, "inquiry");
    const sent = calls[0].args as { to: string; subject: string; text: string };
    expect(sent.to).toBe("victim@example.com");
    expect(sent.subject).toBe("Confirm your Digital Crate DJs booking request");
    expect(sent.text).toContain("https://www.cratesdjs.com/inquiry/verify#t=abc");
    expect(sent.text).toMatch(/works once and expires in 24 hours/);
    expect(sent.text).not.toMatch(/https?:\/\/(?!www\.cratesdjs\.com)/);
  });
});
