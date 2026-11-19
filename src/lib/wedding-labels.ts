/** Labels for the Wedding Basics choices saved on a client (contact_methods, best_days, best_times). */
const LABELS: Record<string, string> = {
  text: "Text",
  call: "Phone call",
  email: "Email",
  video: "Video call",
  in_person: "In person",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
  morning: "Mornings",
  afternoon: "Afternoons",
  evening: "Evenings"
};
export const choiceLabels = (v: string[] | null | undefined) => (v?.length ? v.map((x) => LABELS[x] ?? x).join(", ") : null);
