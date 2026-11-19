/**
 * What each pipeline stage means for the booking panel: a line about where
 * things stand, what's next, and the one primary action that moves it on.
 * Actions either open the tab (and section) where the work happens, or move
 * the project to the next stage.
 */
export type StageAction = { label: string; icon: "mail" | "calendar" | "package" | "contract" | "money" | "planning" | "check" | "activity"; tab?: string; anchor?: string; moveTo?: string };
export type StageGuide = { now: string; next: string; action: StageAction | null };

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null);

export function stageGuide(
  stage: string,
  ctx: { createdAt?: string | null; signedAt?: string | null; retainerPaidAt?: string | null; startsAt?: string | null; isWedding?: boolean }
): StageGuide {
  const who = ctx.isWedding ? "the couple" : "the client";
  switch (stage) {
    case "Inquiry":
      return { now: `New inquiry${day(ctx.createdAt) ? ` received ${day(ctx.createdAt)}` : ""}.`, next: `Next: reach out to ${who} and set up a call.`, action: { label: "Email the client", icon: "mail", tab: "Activity" } };
    case "Follow-up":
      return { now: `Following up with ${who}.`, next: "Next: book a meeting to talk through the day.", action: { label: "Schedule meeting", icon: "calendar", tab: "Details", anchor: "project-meetings" } };
    case "Meeting":
      return { now: "Meeting booked or held.", next: "Next: send a proposal and contract.", action: { label: "Build proposal", icon: "package", tab: "Details", anchor: "project-packages" } };
    case "Proposal Sent":
      return { now: "Proposal sent.", next: "Next: waiting on their signature.", action: { label: "View contract", icon: "contract", tab: "Details", anchor: "project-contracts" } };
    case "Proposal Signed":
      return { now: `Proposal accepted${day(ctx.signedAt) ? ` on ${day(ctx.signedAt)}` : ""}.`, next: "Next: collect retainer to confirm booking.", action: { label: "Collect retainer", icon: "money", tab: "Financials" } };
    case "Retainer Paid":
      return { now: `Retainer received${day(ctx.retainerPaidAt) ? ` ${day(ctx.retainerPaidAt)}` : ""}. The date is booked.`, next: `Next: start planning with ${who}.`, action: { label: "Start planning", icon: "planning", moveTo: "Planning" } };
    case "Planning":
      return { now: "Planning in progress.", next: "Next: finish the questionnaire, music and timeline.", action: { label: "Open planning", icon: "planning", tab: "Details", anchor: "project-questionnaire" } };
    case "Live":
      return { now: `Event day${day(ctx.startsAt) ? `: ${day(ctx.startsAt)}` : ""}.`, next: "Next: once it's over, mark it completed.", action: { label: "Mark completed", icon: "check", moveTo: "Completed" } };
    case "Completed":
      return { now: "Event completed.", next: `Next: thank ${who} and ask for a review.`, action: { label: "Email the client", icon: "mail", tab: "Activity" } };
    case "Declined":
      return { now: "This booking was declined.", next: "Move it back to Inquiry from Pipeline Stage if it comes back.", action: null };
    case "Archived":
      return { now: "This project is archived.", next: "Move it back from Pipeline Stage to work on it again.", action: null };
    default:
      return { now: stage, next: "", action: null };
  }
}
