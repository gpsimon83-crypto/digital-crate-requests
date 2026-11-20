/**
 * The Digital Crate DJs Wedding Playbook — coached tasks for a wedding's
 * Tasks tab. Pure: templates, coaching copy, due dates, what blocks what,
 * "Next up", change detection and outreach drafts. The database side is in
 * src/lib/data/playbook.ts. Timings are editable (playbook_task_timing);
 * the coaching copy lives here.
 */

export type Owner = "staff" | "booking_lead" | "dj" | "client";
export type Viewer = "staff" | "dj" | "client";
export type Watch = "venue" | "date" | "guests" | "coverage";

export const STAGES = [
  "Inquiry & Client Information",
  "Pricing & Proposal",
  "Contract & Retainer",
  "Booking Handoff & Planning",
  "Music & Timeline Review",
  "Day-Before Brief",
  "Wedding Day",
  "Post-Wedding Follow-up"
] as const;

export const OWNER_LABEL: Record<Owner, string> = { staff: "Booking staff", booking_lead: "Booking lead", dj: "Your DJ", client: "Client" };
export const ownerLabel = (o: Owner | null | undefined, viewer: Viewer) => (o === "dj" && viewer === "dj" ? "You" : o === "dj" ? "DJ" : o ? OWNER_LABEL[o] : "Staff");

/** Facts about the event the playbook reads from existing records. */
export type Facts = {
  isWedding: boolean;
  startsAt: string | null;
  timezone: string | null;
  createdAt: string;
  venue: string | null;
  guests: number | null;
  coverage: string[] | null;
  djAssigned: boolean;
  djName: string | null;
  clientFirst: string | null;
  proposalSent: boolean;
  contractSigned: boolean;
  retainerPaid: boolean;
  questionnaireDone: boolean;
  musicPlanSent: boolean;
  musicPlanDone: boolean;
  equipmentConfirmed: boolean;
  reviewUrl: string | null;
};

type Link = { label: string; staff?: string; dj?: string; client?: string };
export type Template = {
  key: string;
  stage: number;
  owner: Owner;
  title: string;
  /** objective: completes itself from records. judgment: DJ/staff confirm. recap/outreach: special forms. */
  kind: "objective" | "judgment" | "recap" | "outreach";
  objective?: (f: Facts) => boolean;
  nextMove: string;
  link?: Link;
  tip: string;
  readyWhen: string[];
  /** Template keys that must be done first (shown as "waiting on …"). */
  blockedBy?: string[];
  /** DJ planning work starts after the booking is handed off. */
  needsHandoff?: boolean;
  /** Details that, if they change after this was marked ready, reopen it. */
  watch?: Watch[];
  optional?: boolean;
};

const ADMIN = "/admin/events/{id}";
const DJP = "/dj-dashboard/projects/{id}";
const PORTAL = "/portal/events/{id}";

export const TEMPLATES: Template[] = [
  // 1. Inquiry & Client Information
  {
    key: "inquiry_details",
    stage: 1,
    owner: "staff",
    kind: "judgment",
    title: "Check availability and confirm the client's details",
    nextMove: "Check the date on the calendar, then confirm venue, guest count, what to cover and how to reach them.",
    link: { label: "Open Event Details", staff: `${ADMIN}?tab=Details` },
    tip: "Reuse what the inquiry and Wedding Basics already told you: anything filled in there shows in Event Details and the planning questionnaire, so don't ask the couple twice.",
    readyWhen: ["Date is open on the calendar", "Venue, guest count and coverage (ceremony, cocktail hour, reception) are confirmed", "Phone and email are on file"],
    watch: ["venue", "date", "guests"]
  },
  // 2. Pricing & Proposal
  {
    key: "proposal_scope",
    stage: 2,
    owner: "staff",
    kind: "judgment",
    title: "Confirm hours, spaces and add-ons",
    nextMove: "Settle the hours, which spaces need sound, and any add-ons. A consultation call is optional.",
    link: { label: "Open packages", staff: `${ADMIN}?tab=Details#project-packages` },
    tip: "The Wedding Basics package picks are a good start: they price in extra speakers for the guest count and ceremony sound for a separate space.",
    readyWhen: ["Hours and end time agreed", "Spaces needing sound are known", "Add-ons decided"],
    watch: ["guests", "coverage"]
  },
  {
    key: "proposal_sent",
    stage: 2,
    owner: "staff",
    kind: "objective",
    objective: (f) => f.proposalSent,
    title: "Prepare and send the proposal",
    nextMove: "Send the package to the client's portal.",
    link: { label: "Open packages", staff: `${ADMIN}?tab=Details#project-packages` },
    tip: "Completes itself once a package is in the client's portal.",
    readyWhen: ["A package is in the client's portal"]
  },
  // 3. Contract & Retainer
  {
    key: "contract_signed",
    stage: 3,
    owner: "client",
    kind: "objective",
    objective: (f) => f.contractSigned,
    title: "Sign the contract",
    nextMove: "Review and sign your contract to lock in the date.",
    link: { label: "Open contract", staff: `${ADMIN}?tab=Details#project-contracts`, client: `${PORTAL}?tab=contracts` },
    tip: "Completes itself when the contract is signed.",
    readyWhen: ["Contract signed"]
  },
  {
    key: "retainer_paid",
    stage: 3,
    owner: "client",
    kind: "objective",
    objective: (f) => f.retainerPaid,
    title: "Pay the retainer",
    nextMove: "Pay the retainer to confirm the booking.",
    link: { label: "Open payments", staff: `${ADMIN}?tab=Financials`, client: `${PORTAL}?tab=payments` },
    tip: "Completes itself when a payment is recorded.",
    readyWhen: ["Retainer payment recorded"]
  },
  {
    key: "assign_dj",
    stage: 3,
    owner: "staff",
    kind: "objective",
    objective: (f) => f.djAssigned,
    title: "Assign the DJ",
    nextMove: "Assign a DJ so the booking can be handed off.",
    link: { label: "Open Event Details", staff: `${ADMIN}?tab=Details` },
    tip: "Once the contract is signed, the retainer is in and a DJ is assigned, the DJ's planning tasks open and the couple sees their planning checklist.",
    readyWhen: ["A DJ is assigned"]
  },
  // 4. Booking Handoff & Planning
  {
    key: "dj_review_booking",
    stage: 4,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    title: "Review what was booked before contacting the couple",
    nextMove: "Read the booking: package, hours, spaces, venue, guest count and the recommended equipment.",
    link: { label: "Open the project", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Know the booking cold before the first call. If something looks off (hours too short for the timeline, a space with no sound), raise it with booking staff rather than promising the couple a change.",
    readyWhen: ["You know the package, hours and spaces", "You've checked the venue and guest count", "You've looked at the recommended equipment"],
    watch: ["venue", "date", "guests", "coverage"]
  },
  {
    key: "client_questionnaire",
    stage: 4,
    owner: "client",
    kind: "objective",
    objective: (f) => f.questionnaireDone,
    needsHandoff: true,
    title: "Complete the planning questionnaire",
    nextMove: "Tell us about your day: style, timeline, setup and must-knows.",
    link: { label: "Open questionnaire", client: "/portal/questionnaire/{id}", staff: `${ADMIN}?tab=Details#project-questionnaire` },
    tip: "Completes itself when the couple submits the questionnaire.",
    readyWhen: ["Questionnaire submitted"]
  },
  {
    key: "dj_read_questionnaire",
    stage: 4,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    blockedBy: ["client_questionnaire"],
    title: "Read the questionnaire and note the couple's priorities",
    nextMove: "Read every answer and write down their top three priorities and anything unusual.",
    link: { label: "Open answers", staff: `${ADMIN}?tab=Details#project-questionnaire`, dj: DJP },
    tip: "Couples rarely rank their priorities, so listen for repetition: if the dance floor comes up three times, that's the priority, not the cake cutting.",
    readyWhen: ["Questionnaire read end to end", "Top priorities noted", "Open questions listed for the planning call"]
  },
  {
    key: "dj_planning_call",
    stage: 4,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    title: "Planning call: priorities, decision-maker, load-in, timeline, sound, cues, weather",
    nextMove: "Walk the couple through the day and confirm who can approve changes on the day.",
    link: { label: "Open the project", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Ask: “If something changes on the day and we can't reach you, who decides?” Write that name down. Then walk the day in order: load-in, ceremony, cocktail hour, reception, last dance, and where each needs sound.",
    readyWhen: ["Priorities confirmed with the couple", "Day-of decision-maker named", "Load-in, timeline and sound spaces confirmed", "Cues and the weather backup agreed"],
    watch: ["venue", "date", "coverage"]
  },
  {
    key: "equipment_review",
    stage: 4,
    owner: "staff",
    kind: "objective",
    objective: (f) => f.equipmentConfirmed,
    title: "Review and confirm the equipment recommendations",
    nextMove: "Check the recommended gear for the guest count and spaces, adjust, and confirm the assignments.",
    link: { label: "Review equipment", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Recommendations aren't assignments until staff confirm them. Completes itself when the equipment plan is confirmed.",
    readyWhen: ["Equipment plan confirmed in Details → Equipment"]
  },
  // 5. Music & Timeline Review
  {
    key: "client_music_plan",
    stage: 5,
    owner: "client",
    kind: "objective",
    objective: (f) => f.musicPlanDone,
    needsHandoff: true,
    title: "Complete the music plan",
    nextMove: "Choose your key songs: entrances, first dance and special dances.",
    link: { label: "Open music", client: `${PORTAL}?tab=music`, staff: `${ADMIN}?tab=Details` },
    tip: "Completes itself once the couple has filled in their music plan (first dance included).",
    readyWhen: ["Music plan filled in, first dance included"]
  },
  {
    key: "dj_verify_first_dance",
    stage: 5,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    blockedBy: ["client_music_plan"],
    title: "Verify the first-dance song",
    nextMove: "Find the exact version they chose, test it, and record the start and fade cues.",
    link: { label: "Open music plan", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Couples often mean a specific version (live, acoustic, radio edit). If the length matters, ask whether they want the full song or a fade around 2:30 and agree the exact fade point.",
    readyWhen: ["The exact track is tested", "Start and fade cues are recorded", "An offline copy is on your playback device"]
  },
  {
    key: "dj_music_review",
    stage: 5,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    blockedBy: ["client_music_plan"],
    title: "Review all music and pronunciations",
    nextMove: "Check versions, cues, clean edits, must-plays, do-not-plays, requests and name pronunciations.",
    link: { label: "Open music plan", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Say every name out loud from the pronunciation notes. If one's unclear, text the couple now, not on the day.",
    readyWhen: ["Song versions and cues checked", "Clean edits ready where needed", "Must-plays and do-not-plays loaded", "Every name's pronunciation confirmed"]
  },
  {
    key: "dj_opening_set",
    stage: 5,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    title: "Prepare the opening set and alternates",
    nextMove: "Build the cocktail-hour and dinner opening set, plus alternates for the key moments.",
    link: { label: "Open the project", staff: `${ADMIN}?tab=Details`, dj: DJP },
    tip: "Have an alternate ready for every formal moment, in case the chosen file won't play.",
    readyWhen: ["Opening set built", "Alternate tracks ready for each formal moment"]
  },
  // 6. Day-Before Brief
  {
    key: "dj_day_before",
    stage: 6,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    title: "Read the day-before brief and test playback",
    nextMove: "Open the brief on your phone, test the critical tracks on the actual playback device, and check backup playback.",
    link: { label: "Open the brief", staff: `${DJP}/brief`, dj: `${DJP}/brief` },
    tip: "Test on the gear you'll use, not your laptop at home. Anything unresolved needs an owner and a deadline before tonight.",
    readyWhen: ["Brief read: arrival, contact, load-in, timeline, key tracks, pronunciations", "Critical tracks tested on the playback device", "Backup playback verified", "Every unresolved item has an owner and a deadline"],
    watch: ["venue", "date"]
  },
  // 7. Wedding Day
  {
    key: "dj_wedding_day",
    stage: 7,
    owner: "dj",
    kind: "judgment",
    needsHandoff: true,
    title: "Wedding day",
    nextMove: "Arrive, check in with the planner or venue, set up, soundcheck, run the formal cues, and wrap up.",
    link: { label: "Open the brief", staff: `${DJP}/brief`, dj: `${DJP}/brief` },
    tip: "If playback is interrupted: restore clean playback first (any song, at a sensible level), then recover the transition. The room forgives a rough mix; it doesn't forgive silence.",
    readyWhen: ["Arrived and checked in with the planner or venue", "Setup done; microphone and playback soundchecked", "Formal cues run", "Wrapped up and loaded out"]
  },
  // 8. Post-Wedding Follow-up
  {
    key: "dj_recap",
    stage: 8,
    owner: "dj",
    kind: "recap",
    needsHandoff: true,
    title: "Submit your recap",
    nextMove: "By tomorrow: what worked, one improvement, any outstanding issue, and one personal detail for the thank-you.",
    tip: "The personal detail makes the thank-you land (“the whole family on the floor for September”). Flag any issue honestly; staff will hold the review request until it's resolved.",
    readyWhen: ["What worked", "One improvement", "Any outstanding issue (or none)", "One personal detail for the thank-you"]
  },
  {
    key: "staff_thank_you",
    stage: 8,
    owner: "staff",
    kind: "outreach",
    title: "Send congratulations and thanks",
    nextMove: "Review the draft and send it through messages.",
    tip: "Use the DJ's personal detail. Short and warm beats long.",
    readyWhen: ["Sent to the couple"]
  },
  {
    key: "staff_review_request",
    stage: 8,
    owner: "staff",
    kind: "outreach",
    title: "Ask for an honest review",
    nextMove: "Review the draft and send it through messages.",
    tip: "Ask for an honest review, not a five-star one. Held while an issue from the wedding is open.",
    readyWhen: ["Sent to the couple"]
  },
  {
    key: "staff_referral",
    stage: 8,
    owner: "staff",
    kind: "outreach",
    optional: true,
    title: "Invite a referral (optional)",
    nextMove: "Review the draft and send it through messages.",
    tip: "Only if the wedding went well. Held while an issue is open.",
    readyWhen: ["Sent to the couple, or skipped"]
  }
];

export const templateByKey = (k: string | null | undefined) => TEMPLATES.find((t) => t.key === k) ?? null;

/** Issues and booking-lead requests are created on demand, not from the list. */
export const ISSUE_KEY = "resolve_issue";
export const isRequestKey = (k: string | null | undefined) => !!k && k.startsWith("request:");
export const REQUEST_KINDS = { extra_coverage: "Extra coverage", overtime: "Overtime", package_change: "Package change" } as const;

export const DEFAULT_TIMING: Record<string, { anchor: "event" | "booked"; offset: number }> = {
  inquiry_details: { anchor: "booked", offset: 1 },
  proposal_scope: { anchor: "booked", offset: 3 },
  proposal_sent: { anchor: "booked", offset: 5 },
  contract_signed: { anchor: "booked", offset: 14 },
  retainer_paid: { anchor: "booked", offset: 14 },
  assign_dj: { anchor: "booked", offset: 14 },
  dj_review_booking: { anchor: "event", offset: -75 },
  client_questionnaire: { anchor: "event", offset: -60 },
  dj_read_questionnaire: { anchor: "event", offset: -45 },
  dj_planning_call: { anchor: "event", offset: -30 },
  equipment_review: { anchor: "event", offset: -21 },
  client_music_plan: { anchor: "event", offset: -14 },
  dj_verify_first_dance: { anchor: "event", offset: -7 },
  dj_music_review: { anchor: "event", offset: -7 },
  dj_opening_set: { anchor: "event", offset: -7 },
  dj_day_before: { anchor: "event", offset: -1 },
  dj_wedding_day: { anchor: "event", offset: 0 },
  dj_recap: { anchor: "event", offset: 1 },
  staff_thank_you: { anchor: "event", offset: 2 },
  staff_review_request: { anchor: "event", offset: 4 },
  staff_referral: { anchor: "event", offset: 10 }
};

export const localDay = (iso: string, tz: string | null) => new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The date a template task is due, from its timing and the event; null if the anchor isn't known. */
export function dueFor(timing: { anchor: "event" | "booked"; offset: number }, f: Facts): string | null {
  if (timing.anchor === "booked") return addDays(localDay(f.createdAt, f.timezone), timing.offset);
  return f.startsAt ? addDays(localDay(f.startsAt, f.timezone), timing.offset) : null;
}

export const handedOff = (f: Facts) => f.contractSigned && f.retainerPaid && f.djAssigned;

export type Snapshot = Partial<Record<Watch, string | number | null>>;
export function snapshot(f: Facts, watch: Watch[]): Snapshot {
  const s: Snapshot = {};
  for (const w of watch) {
    if (w === "venue") s.venue = (f.venue ?? "").trim().toLowerCase() || null;
    if (w === "date") s.date = f.startsAt ? `${localDay(f.startsAt, f.timezone)} ${new Date(f.startsAt).toISOString().slice(11, 16)}` : null;
    if (w === "guests") s.guests = f.guests;
    if (w === "coverage") s.coverage = f.coverage ? [...f.coverage].sort().join(",") : null;
  }
  return s;
}

/** Plain-language reasons a reviewed task needs another look. */
export function changeNotes(before: Snapshot | null | undefined, f: Facts, watch: Watch[]): string[] {
  if (!before) return [];
  const now = snapshot(f, watch);
  const out: string[] = [];
  for (const w of watch) {
    if (!(w in before) || before[w] === now[w]) continue;
    if (w === "venue") out.push("Venue changed. Recheck load-in and audio setup.");
    if (w === "date") out.push("Date or time changed. Reconfirm the timeline and arrival time.");
    if (w === "guests") out.push(`Guest count changed (${before.guests ?? "—"} → ${now.guests ?? "—"}). Recheck sound coverage.`);
    if (w === "coverage") out.push("Coverage changed. Recheck the sound spaces and cues.");
  }
  return out;
}

/** Drafts for the post-wedding outreach, using the DJ's recap. */
export function draftFor(key: string, f: Facts, recap: { personal?: string } | null): { subject: string; body: string } | null {
  const hi = `Hi ${f.clientFirst ?? "there"},`;
  const dj = f.djName ?? "your DJ";
  if (key === "staff_thank_you")
    return {
      subject: "Congratulations from Digital Crate DJs!",
      body: `${hi}\n\nCongratulations again! It was an honor to be part of your wedding.${recap?.personal ? ` ${recap.personal.trim().replace(/\.?$/, ".")}` : ""}\n\nThank you for trusting ${dj} and the Digital Crate DJs team with your day.\n\nWarmly,\nDigital Crate DJs`
    };
  if (key === "staff_review_request")
    return {
      subject: "How did we do?",
      body: `${hi}\n\nNow that you've had a few days to settle in, would you share an honest review of your experience with ${dj}? It helps other couples, and it helps us keep getting better.${f.reviewUrl ? `\n\n${f.reviewUrl}` : ""}\n\nThank you!\nDigital Crate DJs`
    };
  if (key === "staff_referral")
    return {
      subject: "Know someone getting married?",
      body: `${hi}\n\nIf you know a couple planning their wedding, we'd love an introduction. We'll take great care of them, just like we did for you.\n\nThank you!\nDigital Crate DJs`
    };
  return null;
}

/** A task row as the views need it (subset of the tasks table). */
export type TaskLike = {
  id: string;
  template_key: string | null;
  stage: number | null;
  owner: Owner | null;
  title: string;
  status: "open" | "waiting" | "done";
  due_date: string | null;
  waiting_reason: string | null;
  waiting_on: Owner | null;
  review_note: string | null;
  created_at: string;
};

/** Why a task can't be done yet (computed from other tasks), or null. */
export function blockedReason(t: TaskLike, all: TaskLike[], f: Facts): { missing: string; who: Owner } | null {
  const tpl = templateByKey(t.template_key);
  if (!tpl) return null;
  if (tpl.needsHandoff && !handedOff(f)) {
    const missing = [!f.contractSigned && "signed contract", !f.retainerPaid && "retainer", !f.djAssigned && "assigned DJ"].filter(Boolean).join(", ");
    return { missing: `Waiting for the booking to be handed off: ${missing}`, who: !f.djAssigned ? "staff" : "client" };
  }
  for (const k of tpl.blockedBy ?? []) {
    const b = all.find((x) => x.template_key === k);
    if (b && b.status !== "done") return { missing: `Waiting on: ${b.title}`, who: b.owner ?? "staff" };
  }
  return null;
}

const visibleTo = (o: Owner | null, v: Viewer) => (v === "staff" ? true : v === "dj" ? o === "dj" : o === "client");

/** The one task to show at the top: the earliest-stage task this viewer can actually do now. */
export function nextUp<T extends TaskLike>(tasks: T[], f: Facts, viewer: Viewer): T | null {
  const doable = tasks.filter((t) => t.status === "open" && visibleTo(t.owner, viewer) && !blockedReason(t, tasks, f) && !(viewer === "staff" && t.owner === "client"));
  doable.sort((a, b) => (a.stage ?? 99) - (b.stage ?? 99) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.created_at.localeCompare(b.created_at));
  return doable[0] ?? null;
}
