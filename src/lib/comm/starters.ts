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
    name: "Contract signature reminder",
    subject: "Your contract is ready to sign, {{first_name}}",
    preheader: "Signing locks in {{event_date}} on our calendar.",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "One quick signature", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nYour Digital Crate DJs contract for your {{event_type}} on **{{event_date}}** is ready. Signing takes about a minute in your portal and officially reserves your date and DJ.\n\nUntil it's signed, the date isn't fully held, so please take a look when you can."
      }),
      b("button", { label: "Review and sign", url: "{{portal_link}}" }),
      b("text", { align: "center", text: "Questions about anything in the contract? Just reply to this email." }),
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Invoice payment reminder",
    subject: "Payment reminder for your {{event_type}}",
    preheader: "Balance due: {{balance_due}}",
    theme: "dark",
    blocks: [
      b("logo"),
      b("heading", { text: "A friendly payment reminder", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nThis is a friendly reminder about the balance for your {{event_type}} on **{{event_date}}**.\n\n**Balance due:** {{balance_due}}\n\nYou can pay securely by card in your portal, and you'll see every payment you've made there too."
      }),
      b("button", { label: "Make a payment", url: "{{portal_link}}" }),
      b("text", { align: "center", text: "Already paid? Thank you! Payments can take a day to show. Reply with any questions." }),
      FOOTER
    ]
  },
  {
    audience: "client" as const,
    name: "Event questionnaire reminder",
    subject: "A few questions about your {{event_type}}",
    preheader: "Help {{dj_name}} plan the perfect night.",
    theme: "light",
    blocks: [
      b("logo"),
      b("heading", { text: "Tell us about your event", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nTo plan the music and timeline for **{{event_date}}**, {{dj_name}} needs a few details from you:\n\n- Your event timeline and key moments\n- Must-play and do-not-play songs\n- Names for introductions and announcements\n- Anything special about your venue or crowd\n\nYour answers save as you go, so you can finish it in more than one sitting."
      }),
      b("button", { label: "Complete the questionnaire", url: "{{portal_link}}" }),
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
  ...DJ_TEAM_STARTERS(),
  ...VENUE_STARTERS(),
  ...PERSONAL_STARTERS()
];

/* ---------- DJ team (links into the members area at digitalcratedjs.com/members) ---------- */

function DJ_TEAM_STARTERS(): EmailDesign[] {
  const MEMBERS = "{{members_link}}";
  const DJ_REGISTER = SITE + "/dj-register";
  const LOST_PASSWORD = SITE + "/wp-login.php?action=lostpassword";
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
    dj("DJ: Members area sign-in reminder", "Reminder: sign in to the DCDJs members area", "Your schedule, gigs and training are waiting.", [
      b("heading", { text: "Don't forget to sign in", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nWe noticed you haven't been in the members area lately. That's where you submit availability, see your gigs and complete DCDJs Academy training, so please sign in and make sure everything's up to date.\n\n**Your username** is your DJ name. You can also sign in with your email address."
      }),
      b("button", { label: "Sign in", url: MEMBERS }),
      b("text", {
        align: "center",
        text: "Forgot your password? [Reset it here](" + LOST_PASSWORD + ") and we'll email you a link."
      })
    ]),
    dj("DJ: Booking confirmed", "Confirmed: {{event_type}} on {{event_date}}", "You're locked in. Here are the details.", [
      b("heading", { text: "You're confirmed", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nThis booking is confirmed:\n\n**Event:** {{event_type}}\n**Date:** {{event_date}}\n**Start time:** {{event_time}}\n**Venue:** {{venue_name}}\n\nYour arrival and setup details come from DCDJs management, not the venue. If anything changes on your end, tell management right away."
      }),
      b("button", { label: "View in the members area", url: MEMBERS }),
      b("text", { align: "center", text: "Thanks for representing Digital Crate DJs." })
    ]),
    dj("DJ: Missing required documents", "Action needed: documents missing from your file", "Please send these so we can keep booking you.", [
      b("heading", { text: "We're missing a few documents", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nYour file is missing the following:\n\n- [DOCUMENT 1]\n- [DOCUMENT 2]\n\nPlease send them by **[DATE]**. We can't assign new gigs until your file is complete.\n\nReply to this email with the documents attached, or upload them where management asked."
      }),
      b("button", { label: "Open the members area", url: MEMBERS })
    ]),
    dj("DJ: Create your members account", "Set up your Digital Crate DJs members account", "Your invite code and three quick steps to get in.", [
      b("heading", { text: "Your members account is ready to set up", size: "md", align: "center" }),
      b("text", {
        text: "Hi there,\n\nYou're all set to join the Digital Crate DJs members area, your home base for submitting availability, seeing your gigs, completing DCDJs Academy training and using the music pool.\n\n**Your invite code: [INVITE CODE]**\n(One-time use, just for you.)\n\n- Click **Create my account** below\n- Enter your DJ name, real name and this email address\n- Create a password and enter your invite code"
      }),
      b("button", { label: "Create my account", url: DJ_REGISTER }),
      b("text", {
        text: "**Your username** is the DJ name you enter when you sign up (accents are dropped, so DJ Omertà becomes DJ Omerta). You can also sign in with your email address.\n\nOnce management approves your account, sign in any time at [digitalcratedjs.com/members](" + SITE + "/members/)."
      }),
      b("divider"),
      b("text", {
        align: "center",
        text: "Forgot your password later? Click **Forgot your password?** on the sign-in page, or [reset it here](" + LOST_PASSWORD + ") and we'll email you a link to set a new one."
      })
    ]),
    dj("DJ: Welcome to the members area", "Welcome to the DCDJs members area, {{dj_name}}", "Your schedule, gigs, training and music pool in one place.", [
      b("heading", { text: "Welcome to the team", align: "center" }),
      b("text", {
        text: "Hi {{dj_name}},\n\nThe members area is your home base at Digital Crate DJs:\n\n- Submit your monthly availability\n- See your gigs and assignments\n- Complete DCDJs Academy training\n- Use the music pool and Crate Builder"
      }),
      b("heading", { text: "New to the members area?", size: "md", align: "center" }),
      b("text", {
        align: "center",
        text: "Create your account with the one-time invite code from management: **[CODE]**"
      }),
      b("button", { label: "Create my account", url: DJ_REGISTER }),
      b("divider"),
      b("heading", { text: "Already have an account?", size: "md", align: "center" }),
      b("button", { label: "Sign in", url: MEMBERS }),
      b("text", {
        align: "center",
        text: "Can't remember your password? [Reset it here](" + LOST_PASSWORD + ") and we'll email you a link to set a new one."
      })
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

/* ---------- Venue partners (venue managers; light style per the brand guide) ---------- */

function VENUE_STARTERS(): EmailDesign[] {
  const PORTAL = "{{venue_portal_link}}";
  const venue = (name: string, subject: string, preheader: string, blocks: EmailBlock[], theme: "dark" | "light" = "light"): EmailDesign => ({
    audience: "venue",
    name,
    subject,
    preheader,
    theme,
    blocks: [
      b("logo"),
      ...blocks,
      b("footer", { text: "Digital Crate DJs · Venue Partner Program\nQuestions? Reply to this email or reach out to {{dcdjs_contact}}." })
    ]
  });
  return [
    venue("Venue: Welcome to the Venue Portal", "Welcome to the Digital Crate DJs Venue Portal", "Your schedule, DJs and holiday planning in one place.", [
      b("heading", { text: "Welcome, {{venue_name}}", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nYour Venue Partner Portal is ready. It's your home base for entertainment at {{venue_name}}:\n\n- See upcoming nights and which DJ is playing\n- Your monthly calendar, with holidays marked\n- Your DJ lineup\n- Holiday planning, so the big nights are covered early\n\nYou'll get a separate link to set your password the first time."
      }),
      b("button", { label: "Open the Venue Portal", url: PORTAL }),
      b("text", { align: "center", text: "Your DCDJs contact is {{dcdjs_contact}}." })
    ], "dark"),
    venue("Venue: Monthly entertainment schedule", "Your [MONTH] entertainment schedule for {{venue_name}}", "Every date and DJ for the month.", [
      b("heading", { text: "Your [MONTH] schedule is ready", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nHere's entertainment at {{venue_name}} for [MONTH]:\n\n- [DATE] · [DJ NAME] · [TIME]\n- [DATE] · [DJ NAME] · [TIME]\n- [DATE] · [DJ NAME] · [TIME]\n\nThe full schedule is always up to date in your portal."
      }),
      b("button", { label: "View the full schedule", url: PORTAL })
    ]),
    venue("Venue: DJ assignment confirmation", "Confirmed: [DJ NAME] at {{venue_name}} on [DATE]", "Your DJ is locked in.", [
      b("heading", { text: "Your DJ is confirmed", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nWe've confirmed entertainment at {{venue_name}}:\n\n**Date:** [DATE]\n**DJ:** [DJ NAME]\n**Time:** [START] – [END]\n\nIf anything changes on your side, let us know as early as you can."
      }),
      b("button", { label: "View in your portal", url: PORTAL })
    ]),
    venue("Venue: Schedule approval request", "Please review the [MONTH] schedule for {{venue_name}}", "A quick look and confirmation, please.", [
      b("heading", { text: "Please review your schedule", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nThe [MONTH] entertainment schedule for {{venue_name}} is ready for your review. Please look it over and confirm by **[DATE]** so we can lock in your DJs.\n\nNeed a change? Reply to this email and we'll work it out."
      }),
      b("button", { label: "Review the schedule", url: PORTAL })
    ]),
    venue("Venue: Upcoming weekend entertainment", "This weekend at {{venue_name}}", "Who's playing and when.", [
      b("heading", { text: "This weekend's lineup", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nHere's who's spinning at {{venue_name}} this weekend:\n\n**Friday [DATE]:** [DJ NAME], [TIME]\n**Saturday [DATE]:** [DJ NAME], [TIME]\n\nFeel free to share it on your socials. We'll be ready to bring the energy."
      }),
      b("button", { label: "Open your portal", url: PORTAL })
    ], "dark"),
    venue("Venue: Schedule change notification", "Schedule update for {{venue_name}}", "A change to your entertainment schedule.", [
      b("heading", { text: "Schedule update", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nThere's a change to your entertainment schedule:\n\n**What changed:** [DETAILS]\n**Date:** [DATE]\n**Now:** [NEW DJ / NEW TIME]\n\nYour portal already shows the update. Sorry for any inconvenience, and thanks for your flexibility."
      }),
      b("button", { label: "View the updated schedule", url: PORTAL })
    ]),
    venue("Venue: Monthly performance summary", "[MONTH] recap for {{venue_name}}", "Your entertainment month at a glance.", [
      b("heading", { text: "Your [MONTH] recap", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nHere's how [MONTH] went at {{venue_name}}:\n\n- **Entertainment nights:** [NUMBER]\n- **DJs featured:** [NAMES]\n- **Highlights:** [HIGHLIGHTS]\n\nLooking ahead: [NEXT MONTH NOTES]\n\nThank you for partnering with Digital Crate DJs."
      }),
      b("button", { label: "Open your portal", url: PORTAL })
    ]),
    venue("Venue: Manager follow-up", "Checking in, {{first_name}}", "How's entertainment going at {{venue_name}}?", [
      b("heading", { text: "Just checking in", size: "md", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nI wanted to check in and see how things are going with entertainment at {{venue_name}}. Is the music landing with your crowd? Anything you'd like us to adjust, like genres, volume or timing?\n\nJust reply to this email. We're always happy to fine-tune."
      }),
      b("button", { label: "Open your portal", url: PORTAL, style: "outline" })
    ]),
    venue("Venue: Special event planning", "Let's plan your big nights at {{venue_name}}", "Holidays book up first. Let's get yours on the calendar.", [
      b("heading", { text: "Plan your big nights early", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nThe biggest nights of the year book up first: Halloween, Thanksgiving Eve, New Year's Eve, St. Patrick's Day and the summer holiday weekends.\n\nComing up: **[EVENT]** on **[DATE]**. If you'd like entertainment at {{venue_name}}, let us know by **[DEADLINE]** so we can save your night."
      }),
      b("button", { label: "See holidays in your portal", url: PORTAL })
    ], "dark"),
    venue("Venue: Feedback request", "How are we doing, {{first_name}}?", "Two minutes of feedback helps us serve {{venue_name}} better.", [
      b("heading", { text: "We'd love your feedback", align: "center" }),
      b("text", {
        text: "Hi {{first_name}},\n\nYour feedback helps us bring the right DJs and the right energy to {{venue_name}}. Just reply to this email with a few quick thoughts:\n\n- What's working well?\n- Which DJs does your crowd love?\n- Anything we should change?\n\nThank you for being a Digital Crate DJs partner."
      }),
      b("button", { label: "Open your portal", url: PORTAL, style: "outline" })
    ])
  ];
}

/* ---------- Personal (owner's own emails; typed addresses only, never linked to CRM records) ---------- */

function PERSONAL_STARTERS(): EmailDesign[] {
  const personal = (name: string, subject: string, preheader: string, blocks: EmailBlock[], theme: "dark" | "light" = "light"): EmailDesign => ({
    audience: "personal",
    name,
    subject,
    preheader,
    theme,
    blocks: [b("logo"), ...blocks, b("footer", { text: "[YOUR NAME]\nDigital Crate DJs" })]
  });
  return [
    personal("Personal: Professional announcement", "[ANNOUNCEMENT TITLE]", "", [
      b("heading", { text: "[ANNOUNCEMENT TITLE]", align: "center" }),
      b("text", { text: "Hi [NAME],\n\nI'm excited to share some news: [YOUR ANNOUNCEMENT].\n\n[MORE DETAILS]\n\nThank you for your support." }),
      b("button", { label: "Learn more", url: SITE })
    ], "dark"),
    personal("Personal: Invitation", "You're invited: [EVENT NAME]", "[DATE] · [PLACE]", [
      b("heading", { text: "You're invited", align: "center" }),
      b("text", {
        align: "center",
        text: "Hi [NAME],\n\nI'd love for you to join me for **[EVENT NAME]**.\n\n**When:** [DATE] at [TIME]\n**Where:** [PLACE]\n\nPlease reply by [RSVP DATE] to let me know if you can make it."
      })
    ], "dark"),
    personal("Personal: Thank you", "Thank you, [NAME]", "", [
      b("heading", { text: "Thank you", align: "center" }),
      b("text", { align: "center", text: "Hi [NAME],\n\nI just wanted to say thank you for [WHAT YOU'RE THANKING THEM FOR]. It truly means a lot.\n\n[PERSONAL NOTE]" })
    ]),
    personal("Personal: Business proposal", "Proposal: [PROJECT NAME]", "An idea I'd love to talk through with you.", [
      b("heading", { text: "[PROJECT NAME]", size: "md", align: "center" }),
      b("text", {
        text: "Hi [NAME],\n\nThanks for taking the time to talk. Here's a quick summary of what I'm proposing:\n\n**The idea:** [SUMMARY]\n**What's included:** [DETAILS]\n**Investment:** [PRICE]\n**Timeline:** [DATES]\n\nI'd love to set up a quick call to walk through it. Just reply with a time that works."
      })
    ]),
    personal("Personal: Holiday greeting", "Happy holidays from Digital Crate DJs", "Wishing you a great season.", [
      b("image", { url: "", alt: "Happy holidays", width: "full" }),
      b("heading", { text: "Happy holidays", align: "center" }),
      b("text", {
        align: "center",
        text: "Hi [NAME],\n\nWishing you and yours a joyful holiday season and a great new year. Thank you for being part of our story this year.\n\nHere's to more great music and memories together."
      })
    ], "dark"),
    personal("Personal: Personal note", "[SUBJECT]", "", [b("text", { text: "Hi [NAME],\n\n[YOUR MESSAGE]" })])
  ];
}
