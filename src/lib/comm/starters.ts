// Starter designs added to the Communications Center the first time it
// opens. They are ordinary designs: edit, duplicate or delete them freely.

import { defaultBlock, type EmailBlock, type EmailDesign } from "./blocks";

function b<T extends EmailBlock["type"]>(type: T, props: Partial<Extract<EmailBlock, { type: T }>> = {}): EmailBlock {
  return { ...defaultBlock(type), ...props } as EmailBlock;
}

const SITE = "https://digitalcratedjs.com";
const SOCIAL = b("social", { website: SITE });
const FOOTER = b("footer");

export const STARTER_DESIGNS: EmailDesign[] = [
  {
    audience: "client" as const,
    name: "Welcome to Digital Crate DJs",
    subject: "Welcome to Digital Crate DJs, {{first_name}}",
    preheader: "Your event portal is ready. Here's what happens next.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "Welcome to the Crate", align: "center" }),
      b("text", {
        align: "center",
        text: "Hi {{first_name}},\n\nThank you for choosing Digital Crate DJs. We're excited to bring the music and energy to your {{event_type}}.\n\nYour client portal keeps everything in one place: your timeline, music requests, contract and payments."
      }),
      b("button", { label: "Open your portal", url: "{{portal_link}}" }),
      b("divider"),
      SOCIAL,
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Booking inquiry follow-up",
    subject: "Following up on your {{event_type}} inquiry",
    preheader: "We'd love to be part of your event.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "Let's make your event unforgettable", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nThanks again for reaching out about your {{event_type}}. We're holding time to talk through your vision, music and the details that make your day yours.\n\nPick a time that works for you, or simply reply to this email with any questions."
      }),
      b("button", { label: "Schedule a call", url: SITE + "/#booking" }),
      SOCIAL,
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Upcoming event confirmation",
    subject: "You're all set for {{event_date}}",
    preheader: "Your event details and what to expect.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "Your event is coming up", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nHere's a quick confirmation of your booking:\n\n**Date:** {{event_date}}\n**Start time:** {{event_time}}\n**Venue:** {{venue_name}}\n**Your DJ:** {{dj_name}}\n\nPlease review your timeline and music requests in your portal so we can fine-tune everything before the big day."
      }),
      b("button", { label: "Review my event", url: "{{portal_link}}" }),
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Thank you for booking",
    subject: "Thank you for booking Digital Crate DJs",
    preheader: "Your date is officially on our calendar.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "Your date is locked in", align: "center" }),
      b("text", {
        align: "center",
        text: "Hi {{first_name}},\n\nThank you for booking with us. {{event_date}} is officially on our calendar, and {{dj_name}} can't wait to celebrate with you."
      }),
      b("button", { label: "View booking", url: "{{portal_link}}" }),
      SOCIAL,
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Review request",
    subject: "How was your {{event_type}}, {{first_name}}?",
    preheader: "Your feedback means the world to our team.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "Thank you for celebrating with us", align: "center" }),
      b("text", {
        align: "center",
        text: "Hi {{first_name}},\n\nIt was an honor to be part of your {{event_type}}. If you have a minute, a quick review helps other couples and hosts find us, and it means a lot to {{dj_name}} and the whole team."
      }),
      b("button", { label: "Leave a review", url: "{{review_link}}" }),
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Wedding planning check-in",
    subject: "Planning check-in for {{event_date}}",
    preheader: "A few quick things to finish in your portal.",
    theme: "light",
    blocks: [
      b("logo"),
      b("heading", { text: "Let's check in on your plans", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nYour wedding is getting closer! When you have a moment, please:\n\n- Finish your planning questionnaire\n- Add your must-play and do-not-play songs\n- Confirm your timeline for introductions, first dance and toasts\n\nEverything saves automatically in your portal."
      }),
      b("button", { label: "Continue planning", url: "{{portal_link}}" }),
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Announcement",
    subject: "News from Digital Crate DJs",
    preheader: "",
    theme: "light",
    blocks: [
      b("logo"),
      b("image", { url: "", alt: "Digital Crate DJs", width: "full" }),
      b("heading", { text: "Something new from the Crate", align: "center" }),
      b("text", { align: "center", text: "Hi {{first_name}},\n\nShare your announcement here." }),
      b("button", { label: "Learn more", url: SITE }),
      SOCIAL,
      FOOTER
    ]
  },
  ...DJ_TEAM_STARTERS()
];

/* ---------- DJ team (links into the members area at digitalcratedjs.com/members) ---------- */

function DJ_TEAM_STARTERS(): EmailDesign[] {
  const MEMBERS = "{{members_link}}";
  const dj = (name: string, subject: string, preheader: string, blocks: EmailBlock[], theme: "dark" | "light" = "dark"): EmailDesign => ({
    audience: "dj",
    name,
    subject,
    preheader,
    theme,
    blocks: [b("logo"), ...blocks, b("footer", { text: "Digital Crate DJs · DJ Team\nQuestions? Reply to this email or message management." })]
  });
  return [
    dj("DJ: Submit your availability", "Availability is open: submit your dates, {{dj_name}}", "Next month's schedule is being built now.", [
      b("heading", { text: "Availability is open", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nWe're building next month's schedule. Please mark your dates in the members area as **Available**, **Limited** or **Unavailable** so we can line up gigs.\n\nThe sooner you submit, the better your shot at the dates you want."
      }),
      b("button", { label: "Submit availability", url: MEMBERS + "#availability" })
    ]),
    dj("DJ: Availability reminder", "Reminder: we still need your availability", "Takes about a minute in the members area.", [
      b("heading", { text: "Quick reminder", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nWe haven't received your availability for next month yet. Please submit it so we don't schedule around you.\n\nIf your plans are still up in the air, mark the dates you're unsure about as **Limited**."
      }),
      b("button", { label: "Submit availability", url: MEMBERS + "#availability" })
    ]),
    dj("DJ: New gig assignment", "New gig: {{event_type}} on {{event_date}}", "You've been booked. Details inside.", [
      b("heading", { text: "You've got a new gig", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nYou've been assigned to a new booking:\n\n**Event:** {{event_type}}\n**Date:** {{event_date}}\n**Start time:** {{event_time}}\n**Venue:** {{venue_name}}\n\nFull details, including load-in time, are in the members area. If anything conflicts, let management know right away."
      }),
      b("button", { label: "View gig details", url: MEMBERS })
    ]),
    dj("DJ: Upcoming gig reminder", "This week: {{event_type}} at {{venue_name}}", "A quick check before your gig.", [
      b("heading", { text: "Your gig is coming up", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nA reminder that you're playing:\n\n**{{event_type}}** · {{event_date}} at {{event_time}}\n**Venue:** {{venue_name}}\n\nBefore the night:\n- Review the event details and any client requests\n- Confirm your gear and backup plan\n- Arrive at the load-in time management gave you\n\nAny questions about the gig go to management, not the venue."
      }),
      b("button", { label: "Open members area", url: MEMBERS })
    ]),
    dj("DJ: Holiday scheduling priority", "Big bar holidays: submit your availability first", "Regular venues are covered first on the biggest nights.", [
      b("heading", { text: "Holiday scheduling is open", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nThe big bar holidays are coming up, and our regular venues are counting on the team. Please mark your availability for these nights in the members area before accepting any outside gigs.\n\nOnce the regular venues are covered, management will release anyone who isn't needed."
      }),
      b("button", { label: "Mark holiday availability", url: MEMBERS + "#availability" })
    ]),
    dj("DJ: Academy training reminder", "Finish your DCDJs Academy certification", "Stay eligible for new bookings.", [
      b("heading", { text: "DCDJs Academy", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nThis is a reminder to finish your DCDJs Academy training. It covers holiday availability, business communication, venue relationships and professional standards, followed by a short final assessment.\n\nYour progress saves as you go, so you can pick up right where you left off."
      }),
      b("button", { label: "Continue training", url: MEMBERS + "#academy" })
    ]),
    dj("DJ: Team meeting", "Team meeting: [date] at [time]", "Mark your calendar.", [
      b("heading", { text: "Team meeting", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nWe're getting the team together:\n\n**When:** [date and time]\n**Where:** [location or video link]\n\n**What we'll cover:**\n- [topic]\n- [topic]\n\nPlease reply to let us know you can make it."
      }),
      b("button", { label: "Add details in the members area", url: MEMBERS })
    ]),
    dj("DJ: Company announcement", "Important update from Digital Crate DJs", "Please read: this affects the whole team.", [
      b("heading", { text: "Important team update", align: "center" }),
      b("text", { text: "Hi {{dj_name}},\n\n[Write the update here.]\n\nIf this changes any policy, you'll see it in the DCDJs Academy to review and acknowledge." }),
      b("button", { label: "Open members area", url: MEMBERS })
    ]),
    dj("DJ: Welcome to the members area", "Welcome to the DCDJs members area, {{dj_name}}", "Your schedule, gigs, training and music pool in one place.", [
      b("heading", { text: "Welcome to the team", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nThe members area is your home base at Digital Crate DJs:\n\n- Submit your monthly availability\n- See your gigs and assignments\n- Complete DCDJs Academy training\n- Use the music pool and Crate Builder\n\nSign in with the email address this message was sent to."
      }),
      b("button", { label: "Sign in", url: MEMBERS })
    ]),
    dj("DJ: Update your profile", "Please update your DJ profile", "Your bio and photos help us book you.", [
      b("heading", { text: "Keep your profile fresh", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nVenues and clients see your profile when we book you. Please make sure your bio, photos, genres and the events you play are up to date in the members area.\n\nIf management asked you for anything else (like updated payment details), please send it over too."
      }),
      b("button", { label: "Update my profile", url: MEMBERS + "#bio" })
    ])
  ];
}
