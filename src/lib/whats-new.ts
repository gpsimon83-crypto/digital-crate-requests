// "What's New" — every update to the CRM (cratesdjs.com) and the DJ
// members area (digitalcratedjs.com), newest first. Add new entries to
// the TOP of this list; the admin menu badge counts entries the viewer
// hasn't opened the What's New page since.

export type UpdateArea = "CRM" | "Members area";

export interface UpdateEntry {
  id: string; // unique, never reused
  date: string; // YYYY-MM-DD
  area: UpdateArea;
  title: string;
  summary: string;
  bullets?: string[];
  link?: { href: string; label: string; external?: boolean };
  /** Something someone still has to do for this to fully work. */
  action?: string;
}

export const UPDATES: UpdateEntry[] = [
  {
    id: "2026-11-11-inquiry-security",
    date: "2026-11-11",
    area: "CRM",
    title: "Inquiry Security: confirmed requests, spam protection and two-factor",
    summary: "Website booking requests now become leads only after the client confirms their email, and a new Inquiry Security page shows anything flagged, blocked or waiting.",
    bullets: [
      "Find it at Admin → Inquiry Security (owners and admins)",
      "Booking and consultation forms have a Cloudflare spam check, a hidden bot trap and limits on repeated submissions",
      "Clients get a confirmation email; nothing is reserved, texted or emailed to staff until they click it. Links work once and expire after 24 hours",
      "Unusual requests wait in Needs review with plain-English reasons. Approve, mark spam, restore, resend or temporarily block, and every decision is recorded",
      "Past event dates can't be submitted on any public form (Chicago time). Today is allowed",
      "Bookings can't be confirmed twice or double-book a DJ, and Stripe payments only count when Stripe signs them",
      "Client files open through short-lived private links, only for the client, their DJ and staff",
      "Two-factor sign-in for staff at Admin → Inquiry Security → Two-factor"
    ],
    link: { href: "/admin/security", label: "Open Inquiry Security" },
    action: "Each owner and admin: set up two-factor (Admin → Inquiry Security → Two-factor). Add the WordPress partner key to wp-config.php so website forms reach the CRM."
  },
  {
    id: "2026-11-11-social-presence",
    date: "2026-11-11",
    area: "Members area",
    title: "Social Presence & My Social Coach (DCDJs Academy)",
    summary: "A new Academy course that gives each DJ a weekly social media plan. A reviewer approves their posts and points follow.",
    bullets: [
      "Find it at Members → DCDJs Academy → Social Presence, and on a new Dashboard slide with a Walkthrough button",
      "Six shared lessons, then three tracks: Stay Connected, Build Your Presence and Stay in the Spotlight, each with four weekly lessons and one-question checks",
      "My Week lists the exact posts, Story days and engagement sessions, with due times in each DJ's timezone",
      "Confirmed bookings an admin marks public become invite, day-of and recap tasks that replace planned posts; private gigs never appear",
      "DJs submit a post link, a screenshot (stored privately) or a short engagement log",
      "Reviewers approve, send back with exactly what to fix, or excuse. Points are added once per approval, and badges come at 50, 150 and 300 points and after four complete weeks",
      "My Social Coach gives caption options, a draft check, shot lists and no-gig ideas (template help, not live AI)",
      "Admin settings in wp-admin → DCDJs Academy → Social Presence"
    ],
    link: { href: "https://digitalcratedjs.com/members/?dctour=social-presence", label: "Start the walkthrough", external: true },
    action: "Grant Orlando reviewer access, mark which bookings are public, approve venue tags and add the DCDJs Instagram tag in wp-admin → DCDJs Academy → Social Presence."
  },
  {
    id: "2026-11-10-academy-pictures",
    date: "2026-11-10",
    area: "Members area",
    title: "DCDJs Academy pictures",
    summary: "Every part of the Academy page now has its own picture, matched by name.",
    bullets: [
      "Training and Assignments tabs are picture tiles",
      "Welcome banner and certificate card have their own backgrounds",
      "Status cards: certification, deadline, best test score, acknowledgments due, booking eligibility",
      "Each module card gets its picture by title (holiday, communication, venue relationships, point person, professional standards), so reordering modules keeps them matched",
      "Final Certification Assessment has its own picture"
    ],
    link: { href: "https://digitalcratedjs.com/members/#academy", label: "Open the Academy", external: true }
  },
  {
    id: "2026-11-10-members-backdrops",
    date: "2026-11-10",
    area: "Members area",
    title: "Dark blurred-cover look on every members page",
    summary: "Every members tab now matches the Music Pool: dark, with a Crate Challenge cover blurred behind it.",
    bullets: [
      "Dashboard: EDM Anthems · Academy: Late Night Lounge · Venue Curator: Crate Picks",
      "Team Bucket: East Coast Classics · Events: Wedding Party · Announcements: New Year Countdown",
      "Availability: Holiday Party · My Bio: West Coast Cruise",
      "Cards, forms and the Events activity charts switched to dark so all text stays readable",
      "Dashboard stat cards have their own photos: stage lights (Upcoming Events), calendar (Events This Month), road case (Open Assignments), folio (Documents)"
    ],
    link: { href: "https://digitalcratedjs.com/members/", label: "Open the members area", external: true }
  },
  {
    id: "2026-11-10-members-tabs-trim",
    date: "2026-11-10",
    area: "Members area",
    title: "My Library and Crate Builder tabs removed",
    summary: "Two tabs that repeated other parts of the members area are gone, so the menu is shorter.",
    bullets: [
      "My Library: each DJ's uploads are now their own Exclusive Crate in the Music Pool (marked You)",
      "Crate Builder: the menu link is removed; the tool itself still runs at requests.digitalcratedjs.com/dj-dashboard/library"
    ]
  },
  {
    id: "2026-11-10-music-pool-crates",
    date: "2026-11-10",
    area: "Members area",
    title: "Music Pool redesign: DJ Exclusive Crates",
    summary: "A modern player-style Music Pool: the crate cover blurred across the background, a big header for the crate, and a clean track list.",
    bullets: [
      "Every DJ's uploads are their own Exclusive Crate with their crate photo (Scary Terry, Aran Arms, DJ Que, J Prime, CrateClubP, Grand Master O); others get a gold name crate",
      "Click a crate: the header, cover and blurred background switch to that DJ and the list shows only their tracks",
      "Crates ranked by downloads with 🥇🥈🥉 badges, replacing the old DJ Rankings strip",
      "Clean track list: play button, title with version, artist, DJ, BPM, color-coded Camelot key, downloads",
      "Download, rate, edit and comments are icon buttons; Play all starts the list",
      "The big upload box is tucked behind an Upload tracks button"
    ],
    link: { href: "https://digitalcratedjs.com/members/", label: "Open the members area", external: true }
  },
  {
    id: "2026-11-10-dashboard-slides",
    date: "2026-11-10",
    area: "Members area",
    title: "Members Dashboard highlights slider",
    summary: "A rotating banner under the welcome photo on the members Dashboard with three slides: the Crate Challenge, the DCDJs Academy and next month's availability.",
    bullets: [
      "Crate Challenge: crates open and the next drop, with Walkthrough and Open buttons (DJs see it after launch)",
      "DCDJs Academy: each DJ's own progress, from Start the Academy to Certified",
      "Availability: whether the DJ has sent next month yet and that month's big nights; admins see how many DJs have sent it",
      "Changes slide every 8 seconds, pauses on hover, swipes on phones, with dots and arrows"
    ],
    link: { href: "https://digitalcratedjs.com/members/", label: "Open the members Dashboard", external: true }
  },
  {
    id: "2026-11-10-crate-challenge",
    date: "2026-11-10",
    area: "Members area",
    title: "The Crate Challenge",
    summary: "A members game inside Venue Curator: 40 themed crates with their own covers that unlock a few at a time, and DJs fill them with songs from the Music Pool.",
    bullets: [
      "Find it at Members → Venue Curator → Crate Challenge",
      "Starts with 4 crates open, then 2 more every Monday (you can change this)",
      "Each crate fills to 25 songs, up to 10 per DJ, with a Complete ribbon when full",
      "Leaderboards for the whole challenge and for each crate",
      "Admins can open a crate early, hold one back, or edit it from its ⋯ menu",
      "Promo banner on the members Dashboard under the welcome photo, with crates open, the next drop, Walkthrough and Open buttons",
      "Launching can also post the promo announcement on the members Dashboard",
      "Venue Curator now uses the dark gold look from the challenge banner"
    ],
    link: { href: "https://digitalcratedjs.com/members/#curator/crates", label: "Open the Crate Challenge", external: true },
    action: "DJs can't see it until you launch it: Venue Curator → Crate Challenge → Launch the Crate Challenge."
  },
  {
    id: "2026-11-10-venue-curator-library",
    date: "2026-11-10",
    area: "Members area",
    title: "Venue Curator music library redesign",
    summary: "Venue playlists are now DCDJs Music Collections: a cover grid with categories, search and a full track table for each collection.",
    bullets: [
      "Collections by venue and category (Essentials, Friday Nights, Hip-Hop and more) with cover photos you can crop",
      "Search, venue filter, sort order and archived collections",
      "Track table with clean/dirty and genre filters; move, copy or remove tracks",
      "Build from recommendations and download any list as a spreadsheet",
      "Existing venue playlists moved over automatically and stay in sync",
      "The Curated Tracks Archive still saves every list each quarter"
    ],
    link: { href: "https://digitalcratedjs.com/members/#curator", label: "Open Venue Curator", external: true }
  },
  {
    id: "2026-11-09-template-library",
    date: "2026-11-09",
    area: "CRM",
    title: "Template Library complete (Communications Phase 4)",
    summary: "40 ready-made emails across four audiences: Clients, DJ team, Venue partners and Personal.",
    bullets: [
      "Clients (10): added contract signature, invoice payment (shows the balance due) and questionnaire reminders",
      "DJ team (14): added members-area sign-in reminder, booking confirmed and missing documents",
      "Venue partners (10): welcome, monthly schedule, DJ confirmation, schedule approval, weekend lineup, schedule change, monthly recap, follow-up, special event planning, feedback",
      "Venue emails go to venue managers and fill in their venue name, portal link and DCDJs contact",
      "Personal (6): announcement, invitation, thank you, proposal, holiday greeting, personal note. They go only to addresses you type and never link to client, DJ or venue records",
      "Fill-ins like [DATE] or [DJ NAME] are flagged before sending so they never go out by mistake"
    ],
    link: { href: "/admin/communications?tab=templates", label: "Open Templates" }
  },
  {
    id: "2026-11-06-whats-new",
    date: "2026-11-06",
    area: "CRM",
    title: "What's New with visual walkthroughs",
    summary: "Every update to the CRM and the members area in one place, with a badge in the menu when something is new.",
    bullets: [
      "Click any update to open its own page with the full details",
      "Updates marked Walkthrough have a Start walkthrough button",
      "The walkthrough takes you to the real screen and highlights each part step by step, with Next and Back",
      "You can keep clicking around the page while a walkthrough is open; press Esc or × to end it"
    ]
  },
  {
    id: "2026-11-06-client-portal-preview",
    date: "2026-11-06",
    area: "CRM",
    title: "View the client portal as admin",
    summary: "Every project now has a View client portal button at the top right. It opens the client's portal exactly as they see it.",
    bullets: [
      "A blue Admin preview bar shows you're looking as staff",
      "Signing, paying and editing only work from the client's own login, so nothing happens by accident"
    ],
    link: { href: "/admin/events", label: "Open Projects" }
  },
  {
    id: "2026-11-06-venue-portal-a",
    date: "2026-11-06",
    area: "CRM",
    title: "Venue Partner Portal (Phase A)",
    summary: "Venues like Casey Keys, North 48 and Lake County can get their own login at cratesdjs.com/venue.",
    bullets: [
      "Admin → Venues: portal on/off, managers, and a Manage page for each venue",
      "Cover photo and logo upload with separate desktop and phone crops",
      "Regular entertainment nights, scheduling notes and your DCDJs contact person",
      "Add a manager to get a one-time setup link you send yourself (nothing emails automatically)",
      "Preview as venue to see exactly what they see",
      "Venue dashboard: upcoming events, calendar with holidays, DJ lineup, holiday planning",
      "Each venue only ever sees its own information, never client names or money"
    ],
    link: { href: "/admin/venues", label: "Open Venues" },
    action: "Coming next (Phase B): bar nights and DJ assignments from the members-area schedule, and venue requests."
  },
  {
    id: "2026-11-04-dj-register-template",
    date: "2026-11-04",
    area: "CRM",
    title: "DJ template: Create your members account",
    summary: "A ready-made email for DJs who haven't registered yet: invite code, Create my account button, how usernames work, sign-in and password-reset links.",
    link: { href: "/admin/communications", label: "Open Communications" },
    action: "Invite codes are one-time use: replace [INVITE CODE] and send to one DJ at a time."
  },
  {
    id: "2026-11-04-dj-templates",
    date: "2026-11-04",
    area: "CRM",
    title: "DJ team email templates",
    summary: "The Communications Center can now email the DJ team, not just clients.",
    bullets: [
      "Templates are for Clients or DJ team; filter them on the Templates tab",
      "Starter emails: availability request and reminder, new gig, gig reminder, holiday priority, Academy reminder, team meeting, announcement, members welcome, profile update",
      "New {{members_link}} field links straight into the members area",
      "Sending to DJs fills in each DJ's name and next gig"
    ],
    link: { href: "/admin/communications", label: "Open Communications" }
  },
  {
    id: "2026-11-04-comm-center",
    date: "2026-11-04",
    area: "CRM",
    title: "Communications Center",
    summary: "The main way to send branded graphic emails to clients, with buttons, pictures and links.",
    bullets: [
      "Email Studio: drag-and-drop blocks, live preview, light or dark style",
      "Personalized fields like first name, event date, venue and DJ",
      "Send a test to yourself before sending for real",
      "Sent tab tracks delivered, opened, clicked and bounced",
      "Bounced and spam-flagged addresses are skipped automatically"
    ],
    link: { href: "/admin/communications", label: "Open Communications" },
    action: "To send from crateservices@digitalcratedjs.com: verify digitalcratedjs.com in Resend and set COMM_EMAIL_FROM in Vercel."
  },
  {
    id: "2026-11-04-members-forgot-password",
    date: "2026-11-04",
    area: "Members area",
    title: "Forgot your password? link on the members login",
    summary: "DJs who are locked out can reset their own password from the members sign-in page.",
    link: { href: "https://digitalcratedjs.com/members/", label: "Open members area", external: true },
    action: "Upload the updated page-members.php to the theme folder if you haven't yet."
  },
  {
    id: "2026-11-03-sms-alerts",
    date: "2026-11-03",
    area: "Members area",
    title: "SMS alerts sign-up (Twilio)",
    summary: "Text-alert opt-in page plus SMS Terms and an updated Privacy Policy, built to pass Twilio's A2P review.",
    bullets: ["Opt-in page at /sms-alerts", "SMS Terms at /sms-terms", "Privacy Policy rewritten at /privacy-policy", "Approval list in WordPress admin"],
    link: { href: "https://digitalcratedjs.com/sms-alerts", label: "Open SMS sign-up", external: true }
  },
  {
    id: "2026-11-02-academy",
    date: "2026-11-02",
    area: "Members area",
    title: "DCDJs Academy",
    summary: "Training and certification for DJs inside the members area.",
    bullets: [
      "Training modules shown in a grid",
      "Lessons and the final assessment name both owners: DJ Peace and Grand Master O",
      "Clear rules on established venues (a set payment arrangement), what DJs don't share with venues, and holiday-only venues",
      "Admin pages for venues, members, settings and representatives"
    ],
    link: { href: "https://digitalcratedjs.com/members/#academy", label: "Open Academy", external: true }
  },
  {
    id: "2026-11-02-bios",
    date: "2026-11-02",
    area: "Members area",
    title: "DJ bios cleaned up",
    summary: "DJ Peace's bio and card now match the other DJs (Founder & CEO removed). DJs can edit their own bio in the members area.",
    link: { href: "https://digitalcratedjs.com/members/#bio", label: "Open My Bio", external: true }
  },
  {
    id: "2026-11-01-availability",
    date: "2026-11-01",
    area: "Members area",
    title: "Availability grid managers",
    summary: "Any DJ can be given the full Who's available grid, without making them an admin.",
    bullets: ["WordPress admin → Settings → Google Calendar Integration → Availability managers", "They can view and change availability squares; confirming DJs on gigs stays admin-only"]
  }
];

export const LAST_SEEN_KEY = "dcdj-whats-new-seen";

/** How many updates are newer than the last one this browser has seen. */
export function unseenCount(lastSeenId: string | null): number {
  if (!lastSeenId) return UPDATES.length;
  const i = UPDATES.findIndex((u) => u.id === lastSeenId);
  return i === -1 ? UPDATES.length : i;
}
