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
  "2026-11-23-flyer-animate": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Animate is in the flyer editor. Click Next to open your first flyer, or click any flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-animate"]',
      title: "Animate",
      body: "Click Animate to add motion. Your design stays as it is; motion is added on top and saved with the flyer.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-styles"]',
      title: "Pick a motion style",
      body: "Preview plays a style without changing anything. Apply uses it (you can undo). If layers already have motion, you're asked before it's replaced."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-intensity"]',
      title: "How much movement",
      body: "Subtle, Balanced or High Energy scales every effect within safe limits. Keep event details readable holds the venue, date, time and address steady."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-preview"]',
      title: "Play and scrub",
      body: "Press Play (or the space bar) to watch the loop; drag the slider to any frame. Reduced motion preview shows a gentler version."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-mode"]',
      title: "Advanced",
      body: "Advanced shows every layer, the motion library and the timeline. Select a layer, add up to 4 effects, tune them, copy them to another layer or save them as your own preset."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-check-loop"]',
      title: "Check loop",
      body: "Plays the video 3 times and puts the last and first frame side by side, so you can see the loop has no jump."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="animate-export"]',
      title: "Export MP4",
      body: "Makes the video on your device, frame by frame: 30 fps, no sound, at the flyer's size. Keep the tab open until Download appears."
    }
  ],
  "2026-11-23-north48-template": [
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-tpl-edit"], main',
      title: "North 48 – Blackout",
      body: "The new template is in your list. Edit opens it: NORTH 48 sits on an arch, linked to the venue name, and every word is its own layer."
    },
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-tpl-share"], main',
      title: "Choose who gets it",
      body: "It starts out shared with all DJs. Use this button to limit it to chosen DJs or keep it office-only."
    },
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-office-templates"], main',
      title: "DJs start from it here",
      body: "DJs find it under Templates from the office. Their booking's venue, date, time, DJs and specials fill in, and the Curve setting under Text bends any line."
    }
  ],
  "2026-11-23-flyer-template-sharing": [
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-tpl-share"], main',
      title: "Who gets this template",
      body: "This button shows who sees the template in their portal. Click it to pick All DJs, Chosen DJs (tick who), or Office only."
    },
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-office-templates"], main',
      title: "What DJs see",
      body: "Templates shared with a DJ show here on their Flyers page, newest marked New. Picking one opens New flyer with it selected."
    }
  ],
  "2026-11-23-questionnaire-recommended-pricing": [
    {
      path: "/admin/services?cat=bars-nightlife",
      target: '[data-tour="services-packages"], main',
      title: "Bars & Nightlife packages",
      body: "Bar Night – House Sound at $500 with a $275 flat payout, and Bar Residency priced by quote. Edit them like any other package."
    },
    {
      path: "/admin/events",
      target: "table, main",
      title: "Recommended package on each project",
      body: "Open a project and go to Details. Recommended package shows the best fit from your Services catalog, the add-ons their answers call for and an estimated total, with the DJ payout estimate."
    },
    {
      path: "/admin/events",
      target: "table, main",
      title: "Send Event Basics",
      body: "For parties, school, corporate and bar events, Create link on that card copies an Event Basics link to text or email. Weddings keep using Wedding Basics. Use this package sets the package for the DJ offer."
    },
    {
      path: "/dj-dashboard/bookings",
      target: "main",
      title: "DJs see it too",
      body: "On their project page a DJ sees the same recommendation and can send the questionnaire link. They don't see payouts or the company share, and clients never see the recommendation.",
      waitHint: "Switch to DJ View (or open the DJ portal) to continue."
    }
  ],
  "2026-11-23-services-catalog-dj-offers": [
    {
      path: "/admin/services",
      target: '[data-tour="services-packages"], main',
      title: "Packages by event category",
      body: "Pick a tab to see its packages. Edit opens the package; the arrows change its order; Deactivate hides it from clients and new inquiries without touching existing bookings."
    },
    {
      path: "/admin/services",
      target: '[data-tour="services-categories"], main',
      title: "Your categories",
      body: "Add, rename, reorder or turn off the event categories. A package can sit in more than one: tick them in Edit Package."
    },
    {
      path: "/admin/services",
      target: '[data-tour="services-addons"], main',
      title: "Add-ons",
      body: "Set each add-on's price and where it's offered. Packages that include one show it as Included, with no extra charge."
    },
    {
      path: "/admin/services",
      target: '[data-tour="services-packages"], main',
      title: "DJ Payout on each package",
      body: "In Edit Package, the DJ Payout section (admins only) sets a percentage or flat amount, the DJ service amount for bundles, and shows the client price, estimated DJ payout and DCDJs share."
    },
    {
      path: "/admin/events",
      target: "table, main",
      title: "Send a DJ an offer",
      body: "Open a project and go to Details → DJ offer. The package's rule suggests the payout; change it if you need to, then send. The DJ accepts it under Gig Offers in their portal."
    },
    {
      path: "/admin/settings",
      target: '[data-tour="default-project-cover"], main',
      title: "Default project photo",
      body: "Pick the banner clients see on their project page when it has no photo of its own. Any project can pick a different one under Customize Portal."
    },
    {
      path: "/admin/services",
      target: '[data-tour="services-client-link"], main',
      title: "What clients see",
      body: "This opens the client Services page: the same packages by category, with Request this package, and none of the payout details."
    }
  ],
  "2026-11-23-edit-everything": [
    {
      path: "/admin/equipment",
      target: '[data-tour="equipment-new-item"], main',
      title: "Add gear under your own name",
      body: "Click New Item, type the name you use (like Rev 7 controller), and pick a category or type a new one. Click any row in the list to edit it."
    },
    {
      path: "/admin/events",
      target: 'table, main',
      title: "Rename a project",
      body: "Each project's ⋯ menu has Rename…. Open a project and click Edit on Project Details to change its name, event type and guest count too."
    },
    {
      path: "/admin/clients",
      target: 'main',
      title: "Edit a contact",
      body: "Open a contact and click Edit contact to change their name, email, phone, partner details or address. On a project, the Edit beside the client does the same."
    },
    {
      path: "/admin/finance",
      target: '[data-tour="finance-totals"], main',
      title: "Fix a payout or expense",
      body: "The pencil beside each payout or expense lets you correct the amount, note, category or date."
    }
  ],
  "2026-11-23-projects-bulk-equipment-finance": [
    {
      path: "/admin/events",
      target: 'table input[type="checkbox"], main',
      title: "Pick several projects",
      body: "Tick projects, or the box in the header for every project matching your search. A bar appears with Move to stage and Delete. Each row's ⋯ menu has Open and Delete too."
    },
    {
      path: "/admin/equipment",
      target: '[data-tour="equipment-setup-rules"], main',
      title: "Setup rules, one space at a time",
      body: "Pick a space to see its rules as short cards. Edit opens a rule in a side panel."
    },
    {
      path: "/admin/finance",
      target: '[data-tour="finance-totals"], main',
      title: "Finance at a glance",
      body: "Your totals on top, then what's still owed, with DJ payouts and expenses side by side."
    }
  ],
  "2026-11-22-manage-djs-cards": [
    {
      path: "/admin/djs",
      target: '[data-tour="dj-roster-counts"], main',
      title: "Your roster at a glance",
      body: "How many DJs you have, how many can sign in to the DJ portal, and how many have no login yet."
    },
    {
      path: "/admin/djs",
      target: '[data-tour="dj-roster-toolbar"], main',
      title: "Find a DJ",
      body: "Search by name, filter by portal access, and sort A–Z, Z–A or by access."
    },
    {
      path: "/admin/djs",
      target: '[data-dj-card], main',
      title: "Each DJ's card",
      body: "Manage profile opens their full page. The camera button changes their photo and its framing. The ⋯ menu has Quick edit, View as, Copy setup link (while they have no login) and Remove from roster."
    },
    {
      path: "/admin/djs",
      target: '[data-tour="dj-add"], main',
      title: "Add a DJ",
      body: "Type their name and they're on the roster. Add a photo and send a setup link from their card."
    }
  ],
  "2026-11-22-portal-grid-and-menus": [
    {
      path: "/admin",
      target: '.admin-rail, [data-tour="mobile-more"]',
      title: "The admin menu",
      body: "Grouped as Work, Team, Business, Communication, Resources, Intake and System. DCDJs Academy and the DJ members area open in a new tab."
    },
    {
      path: "/admin",
      target: '[data-tour="view-switch"], .admin-rail',
      title: "Admin View and DJ View",
      body: "If your login is linked to your own DJ profile, DJ View shows the DJ portal with your own gigs, calendar and pay. Admin View brings you back."
    },
    {
      path: "/admin/notifications",
      target: '[data-tour="inbox-tabs"], main',
      title: "What's New lives here now",
      body: "Notifications and What's New are tabs of one page. The latest updates also show beside your notifications."
    },
    {
      path: "/dj-dashboard",
      target: '[data-tour="update-availability"], [data-tour="mobile-more"]',
      title: "Update Availability",
      body: "Opens the members-area Availability tab in a new tab, where DJs send their monthly availability.",
      waitHint: "Switch to DJ View (or open the DJ portal) to continue."
    },
    {
      path: "/dj-dashboard/tasks",
      target: '[data-tour="dj-tasks-detail"], main',
      title: "Tasks & Planning",
      body: "Every booking's open tasks, with its planning brief one click away. Messages, Meetings and Documents work the same way."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="event-client-portal"], main',
      title: "The client planning page",
      body: "Clients plan on their portal's Music tab: song lists side by side, notes beside the checklist, vendors and logistics together, one Save changes. Press View client portal, then Music, to see it.",
      waitHint: "Open any wedding project to continue."
    }
  ],
  "2026-11-22-event-calendar-redesign": [
    {
      path: "/admin",
      target: '[data-tour="dash-calendar"], main',
      title: "The event calendar",
      body: "The month on the left, the day you pick on the right. Each day lists up to two events and then +N more. Lime is booked, an amber ring is an inquiry, grey is away."
    },
    {
      path: "/admin",
      target: '[data-tour="cal-controls"], [data-tour="dash-calendar"]',
      title: "Change month or view",
      body: "Go back or forward a month, or jump to Today. Agenda lists the month's events in order. Full calendar opens the full calendar page."
    },
    {
      path: "/admin",
      target: '[data-tour="cal-day"], [data-tour="dash-calendar"]',
      title: "The day you picked",
      body: "Every event that day, earliest first, with its time, DJ and venue. View event opens the project."
    }
  ],
  "2026-11-21-dj-calendar-dates": [
    {
      path: "/admin/settings",
      target: '[data-tour="calendar-schedule-pick"], main',
      title: "Pick the DJ schedule calendar",
      body: "Choose the calendar your DJs write their gigs on (the DCDJ Calender) and press Use this calendar. Each DJ then sees every entry with their name, like \"Young Wedding - Penny\"."
    },
    {
      path: "/admin/settings",
      target: '[data-tour="calendar-full-pull"], main',
      title: "Pull it again any time",
      body: "If a DJ says a date is missing, press this to re-read everything from a year ago onward. The regular sync keeps it current otherwise."
    },
    {
      path: "/admin/djs",
      target: "main",
      title: "See a DJ's calendar",
      body: "Open a DJ, click View as, then open Calendar in their menu. The walkthrough carries on there."
    },
    {
      path: "/dj-dashboard/calendar",
      target: '[data-tour="dj-calendar-month"], main',
      title: "Every date with their name",
      body: "Each month loads as the DJ pages to it: their bookings plus every entry on the DCDJ calendar that names them.",
      waitHint: "Open a DJ's Calendar page (View as) to continue."
    }
  ],
  "2026-11-21-office-email-copies": [
    {
      path: "/admin/settings",
      target: '[data-tour="office-copy"], main',
      title: "Where office copies go",
      body: "Put one office address here. When a DJ emails a Digital Crate DJs client, a hidden copy comes to this address. Clients the DJ added through their own Leads get no copy."
    },
    {
      path: "/admin/djs",
      target: "main",
      title: "What DJs see",
      body: "Open a DJ, click View as, then open one of their bookings. The email box on its Activity tab says when a copy goes to the office."
    },
    {
      path: "/dj-dashboard/projects/*",
      target: '[data-tour="office-copy-note"], [data-tour="project-email"], main',
      title: "The DJ's email box",
      body: "DJs write to clients from their own mailbox here. For Digital Crate DJs clients, a line under the box says a hidden copy goes to the office.",
      waitHint: "Open a booking while viewing as a DJ to continue."
    }
  ],
  "2026-11-21-dj-portal": [
    {
      path: "/admin/djs",
      target: "main",
      title: "See a DJ's new portal",
      body: "Open any DJ from this list, then click View as on their page. You'll see their portal exactly as they do (read-only)."
    },
    {
      path: "/admin/djs/*",
      target: '[data-tour="dj-view-as"], main',
      title: "View as",
      body: "Click View as to open this DJ's portal. The walkthrough carries on there.",
      waitHint: "Open a DJ's page to continue."
    },
    {
      path: "/dj-dashboard",
      target: '[data-tour="dash-metrics"], main',
      title: "The DJ's home",
      body: "Gigs coming up, open leads and pay pending, then what needs doing, earnings and My gigs (including the shared Google Calendar). Same layouts and themes as yours."
    },
    {
      path: "/dj-dashboard",
      target: '[data-tour="dash-actions"], main',
      title: "What needs doing",
      body: "Bookings and recurring gigs to confirm, recaps due, tasks and leads, each opening the right page."
    },
    {
      path: "/dj-dashboard/leads",
      target: '[data-tour="dj-add-lead"], main',
      title: "DJs add leads",
      body: "A DJ adds a client they found. It reaches you as an inquiry assigned to that DJ, with a notification. Click Exit on the green banner when you're done looking."
    }
  ],
  "2026-11-21-view-as-dj": [
    {
      path: "/admin/djs",
      target: 'main',
      title: "Open a DJ",
      body: "Pick any DJ from this list. Their page has View as and, if they don't have a login yet, Send setup link."
    },
    {
      path: "/admin/djs/*",
      target: '[data-tour="dj-view-as"], main',
      title: "View as DJ",
      body: "Opens the DJ dashboard exactly as this DJ sees it. It's read-only; the green banner at the top has Exit."
    },
    {
      path: "/admin/djs/*",
      target: '[data-tour="dj-setup-link"], [data-tour="dj-view-as"], main',
      title: "Send setup link",
      body: "For a DJ with No Login: makes a one-time link that creates their account inside this profile. Copy it, or Email or Text it from your phone or computer."
    }
  ],
  "2026-11-21-my-gigs-invites": [
    {
      path: "/admin/djs",
      target: '[data-tour="dj-link-me"], main',
      title: "This DJ is me",
      body: "Open your own DJ profile from this list. Next to its name, click This DJ is me to link your admin login to it. Then your dashboard shows My gigs."
    },
    {
      path: "/admin",
      target: '[data-tour="dash-mygigs"], [data-tour="dash-actions"]',
      title: "My gigs",
      body: "Your projects and your Google Calendar entries for the next four months, in date order. It appears once your login is linked to your DJ profile."
    },
    {
      path: "/admin/invite-codes",
      target: '[data-tour="invite-send"], main',
      title: "Send an invite code",
      body: "Generate Code, then Copy, Email or Text on its row. The DJ gets a sign-up link with the code already filled in. Each code works once."
    }
  ],
  "2026-11-21-dashboard-layouts": [
    {
      path: "/admin",
      target: '[data-tour="dash-layout"]',
      title: "Two layouts",
      body: "Modern Studio or Midnight Command: same numbers, arranged differently. Colors follow your site theme. Your pick is saved in this browser."
    },
    {
      path: "/admin",
      target: '[data-tour="dash-metrics"]',
      title: "Live numbers",
      body: "New leads, pending contracts, events this week and the value booked this year (collected and still owed listed separately). Click any of them to open the list behind it."
    },
    {
      path: "/admin",
      target: '[data-tour="dash-actions"]',
      title: "Action hub",
      body: "What needs you, by workflow, with a count and the next step. Each opens Projects filtered to exactly those events. One event can be in more than one group."
    },
    {
      path: "/admin",
      target: '[data-tour="dash-revenue"]',
      title: "Revenue",
      body: "Booked versus collected per month for the period you pick. Booked follows Reports (event value by event month); Collected is payments received."
    },
    {
      path: "/admin",
      target: '[data-tour="dash-upcoming"]',
      title: "Upcoming events",
      body: "The next six events with their DJ, or Unassigned. The calendar beside it shows dots on event days; click a day for its events."
    },
    {
      path: "/admin/settings",
      target: '[data-tour="dash-club-photo"]',
      title: "Banner photos",
      body: "The Admin Dashboard hero photo is the Weddings banner. Add a Club & Bar Nights photo here and drag the position sliders to set the crop. Then Save Settings."
    }
  ],
  "2026-11-21-site-themes": [
    {
      path: "/admin/settings",
      target: '[data-tour="site-theme-settings"]',
      title: "Site theme",
      body: "Pick a look for the whole admin area: the sidebar, every page and pop-ups. It's saved in this browser. Classic Cream is the original look."
    },
    {
      path: "/admin/settings",
      target: '[data-tour="site-theme"], [data-tour="mobile-more"], [data-tour="site-theme-settings"]',
      title: "Switch any time",
      body: "Theme in the sidebar (above Sign Out) changes it from any page; on a phone it's at the bottom of More. Project pages still open in their event type's look."
    }
  ],
  "2026-11-21-flyer-mask": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "The Mask tool is in the flyer editor. Click Next to open your first flyer, or click any flyer with a photo.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="mask-open"], [data-tour="flyer-layers"]',
      title: "Mask",
      body: "Select a photo or PNG layer (on the flyer or in Layers). Mask is next to Photo effects in its settings. Click it to start.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="mask-tools"], [data-tour="mask-open"], [data-tour="flyer-layers"]',
      title: "Hide, Restore, Fade",
      body: "Hide paints parts away, Restore paints them back (only what's in the photo). Fade: drag across the picture, then move the solid dot (shown) and hollow dot (hidden). Ctrl/⌘ Z steps back one stroke."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="mask-overlay"], [data-tour="mask-more"], [data-tour="mask-open"], [data-tour="flyer-layers"]',
      title: "See what's hidden",
      body: "Show hidden tints the hidden parts; hold Hold: original to compare with the full photo. Edge feather softens every edge. On a phone these are under More."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="mask-apply"], [data-tour="mask-open"], [data-tour="flyer-layers"]',
      title: "Apply or Cancel",
      body: "Apply keeps the mask as one undo step; Cancel goes back to how it was. The mask follows the layer when you move, turn, flip, crop or duplicate it, and exports match the editor."
    }
  ],
  "2026-11-20-dj-night-template": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-new"]',
      title: "New flyer",
      body: "Click New flyer and pick DJ Night Party from the templates (portrait or story)."
    },
    {
      path: "/dj-dashboard/flyers",
      title: "It fills itself in",
      body: "Choose the event and the venue, date, year, start time and DJ lineup fill in. Replace the concert photo with Replace image; the soft fade stays."
    }
  ],
  "2026-11-20-effects-any-layers": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Effects are in the flyer editor. Click Next to open your first flyer, or click any flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-effects"]',
      title: "Effects tab",
      body: "Open Effects to choose a look.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="fx-layers"], [data-tour="flyer-tab-effects"]',
      title: "Apply to",
      body: "Tick the layers that get the look (photos, text, shapes, logos, the background), or Include all layers. Then Add an effect, adjust it and Apply: it goes on every ticked layer as one undo step."
    }
  ],
  "2026-11-20-flyer-photo-effects": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Photo Effects are in the flyer editor. Click Next to open your first flyer, or click any flyer with a DJ photo.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-effects"]',
      title: "Effects tab",
      body: "Open Effects, then click the DJ photo on the flyer (or pick it from the list). Click Add an effect.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="fx-presets"], [data-tour="fx-tab"], [data-tour="flyer-tab-effects"]',
      title: "Pick a look",
      body: "The thumbnails are made from your photo. Strength sets how much of the look you get, and each look shows only the controls that apply to it."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="fx-original"], [data-tour="fx-tab"], [data-tour="flyer-tab-effects"]',
      title: "Compare, save, apply",
      body: "Hold View original to see the photo without the effect. Save as preset keeps a look for other flyers. Apply keeps it (one undo step); Cancel puts it back. The photo itself is never changed, and exports match what you see."
    }
  ],
  "2026-11-20-recurring-bar-nights": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a Bar / Club project",
      body: "A one-off project shows Make it recurring; a recurring one opens in the new layout."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="make-recurring"], [data-tour="residency-header"]',
      title: "Recurring nights",
      body: "On a one-off Bar / Club project, Make it recurring sets the schedule: weekly, some weeks of the month (like 1st & 3rd Saturday), or dates you pick. Weddings and one-off bookings keep the usual layout.",
      waitHint: "Open a Bar / Club project to continue."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="next-gig"]',
      title: "Next gig",
      body: "The earliest upcoming date that isn't canceled, its hours and DJ coverage. The button changes: Assign DJ, View assignment, or Open gig."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="upcoming-gigs"]',
      title: "Upcoming gigs",
      body: "Date, set time, DJ and status; the next gig is highlighted. Click a row to assign a DJ, change the hours, add notes for that night, cancel it or mark it played. Each change asks: This gig only, or This and future gigs."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="edit-schedule"]',
      title: "Edit the schedule",
      body: "Changes apply from a date you choose. Past gigs, one-night swaps and dates a DJ confirmed are kept; saving again never adds duplicate dates."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="residency-tabs"]',
      title: "Brief, recaps, money",
      body: "Venue Brief holds load-in, house gear, music direction and expectations on the venue record. Recaps lists every DJ recap (pin advice to the brief from any of them). Financials shows the month for staff with finance access."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="residency-more"]',
      title: "Project records",
      body: "Activity, Files, Tasks, Notes and Details are all still here."
    },
    {
      path: "/admin/events/*",
      title: "What the DJ sees",
      body: "The assigned DJ confirms or declines each date in My Bookings → Venue nights, opens the venue brief with that night's notes, and gets three recap questions after the gig. Nothing about rates shows to the DJ, the venue or the client."
    }
  ],
  "2026-11-20-remove-payments": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "Click the project with the payment to remove."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Financials"]',
      title: "Financials tab",
      body: "Click Next to open it.",
      follow: 'a[href$="?tab=Financials"]',
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*?tab=Financials",
      target: '[data-tour="remove-payment"]',
      title: "Remove",
      body: "On any payment you recorded by hand. You'll be asked to confirm; it's permanent, and the activity log keeps a record. Card payments are refunded in Stripe instead.",
      waitHint: "Only payments recorded by hand have Remove. Record one first, or open a project that has one."
    },
    {
      path: "/admin/events/*?tab=Financials",
      title: "What the client sees",
      body: "Their portal balance updates as soon as the payment is removed."
    }
  ],
  "2026-11-19-record-payments": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "Click the project the client paid for."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Financials"]',
      title: "Financials tab",
      body: "Payments live here. Click Next to open it.",
      follow: 'a[href$="?tab=Financials"]',
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*?tab=Financials",
      target: '[data-tour="record-payment"]',
      title: "Record a payment",
      body: "For cash, check, Zelle, Venmo and the like: amount, date paid, deposit or balance, how they paid, and an optional check # or note. It counts toward the balance right away."
    },
    {
      path: "/admin/events/*?tab=Financials",
      target: '[data-tour="payment-ledger"]',
      title: "Payment history",
      body: "Every payment, with how it was paid. A hand-entered payment that was a mistake can be voided with a reason; it stays listed but stops counting."
    },
    {
      path: "/admin/events/*?tab=Financials",
      title: "What the client sees",
      body: "The client portal's Payments tab and Overview show the new Paid so far and Balance due. Your notes and voided entries aren't shown to them. Use View client portal at the top to check."
    }
  ],
  "2026-11-19-wedding-playbook": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a wedding",
      body: "Click any wedding project to see its playbook."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Tasks"]',
      title: "Tasks tab",
      body: "The playbook lives here. Click Next to open it.",
      follow: 'a[href$="?tab=Tasks"]',
      waitHint: "Open any wedding project to continue."
    },
    {
      path: "/admin/events/*?tab=Tasks",
      target: '[data-tour="playbook-next-up"]',
      title: "Next up",
      body: "The one task to do now, who owns it and when it's due. The button opens the right record."
    },
    {
      path: "/admin/events/*?tab=Tasks",
      target: '[data-tour="playbook"] [data-task]',
      title: "Coached tasks",
      body: "Tasks are grouped by stage; finished stages fold away. Open one for Your next move, a Coach's tip, the Ready when checklist, and Mark waiting / Mark ready. Record-based tasks finish themselves."
    },
    {
      path: "/admin/events/*?tab=Tasks",
      target: '[data-tour="playbook-request"]',
      title: "Requests",
      body: "Add your own task, or log a request for extra coverage, overtime or a package change. Requests go to the booking lead, who handles pricing."
    },
    {
      path: "/admin/settings",
      target: '[data-tour="playbook-timing"]',
      title: "Timing",
      body: "When each task is due, in days from the booking or the wedding date. Open tasks follow changes; dates set by hand on a task stay put."
    },
    {
      path: "/admin/settings",
      title: "What the DJ and couple see",
      body: "The assigned DJ sees their tasks on their project page, with a Day-before brief for their phone. Couples see their own steps as a planning checklist on the portal Overview."
    }
  ],
  "2026-11-19-details-equipment-plan": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "Click any project to see the new Details tab."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Details"]',
      title: "Details tab",
      body: "Click Next to open it.",
      follow: 'a[href$="?tab=Details"]',
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="event-details"]',
      title: "Event Details",
      body: "Event type, date, venue, guests, service and DJ at a glance; Edit works as before. Final amount is the agreed total from an approved proposal or signed contract, or “Not finalized”.",
      waitHint: "Open the Details tab to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="equipment-plan"]',
      title: "Equipment, recommended",
      body: "What the proposal is based on, the setup per space (open a row for why each item and how many are free that date), anything missing, and what's actually assigned. Manual assigning is still at the bottom."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="equipment-review"]',
      title: "Review recommendations",
      body: "Adjust items and quantities, then confirm. Nothing is assigned until you do; confirming again updates the same assignments. If guests, venue, timing or setup change later, the card asks for a review and keeps your assignments."
    },
    {
      path: "/admin/equipment",
      target: '[data-tour="equipment-setup-rules"]',
      title: "Setup rules",
      body: "The rules behind the recommendations, per space: which gear (an item, or any in a category), how many, when it applies (guest count, indoors/outdoors, ceremony or cocktail space, microphones), and the reason staff see."
    }
  ],
  "2026-11-19-portal-tab-grids": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "The tidier layout is in the client's portal. Click any project to continue."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Details"]',
      title: "Details tab",
      body: "Click Next to open the Details tab, where Customize Portal lives.",
      follow: 'a[href$="?tab=Details"]',
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="portal-view-link"]',
      title: "See it as the client does",
      body: "View Client Portal opens their portal. Music now shows songs and notes beside vendors and logistics, Contracts puts signing beside the contract, Forms and Documents sit in a grid, and Payments keeps a readable width. On phones it all stacks.",
      waitHint: "Open the Details tab to continue."
    }
  ],
  "2026-11-18-client-portal-redesign": [
    {
      path: "/admin/settings",
      target: '[data-tour="settings-portal-looks"]',
      title: "A look for each event type",
      body: "Pick the client-portal palette for each event type: Ink & Brass, Indigo & Apricot, Pine & Copper, Slate & Electric Lime or Plum & Champagne, then Save looks. Every client portal for that type uses it unless the event picks its own."
    },
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "One event can have its own look. Click any project to continue."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Details"]',
      title: "Details tab",
      body: "Customize Portal is on the Details tab. Click Next to open it.",
      follow: 'a[href$="?tab=Details"]',
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="portal-look"]',
      title: "Portal look for this event",
      body: "Choose a palette for just this client, or the event type's default. Below it: turn the blurred banner backdrop on or off and set its strength. Click Save to apply.",
      waitHint: "Open the Details tab to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      title: "What the client sees",
      body: "A split header with their banner photo and a countdown, photo tabs, Contract / Balance / Music plan tiles, their next step as one big button, recent messages, and their DJ. Use View Client Portal at the top of Customize Portal to see it as they do."
    }
  ],
  "2026-11-18-project-page-themes": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a project",
      body: "Click any project to see the new layout."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="project-header"]',
      title: "Split header",
      body: "The banner photo beside the title, date, time, venue, event type, guests and service. Use the buttons on the photo to change or remove it.",
      waitHint: "Open any project to continue."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="project-timeline"]',
      title: "Booking panel",
      body: "The nine-stage rail (click a stage to move there), then the current stage, where things stand, what's next, and one button for the next step, like Collect retainer or Start planning."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="project-tabs"]',
      title: "Tabs",
      body: "Activity, Files, Tasks, Financials, Notes and Details, on their own row."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="project-day-cards"]',
      title: "The day at a glance",
      body: "Venue, Ceremony and Reception for weddings (Venue and Event for everything else), filled from the event and Wedding Basics. Click a card for its details."
    },
    {
      path: "/admin/events/*",
      target: '[data-tour="project-theme"]',
      title: "Theme",
      body: "Switch how this project page looks to you: Charcoal & Brass, Nightclub, School Dance, Ink & Brass Gala, Plum & Champagne or Classic Cream. It only changes your view in this browser; the client's colours are set in Customize Portal."
    }
  ],
  "2026-11-18-wedding-basics-packages": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a wedding project",
      body: "Click the name of any wedding to continue. The best one to try is a couple who has submitted Wedding Basics."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Files"]',
      title: "Files tab",
      body: "Wedding Basics is on the Files tab. Click Next to open it.",
      follow: 'a[href$="?tab=Files"]',
      waitHint: "Open any wedding project to continue."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-recommend"]',
      title: "Recommended for this couple",
      body: "Up to three published wedding packages, best fit first, priced with the extras their day needs. Each one says why it fits and what to watch. Send to client portal puts it in their portal as a draft.",
      waitHint: "Open the Files tab to continue."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-panel"]',
      title: "What their day needs, and their details",
      body: "Below the packages: the reason for each extra, what was filled into the client and event, and “Use their answer” wherever their answer differs from the CRM. The DJ sees this same card on their project page."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-send"]',
      title: "Links with their name",
      body: "New links read like cratesdjs.com/w/caroline-catlin-7k2pxq9mab, and texts show them as a tappable Wedding Basics card."
    }
  ],
  "2026-11-15-wedding-basics-link": [
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "Open a wedding project",
      body: "Wedding Basics lives on each wedding's project page. Click the name of any wedding to continue."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Files"]',
      title: "Files tab",
      body: "Wedding Basics is on the project's Files tab. Click Next to open it.",
      follow: 'a[href$="?tab=Files"]',
      waitHint: "Open any wedding project to continue."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-panel"]',
      title: "Wedding Basics questionnaire",
      body: "For couples you can't email yet: a private link, no login, with the must-know questions one at a time, just like the planning questionnaire. Every question is required. Preview questions opens the exact screens they'll see, without saving anything.",
      waitHint: "Open the Files tab to continue."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-send"]',
      title: "Create it, then text it",
      body: "Create link to send makes the private link. Text it opens Messages with the link and a short note filled in; Copy message pastes into any app. New link retires the old one and keeps their answers."
    },
    {
      path: "/admin/events/*?tab=Files",
      target: '[data-tour="wb-panel"]',
      title: "Locked in when they submit",
      body: "Watch it go from Not opened to In progress to Submitted. Submitted answers lock (Let them edit unlocks them), empty event and client fields fill in, any differences are listed, and the best way and time to reach them shows at the top."
    },
    {
      path: "/admin/questionnaires",
      title: "Change the questions",
      body: "Admin → Questionnaires → Wedding Basics: reword, reorder or add questions. Links you've already sent show the changes the next time they're opened."
    }
  ],
  "2026-11-15-flyer-date-badges": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Date badges are in the flyer editor. Click Next to open your first flyer, or click any flyer. No flyers yet? Make one with New flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-badges"]',
      title: "Badges tab",
      body: "Five styles: Orange Ticket, Luxury Gold, Torn Paper, Neon Panel and Bold Editorial. Click one to add it. The weekday, date and time are live text that fill from the flyer's event.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-layers"]',
      title: "A badge moves as one",
      body: "Drag, resize, rotate or lock the whole badge. Click a piece a second time, or pick it here in Layers, to move or restyle just that piece. Replace the artwork like any picture."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-event"]',
      title: "Dates come from the event",
      body: "Pick the event here and the badge fills in. Time shows the event's start–end; choose Start – CLOSE under Time shows on the time text if you want CLOSE. Typing over a piece overrides it, with Reset to event data to undo."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-png2x"]',
      title: "High-resolution export",
      body: "PNG 2× saves the flyer at double size for print or big screens. If any text doesn't fit its box, you'll get a warning first; warnings never appear in the image."
    }
  ],
  "2026-11-15-flyer-shapes": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Shapes are in the flyer editor. Click Next to open your first flyer, or click any flyer. No flyers yet? Make one with New flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-shapes"]',
      title: "Shapes tab",
      body: "Add a box, rectangle, oval or circle as its own layer. A see-through box behind text makes a panel; an outline circle frames a DJ photo.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-layers"]',
      title: "Style and arrange it",
      body: "Select the shape to set fill or outline only, outline color and thickness, rounded corners, shadow, opacity and blend. Box and circle keep their proportions; switch that off to stretch. Move it up or down in Layers."
    }
  ],
  "2026-11-15-flyers-calendar-and-venue-portal": [
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-new"]',
      title: "Start from a venue night",
      body: "New flyer now lists Venue nights (Google Calendar) as well as bookings, with the DJ named on the calendar and the venue's usual hours. Weddings are left out."
    },
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-tpl-edit"]',
      title: "Preview a template with real data",
      body: "Click Next to open the first template, or click Edit on any template.",
      follow: '[data-tour="flyer-tpl-edit"]'
    },
    {
      path: "/admin/flyers/templates/*",
      target: '[data-tour="flyer-preview-with"]',
      title: "Preview with",
      body: "Pick any venue, booking or calendar night, then DJ 1 and DJ 2, to see their cutouts and name logos in place (or their name when there's no logo). Preview only: nothing is saved into the template.",
      waitHint: "Open any template to continue."
    },
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Next, sending a flyer to a venue. Click Next to open your first flyer, or click any flyer. No flyers yet? Make one with New flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-send-venue"]',
      title: "Send to venue",
      body: "On a flyer for a venue, Send to venue puts the finished flyer (the same as the PNG) in that venue's portal, with an optional note. Send again to update it, or remove it from the portal.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/dj-dashboard/flyers/*",
      title: "What the venue sees",
      body: "A Flyers section in their venue portal, where they view and download each flyer as PNG or JPEG. The flyer stays editable here; later edits don't change their copy until you send again."
    }
  ],
  "2026-11-15-flyers-linked-to-events": [
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-tpl-activate"]',
      title: "Activate a template",
      body: "Make a published template the starting point for everyone, one venue, or one event. New flyers start from it; drafts change only if you choose, and exported flyers never do."
    },
    {
      path: "/admin/flyers",
      target: '[data-tour="flyer-art-library"]',
      title: "DJ cutouts and name logos",
      body: "Each DJ's cutouts and name logos live in the Art library. Next opens it."
    },
    {
      path: "/admin/flyers/assets",
      target: '[data-tour="flyer-lib-dj"]',
      title: "Choose a DJ's library",
      body: "Pick a DJ to see their images. Approve cutouts and name logos and choose the preferred one, which fills their slot on flyers."
    },
    {
      path: "/admin/flyers/assets",
      target: '[data-tour="flyer-reuse"]',
      title: "Add from existing images",
      body: "Copy template art or another DJ's images into this DJ's library as a cutout, name logo or photo, with no re-uploading. This button shows once you've picked a DJ."
    },
    {
      path: "/dj-dashboard/flyers",
      target: '[data-tour="flyer-design-link"]',
      title: "Open a flyer",
      body: "Now the flyer editor. Click Next to open your first flyer, or click any flyer. No flyers yet? Make one with New flyer.",
      follow: '[data-tour="flyer-design-link"]'
    },
    {
      path: "/dj-dashboard/flyers/*",
      target: '[data-tour="flyer-tab-event"]',
      title: "Event tab",
      body: "Choose the event (filter by venue), which DJ fills each photo and name-logo slot, and switch template. Linked layers say “Linked to the event”; change one by hand and it says “Overridden”, with Reset to event data. Nothing here changes the event or a DJ's profile.",
      waitHint: "Open any flyer to continue."
    },
    {
      path: "/admin/events",
      target: '[data-tour="project-link"]',
      title: "From the event page",
      body: "Every non-wedding project has a Flyer card. Click any project that isn't a wedding to continue."
    },
    {
      path: "/admin/events/*",
      target: 'a[href$="?tab=Details"]',
      title: "Details tab",
      body: "The Flyer card is on the project's Details tab. Click Next to open it.",
      follow: 'a[href$="?tab=Details"]',
      waitHint: "Open any project that isn't a wedding to continue."
    },
    {
      path: "/admin/events/*?tab=Details",
      target: '[data-tour="event-flyer"]',
      title: "Flyer card",
      body: "Set this night's drink specials (or use the venue default), pick a template just for this event, and start a flyer that's already linked to it.",
      waitHint: "Open the Details tab to continue."
    }
  ],
  "2026-11-11-inquiry-security": [
    {
      path: "/admin/security",
      title: "Inquiry Security",
      body: "Website booking requests now wait for the client to confirm their email before they become a lead. This page shows what's waiting, what was caught as spam, and every decision your team made."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-stats"]',
      title: "The numbers at a glance",
      body: "Needs review is the one to watch: requests that looked unusual and are waiting on a person. Pending verification means the client hasn't clicked their confirmation email yet."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-tabs"]',
      title: "Sort requests by where they are",
      body: "Switch between Needs review, Pending verification, Spam, Verified and Archived. The number beside each tab is how many are in it."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-list"]',
      title: "Each request",
      body: "Name, email, event type and date, plus plain-English reasons when a request was flagged, such as the same message sent from several addresses."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-actions"]',
      title: "What you can do",
      body: "Approve turns it into a lead now (if the client never confirmed, that's recorded with your name). Spam hides it, Restore brings it back, Resend emails a new confirmation link, and Block pauses that email or visitor for 1 hour to 30 days."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-blocks"]',
      title: "Blocked activity and temporary blocks",
      body: "See how many attempts were stopped by the spam check or the rate limits, and lift any temporary block early with Unblock."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-staff"]',
      title: "Who has office access",
      body: "Every owner, admin and manager, and whether they've set up two-factor. Roles are now set only in Supabase, so nobody can give themselves access."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-history"]',
      title: "Security history",
      body: "Every approval, spam mark, block and override, with who did it and when."
    },
    {
      path: "/admin/security",
      target: '[data-tour="sec-2fa"]',
      title: "Turn on two-factor",
      body: "Protect your login with a 6-digit code from an authenticator app. Click Next to open the setup page.",
      follow: '[data-tour="sec-2fa"]'
    },
    {
      path: "/admin/security/two-factor",
      target: '[data-tour="sec-2fa-setup"]',
      title: "Set it up in a minute",
      body: "Scan the QR code with Google Authenticator, 1Password or Authy and enter the code. Add a second device as a backup so you can't get locked out."
    }
  ],
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
      { title: "Add your songs", body: "Upload songs opens a Music Pool-style drop zone (files or a whole folder), or pick from the Music Pool. Play all plays the crate." },
      { title: "Your songs left here", body: "Up to 10 songs per DJ per crate, by upload or from the Music Pool. DJs can remove only their own songs." },
      { title: "The songs in this crate", body: "Laid out like the Music Pool: play, title and artist, who added it, BPM and key." },
      { title: "Top diggers in this crate", body: "Who added the most. Fill it to 25 for a Complete ribbon." }
    ]
  },
  "2026-11-11-crate-upload": {
    url: `${MEMBERS}?dctour=crate-challenge`,
    steps: [
      { title: "Open any crate", body: "Members → Venue Curator → Crate Challenge, then click an open crate." },
      { title: "Add your songs", body: "Upload songs opens a drop zone just like the Music Pool: drag in audio files or a whole folder, or browse. Each file is analyzed for BPM, key and energy, saved to the Music Pool and added to the crate under your name." },
      { title: "Your songs left here", body: "Up to 10 songs per DJ per crate. Dropping files anywhere on an open crate's page works too." },
      { title: "The songs in this crate", body: "Play button, title and artist, who added it, BPM and Camelot key, laid out like the Music Pool. Play all plays the whole crate." }
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
