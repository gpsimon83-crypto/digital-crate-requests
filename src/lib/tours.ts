// Visual walkthroughs for What's New. Each step points at a real element
// (data-tour="...") on a real page. The tour engine (GuidedTour) moves
// between pages on its own when a step's page is fixed, and waits for the
// viewer to click through when the page depends on their data (e.g.
// "open any project").

export interface TourStep {
  /** Page this step lives on. "*" matches one path segment. Query params listed must match. */
  path: string;
  /** CSS selector to spotlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: string;
  /** On Next, follow this link (its href) instead of staying on the page. */
  follow?: string;
  /** Shown while the viewer still needs to open this step's page themselves. */
  waitHint?: string;
}

export const TOURS: Record<string, TourStep[]> = {
  "2026-11-09-template-library": [
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-filter"]',
      title: "Four kinds of templates",
      body: "Filter by Clients, DJ team, Venue partners or Personal. The numbers show how many of each you have."
    },
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-template"]',
      title: "Start from a template",
      body: "Every template is fully editable. Duplicate one first if you want to keep the original. Click Next to open this one.",
      follow: '[data-tour="comm-template"] a'
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-audience"]',
      title: "Who it's for decides who you can pick",
      body: "Clients pick from client records, DJ team from your DJs, Venue partners from venue managers. Personal only sends to addresses you type, never linked to CRM records.",
      waitHint: "Open any template to continue."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-blocks"]',
      title: "Replace the [FILL-INS]",
      body: "Words in square brackets like [DATE] or [DJ NAME] are yours to fill in. Words in double braces like {{first_name}} fill in automatically for each person."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-send"]',
      title: "Safety check before sending",
      body: "Review & send checks for missing details and any [FILL-INS] you forgot, and shows them before anything goes out."
    }
  ],
  "2026-11-06-venue-portal-a": [
    {
      path: "/admin/venues",
      target: '[data-tour="venues-add"]',
      title: "Add your venues",
      body: "Type the venue name and city, then Add Venue. Start with Casey Keys, then North 48 and Lake County."
    },
    {
      path: "/admin/venues",
      target: '[data-tour="venues-table"]',
      title: "Your venue list",
      body: "Portal shows whether the venue can sign in (On/Off). Managers shows how many people have a login."
    },
    {
      path: "/admin/venues",
      target: '[data-tour="venue-manage"]',
      title: "Manage a venue",
      body: "Manage opens everything for one venue. Click Next to open the first one, or click Manage on any venue.",
      follow: '[data-tour="venue-manage"]'
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-access"]',
      title: "Turn the portal on",
      body: "Venue active and Portal on must both be on before a manager can sign in. Turning either off blocks access right away.",
      waitHint: "Click Manage on a venue to continue."
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-branding"]',
      title: "Cover photo and logo",
      body: "Upload a wide photo (1600 × 400 is ideal) and the logo. Click the part of the photo you want centered; the desktop and phone crops are set separately."
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-nights"]',
      title: "Regular entertainment nights",
      body: "Add their weekly DJ nights (for example Friday 9 PM–1:30 AM). They show on the venue's dashboard and calendar."
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-calendar-names"]',
      title: "Names on the DCDJ calendar",
      body: "How this venue is written in the shared Google Calendar. This is internal only and lets the next phase show the venue its bar nights."
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-managers"]',
      title: "Add the manager",
      body: "Enter their name and email, then Add manager. You get a one-time setup link to text or email them. Nothing sends automatically."
    },
    {
      path: "/admin/venues/*",
      target: '[data-tour="venue-preview"]',
      title: "See what they see",
      body: "Preview as venue opens their dashboard read-only. Save changes with the bar that appears at the bottom whenever you edit."
    }
  ],
  "2026-11-06-client-portal-preview": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open any project",
      body: "Click Next to open the first project, or click any project name.",
      follow: '[data-tour="project-link"]'
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="event-client-portal"]',
      title: "View client portal",
      body: "Opens this client's portal in a new tab exactly as they see it, with a blue Admin preview bar. Signing and paying only work from the client's own login.",
      waitHint: "Open any project to continue."
    }
  ],
  "2026-11-04-comm-center": [
    {
      path: "/admin/communications?tab=overview",
      target: '[data-tour="comm-tabs"]',
      title: "Four tabs",
      body: "Overview for the big picture, Templates for your designs, Sent for delivery tracking, Settings for the sender and do-not-email list."
    },
    {
      path: "/admin/communications?tab=overview",
      target: '[data-tour="comm-stats"]',
      title: "Last 30 days at a glance",
      body: "Sent, delivered, opened, clicked and bounced. Delivered/opened/clicked fill in once the Resend webhook is connected."
    },
    {
      path: "/admin/communications?tab=overview",
      target: '[data-tour="comm-new"]',
      title: "Start a new email",
      body: "Opens a blank design in the Email Studio. Most of the time it's faster to start from a template."
    },
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-template"]',
      title: "Templates",
      body: "Edit opens the Studio. The copy icon duplicates a template so you can keep the original. Click Next to open this one.",
      follow: '[data-tour="comm-template"] a'
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-blocks"]',
      title: "Build with blocks",
      body: "Logo, heading, text, image, button, divider and more. Change the words, move blocks up or down, and watch the live preview.",
      waitHint: "Open any template to continue."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-test"]',
      title: "Always send a test first",
      body: "Send test emails only you, with sample names filled in, so you can check it on your phone."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-send"]',
      title: "Send for real",
      body: "Pick clients (or type addresses), review the check, then confirm. Each person gets their own personalized copy."
    },
    {
      path: "/admin/communications?tab=settings",
      target: '[data-tour="comm-settings"]',
      title: "Settings",
      body: "Shows which address emails come from and the do-not-email list. Bounced and spam-flagged addresses are added automatically."
    }
  ],
  "2026-11-04-dj-templates": [
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-filter"]',
      title: "Filter to the DJ team",
      body: "Click DJ team to see the team emails: availability request, gig reminders, Academy, meetings and more."
    },
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-template"]',
      title: "Open a DJ template",
      body: "Click Edit on any DJ team template to continue.",
      waitHint: "Open a DJ team template to continue."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-audience"]',
      title: "Who it's for",
      body: "DJ team templates send to your DJs. Clients templates send to clients. Switch it here any time.",
      waitHint: "Open a DJ team template to continue."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-send"]',
      title: "Send to DJs",
      body: "For DJ team emails the Send window lists your DJs. Each one gets their own name and their next gig filled in."
    }
  ],
  "2026-11-04-dj-register-template": [
    {
      path: "/admin/communications?tab=templates",
      target: '[data-tour="comm-filter"]',
      title: "Find the template",
      body: "Click DJ team, then open DJ: Create your members account."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-blocks"]',
      title: "Add the invite code",
      body: "In the text block, replace [INVITE CODE] with that DJ's one-time code from WordPress → Users → DJ Invite Codes.",
      waitHint: "Open DJ: Create your members account to continue."
    },
    {
      path: "/admin/communications/studio/*",
      target: '[data-tour="studio-send"]',
      title: "Send to one DJ",
      body: "Each code works once, so send to one DJ at a time. Type their email at the bottom of the Send window if they aren't in the CRM."
    }
  ]
};

/**
 * Walkthroughs that run in the DJ members area (digitalcratedjs.com), not the
 * CRM. Start walkthrough opens the members page with ?dctour=<key>; the
 * members area runs the steps itself (theme file inc/member-tours.php). Keep
 * these step titles in sync with that file. Admin-only steps are marked.
 */
export interface MemberTour {
  url: string;
  steps: { title: string; body: string; adminOnly?: boolean }[];
}

const MEMBERS = "https://digitalcratedjs.com/members/";

export const MEMBER_TOURS: Record<string, MemberTour> = {
  "2026-11-11-social-presence": {
    url: `${MEMBERS}?dctour=social-presence`,
    steps: [
      { title: "It starts on your Dashboard", body: "The Social Presence slide shows your track, this week's progress and points, with Walkthrough and Open buttons." },
      { title: "Find it in the Academy", body: "Social Presence sits next to Training and Assignments in the DCDJs Academy." },
      { title: "Your course at a glance", body: "Track, points to spend, lifetime points and weekly streak." },
      { title: "Everything in one place", body: "My Week, Lessons, Tips & Tricks, Draft Helper, Submissions, Progress and Rewards." },
      { title: "Pick a track, then plan your week", body: "Stay Connected, Build Your Presence or Stay in the Spotlight; the first scored week starts the next Monday." },
      { title: "Each assignment", body: "Due time, points, status, checklist, caption template, an equal-value swap, and Submit proof." },
      { title: "Your gigs and your settings", body: "Public bookings become invite, day-of and recap tasks that replace planned posts. Set your days, posting window and reminders." },
      { title: "Short lessons", body: "Six shared lessons, then four for your track, each with a one-question check." },
      { title: "My Social Coach", body: "Caption options, draft check, shot list and no-gig ideas. Template coach, not live AI." },
      { title: "Points and badges", body: "Badges at 50, 150 and 300 lifetime points and after four complete weeks." },
      { title: "Review queue", body: "Approve, send back with exactly what to fix, or excuse. Points are added once on approval.", adminOnly: true },
      { title: "Admin setup", body: "wp-admin → DCDJs Academy → Social Presence: public bookings, venue tags, company tag, lessons, targets, rewards, pauses.", adminOnly: true }
    ]
  },
  "2026-11-10-crate-challenge": {
    url: `${MEMBERS}?dctour=crate-challenge`,
    steps: [
      { title: "It starts on your Dashboard", body: "The Crate Challenge banner on the members Dashboard shows crates open and the next drop, with Walkthrough and Open buttons." },
      { title: "Find it in Venue Curator", body: "The Crate Challenge is the second section of Venue Curator, next to Venue Collections." },
      { title: "The challenge", body: "40 themed crates that unlock a few at a time. DJs fill each crate to 25 songs, up to 10 songs per DJ per crate." },
      { title: "Launch and settings", body: "Launch opens the first crates and can post the promo on the members Dashboard. DJs can't see the challenge until you launch it.", adminOnly: true },
      { title: "Progress and the next drop", body: "Crates open and complete, songs added by everyone, and the next Monday drop." },
      { title: "Top crate diggers", body: "The leaderboard ranks DJs by songs added across all crates." },
      { title: "Filter the crates", body: "All 40, open, needs songs, complete, or locked." },
      { title: "Open and locked crates", body: "Open crates show progress; locked ones show their unlock date. Next opens a crate." },
      { title: "Add your songs", body: "Pick from the Music Pool. DJs can remove only their own songs." },
      { title: "Top diggers in this crate", body: "Who added the most. Fill it to 25 for a Complete ribbon." }
    ]
  },
  "2026-11-10-venue-curator-library": {
    url: `${MEMBERS}?dctour=venue-curator#curator`,
    steps: [
      { title: "DCDJs Music Collections", body: "Every venue playlist is a collection with its own cover, shown as a grid." },
      { title: "Create a collection", body: "Name, venue, category, genres and a cropped cover photo.", adminOnly: true },
      { title: "Search and sort", body: "Search by name, filter to one venue, or change the order." },
      { title: "Browse by category", body: "All Collections, By Venue, or one category at a time." },
      { title: "Open a collection", body: "Each card shows venue, category, track count and last update. Next opens one." },
      { title: "Work on the list", body: "Add tracks, build from recommendations, or download the list as a spreadsheet." },
      { title: "The track list", body: "Search, filter clean or dirty and by genre; the ⋯ button moves, copies or removes a track." },
      { title: "Top rated", body: "The songs DJs rated highest for this venue." },
      { title: "Curated Tracks Archive", body: "Each quarter every venue's list is saved automatically; download any of them." }
    ]
  }
};

export const hasTour = (id: string) => !!TOURS[id] || !!MEMBER_TOURS[id];

export function pathMatches(pattern: string, pathname: string, search: URLSearchParams): boolean {
  const [p, q] = pattern.split("?");
  const a = p.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length || !a.every((seg, i) => seg === "*" || seg === b[i])) return false;
  if (!q) return true;
  const want = new URLSearchParams(q);
  for (const [k, v] of want) {
    const got = search.get(k);
    // A missing ?tab= means the page's default tab ("overview").
    if (got !== v && !(got === null && v === "overview")) return false;
  }
  return true;
}

export const isConcrete = (pattern: string) => !pattern.includes("*");
