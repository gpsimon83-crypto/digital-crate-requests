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
    id: "2026-11-28-echo-colour",
    date: "2026-11-28",
    area: "Members area",
    title: "Colour for every Echo",
    summary: "Every Echo effect can now be coloured. Make the copies solid colour shapes, keep the photo but colour it, run a gradient from the nearest copy to the furthest, add a glow, or set Blend to Screen or Add so the echoes light up on dark flyers.",
    bullets: [
      "Copies are: The photo, The photo coloured, or Solid colour (Mirror, Zoom, Orbit, Slice and Long Exposure included)",
      "Colour gradient across copies: nearest in Colour, furthest in Second colour",
      "Glow works on every echo, in the copies' colour",
      "Blend: Screen or Add (neon glow) for dark backgrounds",
      "The same options are in Animate's Echo tab; echoes you've already made look the same"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open your flyers" }
  },
  {
    id: "2026-11-27-photo-echo",
    date: "2026-11-27",
    area: "Members area",
    title: "Echo effects for DJ photos",
    summary: "A new Echo category in Effects puts copies of a photo behind it: Silhouette Trail, RGB Echo, Outline Echo, Mirror Echo, Zoom Echo, Orbit Echo, Slice Echo and Long Exposure. The sharp photo stays on top, the echoes can reach past its frame, and every setting can be changed. In Animate, the same eight are in an Echo tab and move: trails stretch, outlines ripple out, orbits circle.",
    bullets: [
      "Effects → pick a photo → Add an effect → Echo. Each card shows the echo on the same sample DJ and background, so they're easy to compare",
      "Silhouette Trail and Outline Echo follow the subject's outline: use a cut-out photo (transparent background) or a layer mask",
      "Change copies, spacing, direction, colours, glow and more; untick \"Sharp original on top\" to show only the echoes",
      "Works with a look too (an echo of a Neon Duotone photo is duotone), and Remove clears both",
      "Animate → Echo: starts from the echo the photo already has. Strength is how much it moves, and frame one is the still flyer",
      "The editor, the PNG / JPEG export and the video all draw echoes with the same code"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open your flyers" }
  },
  {
    id: "2026-11-27-animate-image-effects",
    date: "2026-11-27",
    area: "Members area",
    title: "New photo effects, beat markers and speed ramps in Animate",
    summary: "The Flyer Animator has six new image effects, a beat grid to fire effects on the beat, and speed ramps, freezes and motion blur for each layer. Every photo effect card now shows the real effect on the same sample DJ portrait, and clicking a card shows Original / Effect on your own layer before you add it.",
    bullets: [
      "New: RGB Slice Glitch (a short burst that settles), Refraction (angled glass bands), Double Exposure (a club or venue photo inside the DJ cutout, with a face fade), Film Burn (from any edge, can sit behind your event details), Occlusion Reveal (text slides out from behind the DJ cutout) and Prism Sweep",
      "VHS Scanlines now has tracking rolls, jitter and signal tearing (subtle by default; older flyers look the same)",
      "Beat markers: add them with the Marker button or press M while playing, or set a BPM / Tap tempo. Any effect can play on markers or every N beats, with an offset and length",
      "Layer timing: Freeze here, Slow-mo here and Speed up here, plus motion blur. Scrubbing and the exported video match frame for frame",
      "Four new sample DJ cutouts and four backgrounds are in Art → Built-in (Assets in the Template editor); each one goes on as its own layer"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open your flyers" }
  },
  {
    id: "2026-11-24-animate-templates",
    date: "2026-11-24",
    area: "Members area",
    title: "Animate flyer templates too",
    summary: "The Animate button is now in the Flyer Template editor as well as the Flyer Creator. Motion you add to a template is saved for that size and published with it, so every new flyer made from the template starts already animated. Each flyer keeps its own copy, so DJs can still change it, and editing the template later never changes flyers already made.",
    bullets: [
      "Flyer Template (Admin → Flyers): the master layout with placeholders, in story / portrait / square, published and shared with DJs",
      "Flyer Creator (Flyers): a real flyer made from a template for one night, with the details filled in",
      "Animate on a template saves motion per size (switch size in the editor, then Animate again for that size)",
      "Publish the template to send its motion out; new flyers start with it",
      "Template previews show the sample wording (or the booking you chose to preview with), never raw {{placeholders}}; moving or duplicating layers in Animate keeps the template's placeholders",
      "Videos exported from a template download straight away (export history is kept on real flyers)"
    ],
    link: { href: "/admin/flyers", label: "Open Flyer Templates" },
    action: "Run supabase/migrations/0071_flyer_template_animation.sql in Supabase so templates can save and publish motion."
  },
  {
    id: "2026-11-23-flyer-animator",
    date: "2026-11-23",
    area: "Members area",
    title: "The Flyer Animator: new layout, glitch effects, keyframes and video exports for every size",
    summary: "Animate now opens as the Flyer Animator: Layers on the left, your flyer in the middle, the Motion Library and Effect Controls on the right, and a full timeline underneath. It brings real glitch effects, keyframes, Story / Portrait / Square videos and an export list you can come back to.",
    bullets: [
      "Glitch effects that each behave differently: Digital Slice (hard slices jump in short bursts), RGB Signal (colour channels pull apart and the picture bends), Analog VHS (steady tape look with tracking tears), plus Film Grain, Text Shine Sweep and Masked Reveal",
      "Every glitch has strength, bursts per loop, burst length, slices, max move, RGB split, noise and seed; event details and faces stay readable",
      "Whole-layer moves now work on photos and logos too: Soft Fade, Slide & Return, Gentle Float, Slow Zoom & Return, Scale Pulse",
      "Effect Controls: Strength, Speed, Start offset (seconds) and Loop mode (repeat or ping-pong)",
      "Timeline: a coloured bar per layer (drag its ends for when it's on screen), keyframes for position, size, turn, opacity and effect strength, snapping, zoom, frame stepping, lock, solo",
      "Export video: Story, Portrait and Square from one design (fill or fit, never stretched, with the apps' safe area shown), tracked with progress, cancel, retry and Download all; finished videos are kept for 30 days"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open Flyers" },
    action: "Run supabase/migrations/0070_flyer_render_jobs.sql in Supabase to keep export history and finished videos. Without it, exports still work and download straight away."
  },
  {
    id: "2026-11-23-animate-layers-undo",
    date: "2026-11-23",
    area: "Members area",
    title: "Animate: move and rename layers, see each effect on your text, undo anything",
    summary: "In Animate you can now arrange the flyer itself: click any layer to drag, resize or turn it, rename it, and change what sits in front. Effects in the library preview live on the layer you picked, and every change (motion or layout) can be undone, removed or swapped.",
    bullets: [
      "Click a layer on the flyer: drag to move, handles to resize or turn, arrow keys to nudge (Shift for 10 px); Front / Back and the arrows change the stacking order",
      "Rename a layer in its card, or double-click its name in the Advanced layer list",
      "Point at an effect in the Motion Library to watch it play on that layer before adding it; each card shows your own text and says what the effect does",
      "Undo now says what it will undo (\"Undo: Move DJ name\"), covers motion and layer changes alike, and works with Ctrl/⌘ Z",
      "Change an effect in place with its dropdown, remove one with ×, remove a whole motion style, or Remove all motion from the new \"Motion on this flyer now\" list",
      "Layer moves and renames apply to the flyer design too, and are saved with it"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open Flyers" }
  },
  {
    id: "2026-11-23-flyer-animate",
    date: "2026-11-23",
    area: "Members area",
    title: "Animate: turn a flyer into a looping video (MP4)",
    summary: "A new Animate button in the flyer editor adds motion to the flyer's own layers and exports a seamless looping MP4 for Stories and posts. The flyer itself is never changed: motion sits on top, and the PNG and PDF exports stay exactly as before.",
    bullets: [
      "Simple: pick a motion style (Clean Promo, Club Energy, Luxury Wedding or Vintage Print), preview it, set Subtle, Balanced or High Energy, then export",
      "Keep event details readable (on by default): venue, date, time and address stay visible and steady",
      "Advanced: choose motion per layer from the library (text, photos, backgrounds, overlays), stack up to 4, tune strength, cycles, timing, colour and seed, copy and paste motion, save your own presets, mute or solo layers, scrub the timeline",
      "Check loop plays it 3 times and shows the last and first frame side by side",
      "Export: 6, 8, 10 or 15 seconds at 30 fps, H.264 MP4 with no sound, made frame by frame on your device (keep the tab open; about 30 seconds for an 8-second story)",
      "Saved on the flyer, so it's there when you come back"
    ],
    link: { href: "/dj-dashboard/flyers", label: "Open Flyers" },
    action: "Run supabase/migrations/0069_flyer_animation.sql in Supabase so motion settings are saved. Until then you can still preview and export."
  },
  {
    id: "2026-11-23-north48-template",
    date: "2026-11-23",
    area: "CRM",
    title: "New flyer template: North 48 – Blackout, plus curved text",
    summary: "A story-size flyer in black and cream with orange accents: NORTH 48 on an arch, a stacked date, BLACKOUT WEDNESDAY and the DJ name on an orange brush stroke. Every word is its own editable layer, and text layers can now curve.",
    bullets: [
      "Fills in from the booking: venue name (on the arch), weekday, month, day, time, the DJs, drink specials (hidden on nights without any) and the venue address",
      "The title lines and DJ name keep their slight tilt and the month runs up the side; move, resize or reword any of them",
      "New Curve setting on every text layer (Text → Curve): bend any line into an arch or a smile, in the editor and the exports",
      "Shared with all DJs to start; change it with the Share button on the template"
    ],
    link: { href: "/admin/flyers", label: "Open Flyer Templates" }
  },
  {
    id: "2026-11-23-flyer-template-sharing",
    date: "2026-11-23",
    area: "CRM",
    title: "Share flyer templates with all DJs, chosen DJs, or keep them office-only",
    summary: "Each flyer template now has a Share button: All DJs, Chosen DJs (tick who), or Office only. DJs see the templates shared with them in a new Templates from the office gallery on their Flyers page, with new ones marked.",
    bullets: [
      "Flyer Templates: the button on each card shows who gets it (All DJs, 3 DJs, Office only); click it to change",
      "DJ portal → Flyers: Templates from the office, newest marked New; picking one opens New flyer with it selected",
      "A DJ can't start from or switch to a template that isn't shared with them; staff always see every template",
      "A template you Activate for a venue or event still starts that venue's or event's flyers",
      "Existing templates stay shared with all DJs until you change them"
    ],
    link: { href: "/admin/flyers", label: "Open Flyer Templates" },
    action: "Run migration 0068_flyer_template_sharing.sql in Supabase to turn on sharing choices."
  },
  {
    id: "2026-11-23-questionnaire-recommended-pricing",
    date: "2026-11-23",
    area: "CRM",
    title: "Questionnaire answers now recommend a package and price, and Bars & Nightlife has packages",
    summary: "Each project shows the Services package that fits the client's answers, with the add-ons they need and an estimated total. Weddings use Wedding Basics; every other event gets a new Event Basics questionnaire. Only the office and the project's DJ see it, never the client.",
    bullets: [
      "Bars & Nightlife: Bar Night – House Sound ($500, 4 hours, $275 flat DJ payout) and Bar Residency (quoted, payout set per date)",
      "Project → Details → Recommended package: the best fit and two alternatives, with add-ons priced (or Included when the package already has them) and an estimated total",
      "Hours come from their start and end times (plus ceremony and cocktail hour for weddings); a shortfall is flagged",
      "Event Basics (date, venue, times, guests, mics, uplighting, clean music, setup) for parties, school, corporate and bar events: create and copy the link right on the card",
      "DJs see the same recommendation on their project page and can send the questionnaire link; they never see payout or company share",
      "Use this package sets the project's package, so a new DJ offer suggests its payout"
    ],
    link: { href: "/admin/events", label: "Open Projects" },
    action: "Run migration 0067_bar_packages_event_basics.sql in Supabase to add the bar packages and Event Basics."
  },
  {
    id: "2026-11-23-services-catalog-dj-offers",
    date: "2026-11-23",
    area: "CRM",
    title: "Services by category, DJ payout rules and gig offers, and default project photos",
    summary: "Services now has event-category tabs with package cards you can edit, reorder, move between categories and turn off. Each package has an admin-only DJ payout rule, and projects can send a DJ an offer with their exact payout, which they accept in the DJ portal. Clients see the catalog on a new Services page.",
    bullets: [
      "New and revised packages: Private Party DJ / Plus / Signature, School Dance / Prom & Homecoming / Large School Event, Corporate Event / Corporate Gala. Weddings, Bars & Nightlife and Live Band + DJ keep their prices",
      "Live Band + DJ is one record shown in every category it's in, at Starting at $6,500 with a confirmed quote before payment",
      "Monograms and logo displays are off for new bookings; anything already quoted, booked or invoiced with them is unchanged",
      "Edit Package: name, description, coverage, pricing type (fixed, starting at, request a quote), price, features, categories, included add-ons, and the DJ Payout with a preview of the DJ payout and DCDJs share",
      "Projects → Details → DJ offer: the package's rule suggests the payout (55% standard, 65% DJ-sourced, flat for bar nights). Change it, then send. DJs see Your Payout, the date, times, equipment and paid extras under Gig Offers, never the client price or split",
      "A change after a DJ accepts sends a revised offer; the accepted one stands until they accept again, and every version is kept",
      "Settings → Default project photo, and Customize Portal on a project, let you pick one of 15 banner photos",
      "Requests from the Services page remember the package at the price shown, so later edits don't change them"
    ],
    link: { href: "/admin/services", label: "Open Services" },
    action: "Run migration 0066_services_catalog_payouts.sql in Supabase to turn this on. Then fill in Elite's features on the Services page and check which categories your existing packages landed in."
  },
  {
    id: "2026-11-23-edit-everything",
    date: "2026-11-23",
    area: "CRM",
    title: "Edit what you've entered: gear, contacts, project names and more",
    summary: "Anything you can add you can now also change. Equipment items, contact details, project names and details, payouts, expenses and crate templates all have Edit. Equipment also lets you add an item under your own name, like \"Rev 7 controller\", in any category you type.",
    bullets: [
      "Equipment: New item takes any name and a category from the list or one you type (for example \"controller\"). Click a row, or ⋯ → Edit, to change it",
      "Contacts: Edit contact on the contact page changes name, email, phone, partner, address and status. Projects have the same Edit beside the client",
      "Projects: ⋯ → Rename… in the list, and Project Details now edits the name, event type and guest count",
      "Finance: a pencil beside each payout and expense edits the amount, note, category or date",
      "Crate templates: Edit opens the template in the form above the list",
      "The office only saves the fields each form shows, so nothing else on a record can be changed by accident"
    ],
    link: { href: "/admin/equipment", label: "Open Equipment" }
  },
  {
    id: "2026-11-23-projects-bulk-equipment-finance",
    date: "2026-11-23",
    area: "CRM",
    title: "Select several projects at once, a shorter Equipment page, and Finance on the grid",
    summary: "Projects has a checkbox on every row with bulk Move to stage and Delete, and a ⋯ menu per project. Equipment's setup rules show one space at a time as short cards. Finance puts its numbers, balances, payouts and expenses in cards side by side.",
    bullets: [
      "Projects: tick rows (or the header box for everything matching your search), then Move to a stage or Delete. Deleting asks first, and a project with payments is kept and named",
      "Inquiries: tick inquiries to Decline or Delete them together",
      "Long spam titles are cut to two lines",
      "Equipment: setup rules are tabbed by space with counts; each rule is a summary card and Edit opens it in a side panel. Deleting a rule now asks first",
      "Finance: five summary tiles, Outstanding balances, then DJ Payouts and Expenses side by side. Deleting a payout or expense now asks first, and expense dates no longer show a day early"
    ],
    link: { href: "/admin/events", label: "Open Projects" }
  },
  {
    id: "2026-11-22-manage-djs-cards",
    date: "2026-11-22",
    area: "CRM",
    title: "Manage DJs is now a grid of profile cards",
    summary: "The roster shows each DJ's photo, name and portal access on a card, with counts, search, filters and sorting on top. Add DJ opens a side panel.",
    bullets: [
      "Portal access is read from the DJ's real login: Portal active, Not connected, and separate Invite sent, Setup link sent and Access disabled states, so an unaccepted invite no longer counts as active",
      "Counts and filters use the same words: Total DJs, Portal active, Not connected (plus Pending or blocked when there are any)",
      "Search by name, sort A–Z (by the name after \"DJ\"), Z–A or by portal access",
      "The camera button opens Quick edit at the photo (upload and framing); the ⋯ menu has Quick edit, View as, Copy setup link and Remove from roster (with its confirmation)",
      "Photos are framed head-and-shoulders on the card, with their own Card photo setting in Quick edit (separate from the event banner framing); no photo shows their initials"
    ],
    link: { href: "/admin/djs", label: "Open Manage DJs" }
  },
  {
    id: "2026-11-22-portal-grid-and-menus",
    date: "2026-11-22",
    area: "Members area",
    title: "New DJ menu, four new DJ pages, and roomier page layouts",
    summary: "The DJ portal menu is regrouped (Overview, My work, Resources, Account) with an Update Availability button on top, and pages now sit on a shared grid instead of long full-width strips. The client planning page (the portal's Music tab) puts related cards side by side.",
    bullets: [
      "New DJ pages: Tasks & Planning, Messages, Meetings and Documents & Library. They show the DJ's own bookings' tasks, emails, meetings and files, the same ones as on each booking",
      "My Gigs is Bookings, Recurring gigs and Leads with tabs; Calendar & Availability and Update Availability open the members-area Availability tab",
      "DCDJs Academy opens the members-area Academy in a new tab (it doesn't share logins or progress with the CRM)",
      "Admins linked to their own DJ profile get Admin View / DJ View in the menu: DJ View is the portal with their own gigs and pay",
      "Admin menu regrouped in the agreed order. What's New now sits with Notifications (tabs on both pages)",
      "Client Music tab: Must-Play and Do-Not-Play side by side, Notes for your DJ beside the planning checklist, then Vendor Contacts, Venue & Load-in and Day-of Logistics in three cards. One Save changes for all of them; the wedding plan still waits for the deposit",
      "DJ brief: the client's notes are now labelled Client notes"
    ],
    link: { href: "/dj-dashboard", label: "Open the DJ portal" }
  },
  {
    id: "2026-11-22-event-calendar-redesign",
    date: "2026-11-22",
    area: "CRM",
    title: "A bigger event calendar with a day panel",
    summary: "The dashboard calendar now runs the full width: a month grid with each day's events written in, and a panel beside it with every event on the day you pick. It's the same calendar on DJs' Calendar pages.",
    bullets: [
      "Each day shows up to two events, then \"+N more\". Booked is a lime dot, Inquiry an amber ring, Away a grey dot",
      "Pick a day to see its events with times, DJ, venue and View event. Picking a day from next or last month switches to that month",
      "Agenda switches to a list of the month's events, in order",
      "Keyboard: arrow keys move between days, Page Up/Down change month",
      "On a phone the grid shows dots and counts, with the day's events underneath"
    ],
    link: { href: "/admin", label: "Open the dashboard" }
  },
  {
    id: "2026-11-21-dj-calendar-dates",
    date: "2026-11-21",
    area: "Members area",
    title: "DJs see all their dates from the DCDJ Google Calendar",
    summary: "A DJ's Calendar page now loads each month as they page to it, with every entry on the shared Digital Crate DJs Google Calendar that names them, plus their bookings and venue nights. It reaches back a year and as far ahead as the calendar goes.",
    bullets: [
      "Settings → Google Calendar → DJ schedule calendar: pick the calendar the DJs write on (the DCDJ Calender). It's only read, and its entries don't block booking times",
      "An entry counts as the DJ's when its title names them, the way DJs write it: \"Young Wedding - Penny\", \"Penny out of town\", \"Gmo and penny shadow…\"",
      "\"Out of town\" notes show as Away (grey dot), not as gigs, and don't count toward gigs coming up",
      "\"Pull the whole calendar again\" re-reads every entry from a year ago onward; the regular sync keeps it current"
    ],
    link: { href: "/admin/settings", label: "Open Settings" },
    action: "Run migration 0065 in Supabase, then in Settings → Google Calendar choose the DCDJ Calender as the DJ schedule calendar and press Use this calendar."
  },
  {
    id: "2026-11-21-office-email-copies",
    date: "2026-11-21",
    area: "CRM",
    title: "DJs email clients from their own mailbox, with a hidden copy to the office",
    summary: "When a DJ emails a Digital Crate DJs client, a hidden copy (BCC) goes to one office address you set in Settings. Clients a DJ brought in through their own Leads page get no copy. Your own login can't be filled into a DJ's mailbox form any more.",
    bullets: [
      "Settings → Email copies: the address that gets the hidden copies. Leave it empty to send no copies",
      "Covers emails from a project's Activity tab and automation emails sent from a DJ's mailbox",
      "The DJ sees a line under the email box when a copy will go to the office",
      "Mailbox forms on DJ profiles no longer let the browser fill in your saved login, and View as never shows the mailbox form. Mailbox passwords stay encrypted and are never shown to anyone"
    ],
    link: { href: "/admin/settings", label: "Set the address" },
    action: "Run migration 0064 in Supabase, then add the office address in Settings → Email copies."
  },
  {
    id: "2026-11-21-dj-portal",
    date: "2026-11-21",
    area: "Members area",
    title: "The DJ portal gets a real dashboard",
    summary: "DJs now get a menu like yours (side rail on a computer, tab bar on a phone) and a home page in the same two layouts and themes: gigs coming up, what needs doing, earnings, My gigs from the Google Calendar, bookings, calendar and activity. DJs can also add their own leads.",
    bullets: [
      "Menu: Home, Notifications, Calendar, Bookings, Leads, Recurring gigs, Payouts, Flyer Creator, Services & pricing, Profile, Library. Each DJ can pick Modern Studio or Midnight Command and a site theme",
      "Numbers: gigs in the next 30 days, this week, open leads, payouts pending (and paid this year)",
      "Action hub: bookings to confirm, recurring gigs to confirm, recaps due, open tasks, leads",
      "Leads: a DJ adds a client's name, email, date and details. It comes to you like a website inquiry, already assigned to that DJ, and you get a notification. Quotes, contracts and payments stay with the office",
      "New pages: Calendar (bookings plus the shared Google Calendar), Recurring gigs list, Notifications",
      "See it yourself with View as on any DJ's page"
    ]
  },
  {
    id: "2026-11-21-view-as-dj",
    date: "2026-11-21",
    area: "CRM",
    title: "View as DJ, and account setup links",
    summary: "On any DJ's page: View as (name) opens the DJ dashboard exactly as that DJ sees it, read-only, with a green banner and an Exit button. Send setup link gives a DJ without a login a link that creates their account inside their existing profile.",
    bullets: [
      "View as DJ shows their bookings, payouts, profile, flyers and gigs. Nothing can be saved or changed while viewing; opening any admin page (or Exit) ends it. It lasts at most two hours",
      "Send setup link (DJs with No Login): Copy, Email or Text. The sign-up page says whose account it is, skips the name, and joins the login to that profile, so no duplicate DJ is made",
      "Sending again reuses the same unused link"
    ]
  },
  {
    id: "2026-11-21-my-gigs-invites",
    date: "2026-11-21",
    area: "CRM",
    title: "Your own gigs on the dashboard, and easier DJ invites",
    summary: "If you're an admin who also DJs, link your login to your DJ profile with \"This DJ is me\" on the DJ's page. Your dashboard then greets you by your DJ name and shows My gigs: your projects plus everything the shared Google Calendar has for you. Invite codes now have Copy, Email and Text buttons.",
    bullets: [
      "DJs → your profile → This DJ is me. Only works on a profile without its own login; Unlink undoes it",
      "My gigs (next four months): projects you lead or crew on, venue nights that name you, and other Google Calendar entries with your DJ name (or a calendar nickname from Venue Portals) in the title",
      "Invite Codes: Copy puts a ready message on your clipboard; Email and Text open your own mail or messages app with it written. The link fills in the code on the sign-up page"
    ]
  },
  {
    id: "2026-11-21-dashboard-layouts",
    date: "2026-11-21",
    area: "CRM",
    title: "New admin home: Modern Studio and Midnight Command",
    summary: "The admin home has two layouts to switch between. Modern Studio has the side menu, an action hub on the left and wedding and club photos with four metric cards. Midnight Command has a top menu, a photo hero with quick actions and a metric rail. Colors still come from your site theme.",
    bullets: [
      "Switch on the dashboard or in Settings → Site theme. Saved in this browser, and the period you picked stays when you switch",
      "Four live numbers: New leads, Pending contracts, Upcoming this week and Booked this year (with collected and still owed listed separately). Each opens the matching list",
      "Revenue: booked and collected side by side per month, every month in the period shown ($0 months included), with a period picker",
      "By event type: one bar per type with amount and share, from the same basis; empty types left out",
      "Action hub groups what needs you (assign DJs, reply to inquiries, contracts, balances, music plans) with counts that match the list each opens. Projects now has these filters too",
      "Upcoming events as a table with DJ photos and venue pictures (cards on phones), a month calendar you can click for a day's events, and recent activity",
      "Settings → Branding: the admin hero photo is the Weddings banner and hero; add a Club & Bar Nights photo and set where each photo is cropped"
    ],
    action: "Run migration 0063 (supabase/migrations/0063_admin_dashboard_banners.sql) in Supabase to add the club photo and banner crop settings. Until then the dashboard uses its built-in photos."
  },
  {
    id: "2026-11-21-site-themes",
    date: "2026-11-21",
    area: "CRM",
    title: "Site themes for the whole admin area",
    summary: "The project page looks (Charcoal & Brass, Slate & Electric Lime, School Dance, Ink & Brass Gala, Plum & Champagne, Classic Cream) now work across the main layout: sidebar, every admin page and pop-ups.",
    bullets: [
      "Pick one from Theme in the sidebar (above Sign Out), from Site theme in Settings, or from the bottom of the More menu on a phone",
      "Saved in this browser, and on before the page draws, so a dark look doesn't flash cream first",
      "Project pages still open in their event type's look while you're on them; the site look comes back when you leave",
      "Classic Cream is the original look"
    ]
  },
  {
    id: "2026-11-21-flyer-mask",
    date: "2026-11-21",
    area: "CRM",
    title: "Mask tool for flyer photos",
    summary: "Select a photo or PNG layer and click Mask (next to Photo effects) to hide parts of it, bring them back, or fade it into the artwork. Nothing is cut from the photo, so you can change it any time.",
    bullets: [
      "Hide and Restore brushes with size, hardness and opacity ([ and ] change the size). Restore only brings back what's in the file, so a PNG cut-out stays cut out",
      "Fade: linear or radial, with handles to drag and Reverse. Add it before or after brushing; one never undoes the other",
      "Edge feather, Show hidden (tints what's hidden) and Hold: original to compare",
      "Each stroke is its own undo step while masking; Apply makes the whole mask one undo step, Cancel goes back to how it was, Reset clears the mask",
      "The mask moves, turns, flips, crops and resizes with the layer, saves with the flyer, copies with Duplicate and templates, and exports exactly as shown",
      "Works with mouse, touch and pen; on a phone the mask controls sit under the canvas and two fingers still zoom"
    ]
  },
  {
    id: "2026-11-20-dj-night-template",
    date: "2026-11-20",
    area: "CRM",
    title: "New flyer template: DJ Night Party",
    summary: "Red and yellow on deep green, a big DJ NIGHT title, script Party and a concert photo with a soft fade. Portrait (1080×1350) and story (1080×1920).",
    bullets: [
      "Every piece is its own layer: 16 text fields, the background, border and panels as shapes, and the concert photo as a picture you can replace",
      "Fills itself from the flyer's event: venue name (top line and venue panel), street and city, day, month, year, start time, and the DJ lineup",
      "Text keeps the designer's wide, stretched look and shrinks to fit when a venue or DJ name runs long",
      "New text controls for any template: Stretch (wider or narrower letters), plus placeholders for Year, DJ lineup, Venue street and Venue city, state, ZIP"
    ]
  },
  {
    id: "2026-11-20-effects-any-layers",
    date: "2026-11-20",
    area: "CRM",
    title: "Effects on any layers, or all of them",
    summary: "The flyer editor's Effects tab now starts with Apply to: tick the layers you want (photos, text, shapes, logos, backgrounds) or Include all layers.",
    bullets: [
      "One look on several layers at once, applied together: one Apply, one undo step",
      "Text and shapes take effects too (a Red Strobe title gets echoes, a Halftone box gets dots)",
      "Each layer shows its current look in the list; Remove clears it from the ticked layers",
      "Layers the template keeps styled are greyed out"
    ]
  },
  {
    id: "2026-11-20-flyer-photo-effects",
    date: "2026-11-20",
    area: "CRM",
    title: "Photo Effects for DJ photos",
    summary: "A new Effects tab in the flyer editor: pick a photo and choose from 11 looks, previewed on your own photo, with a strength slider and controls for each look.",
    bullets: [
      "Looks: Emerald Editorial, Neon Duotone, Silver Noir, Golden Hour, Xerox Grit, Halftone Pop, VHS Afterhours, Direct Flash, Midnight Blue, Vintage Print and Red Strobe",
      "Each look shows only its own controls (light, color, texture, cutout and fade). Hold View original to compare, Reset to remove, then Apply or Cancel; one Apply is one undo step",
      "Effects touch only that photo. Cutouts stay cut out: edge light, subject shadow and echoes follow the subject's outline (and are skipped on photos without a transparent background)",
      "Edge light is drawn from the cutout's outline; it imitates a rim light rather than relighting the photo",
      "Save a look as your own preset and use it on any flyer",
      "The photo itself is never changed. Replacing the photo keeps its place, size and effect; PNG and JPEG exports (and PNG 2×) match the editor, with transparency kept in PNGs"
    ],
    action: "Run migration 0062_flyer_effect_presets.sql in Supabase to save custom presets (effects work without it)"
  },
  {
    id: "2026-11-20-recurring-bar-nights",
    date: "2026-11-20",
    area: "CRM",
    title: "Recurring Bar / Club bookings",
    summary: "A Bar / Club project can now be a recurring night (weekly, some weeks of the month, or picked dates), with every date's DJ, recap and money on one page.",
    bullets: [
      "On a Bar / Club project, click Make it recurring: name the night, pick the schedule and hours, and dates are created four months ahead (and keep rolling)",
      "New page layout: the venue photo, venue name and night, a Next gig strip with Assign DJ / View assignment / Open gig, and Coverage, Venue Brief, Recaps and Financials tabs. Project records (Activity, Files, Tasks, Notes, Details) are under Project records",
      "Click any date to assign a DJ, change hours, add notes for that night, cancel it or mark it played. Changes ask: This gig only, or This and future gigs. Past gigs, one-night swaps and confirmed DJs are never overwritten",
      "DJs confirm or decline each date in My Bookings, see the venue brief plus that night's notes, and after the gig answer three quick recap questions (and can flag an issue for staff)",
      "Pin advice from a recap to the venue brief; the dated recap stays as written",
      "Financials (finance staff only): each month's gigs scheduled, played and canceled, DJ coverage, what the venue still owes and the payouts still owed. Rates and negotiation notes never reach the venue or client portal",
      "New look: Slate & Electric Lime (the Bars & clubs theme in the Theme menu)"
    ],
    action: "Run migration 0061_recurring_venue_gigs.sql in Supabase"
  },
  {
    id: "2026-11-20-remove-payments",
    date: "2026-11-20",
    area: "CRM",
    title: "Remove a payment",
    summary: "Payments you recorded by hand can now be removed for good from a project's Financials tab.",
    bullets: [
      "Click Remove on the payment, then Remove permanently. It leaves the history and the balance right away",
      "Works on voided entries too, so a mistake doesn't have to stay on file",
      "Can't be undone; the activity log keeps a record of what was removed and by whom",
      "Card payments made in the portal can't be removed here; refund them in Stripe",
      "Want to keep a record instead? Void still crosses it out and stops it counting"
    ]
  },
  {
    id: "2026-11-19-record-payments",
    date: "2026-11-19",
    area: "CRM",
    title: "Record payments clients made outside the portal",
    summary: "On a project's Financials tab, Record a payment logs cash, check, Zelle, Venmo, Cash App, PayPal or bank transfer payments.",
    bullets: [
      "Enter the amount, date paid, what it was for (deposit, balance, other), how they paid, and an optional check number or confirmation and a team note",
      "It counts toward Paid so far and Balance due right away, everywhere: the project, the client portal, invoices, reports and reminders",
      "A deposit moves the project to Retainer Paid and ticks the Wedding Playbook's retainer task, just like a card payment",
      "Entered something by mistake? Void it with a reason. It stays in the history, crossed out, and stops counting. Card payments are refunded in Stripe instead",
      "The client sees the updated balance; your notes and voided entries stay internal"
    ],
    action: "Run migration 0060_manual_payments.sql in Supabase (payments already work without it; it adds the method, reference, note and void details)"
  },
  {
    id: "2026-11-19-wedding-playbook",
    date: "2026-11-19",
    area: "CRM",
    title: "Wedding Playbook in the Tasks tab",
    summary: "Every wedding's Tasks tab now walks the booking from inquiry to the thank-you: one Next up task, the work grouped by stage, and coaching on each step.",
    bullets: [
      "Next up at the top: the one task to do now, who owns it, when it's due, and a button to the right record",
      "Eight stages (Inquiry → After the wedding). Finished stages fold away; open a task for Your next move, a Coach's tip, and a Ready when checklist",
      "Tasks that depend on records finish themselves: proposal sent, contract signed, retainer paid, DJ assigned, questionnaire, music plan, equipment confirmed",
      "Judgment tasks stay open until someone marks them Ready. Mark waiting says what's missing and who needs to act",
      "If the venue, date, guest count or coverage changes after a task was reviewed, only the tasks that depend on it reopen, with the reason",
      "Due dates follow the wedding date; a date you set by hand stays put. Timing is editable in Settings → Wedding Playbook timing",
      "DJs see their own tasks on their project page, can ask the booking lead for extra coverage, overtime or a package change, and get a day-before brief built for a phone",
      "After the wedding: the DJ's recap feeds the thank-you draft; staff send review and referral notes through messages (each goes out once). An issue in the recap holds them until it's resolved",
      "Couples see their own steps in a planning checklist on the portal Overview",
      "Manual tasks still work as before"
    ],
    action: "Run migration 0059_wedding_playbook.sql in Supabase"
  },
  {
    id: "2026-11-19-details-equipment-plan",
    date: "2026-11-19",
    area: "CRM",
    title: "Project Details redesign and equipment recommendations",
    summary: "The Details tab is a tidy grid, and the Equipment card proposes the gear an event needs from its guest count, spaces and questionnaire answers.",
    bullets: [
      "Layout: Event Details, then Equipment, then Contract and Client notes side by side; Customize Portal on the right with Delete Project below it",
      "Event Details: event type, date, venue, guests, service and DJ at a glance. Budget range is no longer shown (still saved). Final amount shows the agreed total from an approved proposal or signed contract, otherwise “Not finalized”",
      "Equipment: what it's based on (e.g. 150 guests · indoors · ceremony in a separate space), the proposed setup per space (Reception audio, Ceremony audio, Cocktail-hour audio, Microphones), why each item, and how many are free that date",
      "Review recommendations: adjust items and quantities, then confirm. Nothing is assigned until you confirm; confirming again updates the same assignments; overbooking warns first (Assign anyway still works)",
      "If guests, venue, timing or setup answers change later, the card says what changed and asks for a review; your assignments stay put. Manual assigning still works",
      "Missing details are listed; the planning questionnaire now has a short Sound & Setup section (answers from Wedding Basics are pre-filled)",
      "Rules are configurable in Admin → Equipment → Setup rules: gear (an item or any in a category), quantity, guest ranges and other conditions"
    ],
    action: "Run migration 0058_equipment_setup_plans.sql in Supabase"
  },
  {
    id: "2026-11-19-portal-tab-grids",
    date: "2026-11-19",
    area: "CRM",
    title: "Client portal tabs: tidier side-by-side layout",
    summary: "The client portal's tabs no longer stretch every card across the whole screen.",
    bullets: [
      "Music: Must-Play, Do-Not-Play and Notes on the left; Vendor contacts and day-of logistics on the right, with each vendor's fields in a compact 2 × 2",
      "Contracts: the contract on the left, signing (or the signed date) on the right, staying in view while they read",
      "Forms: Planning questionnaire and Your booking side by side",
      "Documents: files as a grid of tiles",
      "Payments and single-message cards keep a readable width",
      "On phones everything stacks in one column, as before"
    ]
  },
  {
    id: "2026-11-18-client-portal-redesign",
    date: "2026-11-18",
    area: "CRM",
    title: "Client portal redesign and portal looks",
    summary: "Clients see a split event header, photo tabs, summary tiles, one clear next step, and a look that fits their event.",
    bullets: [
      "Split header: the event banner beside the title, date, venue, countdown and Build Your Package. A wedding with no banner shows the vineyard photo",
      "The banner, blurred and desaturated, sits softly behind the header and fades into the page (on/off and strength per event)",
      "Photo tabs: Overview, Conversations, Contracts, Forms, Documents, Music, Payments, each with its own photo",
      "Overview: Contract, Balance due and Music plan tiles; Your next steps with the next available action as the big button (e.g. Start planning opens the event details form), other steps showing Done, To do or Not open yet; Recent conversations; a compact Your DJ card with the DJ's photo (headphones photo when there's no DJ or photo) and whether they're confirmed",
      "Five looks: Ink & Brass, Indigo & Apricot, Pine & Copper, Slate & Electric Lime, Plum & Champagne. Assign one to each event type in Admin → Settings → Client portal looks, or pick one for a single event in the project's Customize Portal panel"
    ],
    action: "Run migration 0057_portal_themes.sql in Supabase to save per-event-type looks (per-event picks work without it)"
  },
  {
    id: "2026-11-18-project-page-themes",
    date: "2026-11-18",
    area: "CRM",
    title: "Project page redesign and themes",
    summary: "Projects open with a split header, a booking panel that shows the next step, Venue / Ceremony / Reception cards, and a look that fits the event.",
    bullets: [
      "Split header: banner photo beside the title, date, time, venue, event type, guests and service. Change or remove the photo with the buttons on it, as before",
      "Booking panel: the nine-stage rail, then the current stage, where things stand, what's next, and one button for the next step (e.g. Collect retainer, Start planning)",
      "Tabs on their own row; Venue, Ceremony and Reception cards below them (Venue and Event for non-weddings), filled from the event and Wedding Basics",
      "Theme menu (top right): Charcoal & Brass, Nightclub, School Dance, Ink & Brass Gala, Plum & Champagne or Classic Cream. Each event type opens in its own look; your pick is remembered for that project in your browser"
    ]
  },
  {
    id: "2026-11-18-wedding-basics-packages",
    date: "2026-11-18",
    area: "CRM",
    title: "Wedding Basics: package picks, the DJ's view, and links with the couple's name",
    summary: "The couple's answers now fill in their client record, show on the DJ's project page, and recommend the packages that fit, with the reasons.",
    bullets: [
      "New questions: reception end time, which parts of the day to cover (ceremony, cocktail hour, reception), where the ceremony is, indoors or outdoors, and what the setup spot is like",
      "Recommended for this couple: the best-fitting published wedding packages, priced with the extras their day needs. Guest count sets the speakers (1 extra for 101–200 guests, 2 for 201–300, 3 over 300; +1 outdoors), the ceremony adds ceremony sound and a mic, the cocktail hour adds cocktail-hour sound, a hard load-in adds setup time",
      "Send to client portal puts a recommended package, extras included, in their portal as a draft to review",
      "Fills the client's partner name and phone, married last name, and best way, days and times to reach them (shown on the project's Details tab), plus the event's end time",
      "When an answer differs from what's in the CRM, “Use their answer” updates it",
      "DJs see the same Wedding Basics card on their project page",
      "Links now read like cratesdjs.com/w/caroline-catlin-7k2pxq9mab and show as a “Wedding Basics · Digital Crate DJs” card in texts. Older links keep working"
    ],
    action: "Run migration 0056_wedding_basics_setup.sql in Supabase (after 0054 and 0055). Publish at least one wedding package in Admin → Packages to get package picks"
  },
  {
    id: "2026-11-15-wedding-basics-link",
    date: "2026-11-15",
    area: "CRM",
    title: "Wedding Basics questionnaire by text link",
    summary: "For wedding leads you can't email yet: send a private link (no login) with the 10 must-know questions, in the same one-question-at-a-time style as the planning questionnaire.",
    bullets: [
      "Event page → Wedding Basics questionnaire → Create link, then Text it or Copy",
      "Asks: wedding date, reception venue, reception start time, guest count, both full names, married last name, both phone numbers, best email. All required and checked (real date, phone, email)",
      "Staying in touch: best way to reach them (text, call, email, video, in person), best days, and best time of day for a call or meeting. Shown at the top of their answers on the event page",
      "Answers save as they go; once submitted they're locked. Use “Let them edit” to unlock, or “New link” to retire the old one",
      "On submit, empty event and client fields are filled in (date and time, venue, guests, couple name, client name, phone, email). Anything already in the CRM is kept, and differences are listed for you",
      "Edit the questions anytime in Admin → Questionnaires → Wedding Basics"
    ],
    action: "Run migrations 0054_questionnaire_links.sql, then 0055_wedding_basics_contact.sql, in Supabase"
  },
  {
    id: "2026-11-15-flyer-date-badges",
    date: "2026-11-15",
    area: "CRM",
    title: "Date badges for flyers",
    summary: "Five ready-made date badges (Orange Ticket, Luxury Gold, Torn Paper, Neon Panel, Bold Editorial) with live weekday, date and time that fill from the event.",
    bullets: [
      "Badges tab in the flyer and template editors. Each badge is a group: drag, resize, rotate, duplicate or lock it as one; click a piece again (or pick it in Layers) to move, turn or restyle just that piece",
      "The artwork is a normal image layer: replace it, crop, zoom, reposition or fade it; text stays live and is never baked into the picture",
      "Text fits on one line inside its box down to a smallest size; if it still doesn't fit you get a red outline in the editor and a warning before export",
      "Time shows the event's own start–end (or just the start). CLOSE appears only when you pick “Start – CLOSE” under Time shows",
      "New text settings: rotate around the box centre, position in the box, padding, and letter spacing in em that follows auto-fit",
      "New fonts: Barlow Condensed (with italics) and Cormorant Garamond; Montserrat Bold",
      "PNG 2× export for high-resolution files"
    ]
  },
  {
    id: "2026-11-15-flyer-shapes",
    date: "2026-11-15",
    area: "CRM",
    title: "Flyer shapes: box, rectangle, oval, circle",
    summary: "A new Shapes tab in the flyer and template editors adds boxes, rectangles, ovals and circles as layers.",
    bullets: [
      "Fill color or outline only, outline color and thickness, rounded corners, shadow, opacity and blend modes",
      "Box and circle keep their proportions when resized (switch it off to stretch them)",
      "Use a see-through box behind text as a panel, or an outline circle around a DJ photo",
      "In templates, shapes have the same DJ permissions as other layers (lock them in place or let DJs restyle them)"
    ]
  },
  {
    id: "2026-11-15-flyers-calendar-and-venue-portal",
    date: "2026-11-15",
    area: "CRM",
    title: "Flyers for calendar nights, live template previews, and sending flyers to venues",
    summary: "Start a flyer from any venue night on the Google Calendar, preview templates with a real night and real DJs, and send finished flyers straight to the venue's portal.",
    bullets: [
      "New flyer and the editor's Event tab now list Venue nights (Google Calendar) as well as bookings, with the DJ named on the calendar and the venue's usual hours",
      "Weddings no longer appear in flyer event lists",
      "Template editor: “Preview with” any venue, booking or calendar night, and pick DJ 1 and DJ 2 to see their cutouts and name logos (or their name when there's no logo). Preview only: nothing is saved into the template",
      "Send to venue: from the flyer editor, send the finished flyer (identical to the PNG export) to the venue's portal with an optional note; replace or remove earlier copies",
      "Venue portal: new Flyers section where the venue views and downloads each flyer as PNG or JPEG",
      "Flyers stay fully editable after sending; send again to update the venue's copy"
    ],
    action: "Run supabase/migrations/0053_flyer_calendar_nights.sql in Supabase (SQL editor) to turn on calendar-night flyers and sending to venues."
  },
  {
    id: "2026-11-15-flyers-linked-to-events",
    date: "2026-11-15",
    area: "CRM",
    title: "Flyers now follow their event",
    summary: "Pick an event and its venue, DJs, date, times and drink specials fill the flyer. They stay up to date until you change a field by hand.",
    bullets: [
      "New Event tab in the flyer editor: choose the event (filter by venue), which DJ fills each photo / name-logo slot, and switch template",
      "Every linked layer shows “Linked to the event” or “Overridden for this flyer”, with Reset to event data. Nothing on the flyer ever changes the event or a DJ's profile",
      "Activate a template for everyone, a venue, or one event (Admin → Flyer Templates → Activate). New flyers start from it; existing drafts change only if you choose to, and exported flyers never do",
      "Drink specials per night with a venue default: add the Drink specials block (heading, list, optional panel); it hides itself when a night has none. Edit them on the admin event page or in the flyer editor",
      "Several DJs per flyer: DJ 1, 2, 3 photo slots and name-logo slots. A DJ without a name logo gets their name in styled text",
      "DJ cutouts and name logos: upload them in the DJ's library; staff approve them and pick the preferred one (Art library → choose the DJ)",
      "Reuse images you already uploaded: in a DJ's library, “Add from existing images” copies template art (or another DJ's images) in as a cutout, name logo or photo, with no re-uploading",
      "Before export: missing DJs, photos, required content and text that doesn't fit are listed. Warnings never appear in the image",
      "Text can now wrap and shrink to fit its box with a smallest size, and positions show as % of the flyer"
    ],
    action: "Run supabase/migrations/0052_flyer_event_links.sql in Supabase (SQL editor) to turn on event links, activation and DJ cutouts."
  },
  {
    id: "2026-11-14-flyer-asset-library",
    date: "2026-11-14",
    area: "CRM",
    title: "Flyer images: folders, rename and delete",
    summary: "Staff can organise flyer template art and DJs can organise their own uploads: folders, names, types, search, and delete.",
    bullets: [
      "Staff: Admin → Flyer Templates → Art library. DJs: Flyer Creator → My uploads",
      "Select several images to move them into a folder, change their type, or delete them",
      "Before deleting an image that flyers or templates use, you're told where it's used and asked to confirm",
      "Inside the editor: search, images grouped by folder, and a delete button on each image",
      "Feather per side: fade just the top, just the bottom, top & bottom, left & right or any mix, each side with its own width, with a smooth or even fade",
      "Blend modes on every layer (Multiply, Screen, Overlay, Soft light and more): Screen drops the black out of sparks and light leaks, Multiply drops white out",
      "Recolor pictures: Solid color repaints a one-color logo (e.g. all-black) in any color, Tint colors a photo but keeps its shading, and “Remove white background” clears a logo's white box"
    ]
  },
  {
    id: "2026-11-13-flyer-svg-import",
    date: "2026-11-13",
    area: "CRM",
    title: "Flyer Creator: import layered SVG designs",
    summary: "Templates can now start from a layered SVG made in Illustrator, Figma, Canva or Inkscape. Every text stays a separate, editable layer.",
    bullets: [
      "Admin → Flyer Templates → “Or import a layered SVG”, or Assets → Import a layered SVG inside the template editor",
      "Text keeps its position, size, colour and spacing; Arial is matched with Arimo (same letter widths) and Arial Black with Archivo Black",
      "DJ name, month, day, time, title, venue and address can become placeholders filled from each booking, keeping the file's words as the fallback",
      "New “Shrink to fit on one line” text option so longer booking details don't wrap",
      "New “Soft edges (feather)” for pictures: fade the edges as a soft rectangle or an oval, in the editor and in exports",
      "New placeholders: {{event_month}}, {{event_day}}, {{event_weekday}}"
    ]
  },
  {
    id: "2026-11-13-flyer-creator",
    date: "2026-11-13",
    area: "CRM",
    title: "Flyer Creator for DJs",
    summary: "DJs can make event flyers in the DJ portal from templates staff publish. Their saved photo and DJ name fill in, and every piece stays its own editable layer.",
    bullets: [
      "Pick a template and a size (square 1080×1080, portrait 1080×1350, story 1080×1920); start from a booking to fill in the date, time and venue (the booking itself never changes)",
      "Move, resize and rotate every text box and image; fonts, outline, shadow, crop, flip, frames, snapping guides, layers with lock/hide/group, undo/redo",
      "Autosaves; reopen any time with all layers intact; export crisp PNG or JPEG at full size",
      "Staff build templates in Admin → Flyer Templates: upload backgrounds and overlays, add live text with placeholders like {{dj_name}}, choose what DJs may change, then publish",
      "Each DJ only sees their own flyers and uploads"
    ]
  },
  {
    id: "2026-11-13-venue-any-date",
    date: "2026-11-13",
    area: "CRM",
    title: "Venues can request a DJ for any date",
    summary: "Venue portals now have a clear \"Request a DJ for any date\" button under the banner, and venue calendar names match more spellings.",
    bullets: [
      "Pick any date up to a year out, add the occasion, drink specials and the DJ you'd like; marked as not guaranteed",
      "Requests notify Digital Crate DJs staff, the same as before",
      "Calendar matching ignores apostrophes and endings like \"Bar N Grill\" (Kyote's Bar N Grill finds \"Kyotes\")"
    ]
  },
  {
    id: "2026-11-13-amber-player",
    date: "2026-11-13",
    area: "CRM",
    title: "New audio player bar",
    summary: "Track previews in the DJ library now play in a redesigned full-width player bar, matching the members-area player.",
    bullets: [
      "Slim dark glass bar along the bottom with artwork, title and artist, and a large amber play/pause",
      "Seek and volume sliders that work with the keyboard; repeat this song",
      "Previous/next and a Recently played list for songs you've previewed this session",
      "Minimize to a small pill, or close to stop; on phones the extra controls are in the ⋯ menu"
    ],
    link: { href: "/dj-dashboard/library", label: "Open the library" }
  },
  {
    id: "2026-11-13-venue-locations",
    date: "2026-11-13",
    area: "CRM",
    title: "Venue portal: several locations on one page",
    summary: "A venue with more than one place (North 48 Cedarburg and Oconomowoc) now sees both side by side, each with its next nights and the DJs booked there.",
    bullets: [
      "Admin → Venue Portals → Manage → Locations: add each location, how it's written on the DCDJ calendar, and which one gets nights that just say the venue name",
      "The portal shows a card per location with its upcoming nights and the DJs playing there; tap a DJ for their profile",
      "Filter the whole page to one location (events, calendar, DJ lineup, specials) or show all",
      "Every night is tagged with its location; drink specials and DJ requests are saved per location",
      "Test calendar link shows how many nights each location gets"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" }
  },
  {
    id: "2026-11-13-venue-night-plans",
    date: "2026-11-13",
    area: "CRM",
    title: "Venue portal: drink specials & DJ requests",
    summary: "Venues can list drink specials for their nights and request a DJ for a night or event. Requests are clearly marked as not guaranteed, and staff are notified.",
    bullets: [
      "New “Drink specials & DJ requests” section lists upcoming nights; venues add specials, an occasion and a DJ request for each",
      "“Plan a date” lets a venue ask for a DJ on a night that isn't booked yet; holiday Request buttons open the same form",
      "Every request says it isn't a guarantee: DCDJs confirms based on DJ availability",
      "New requests ping every staff login in the bell (links to the venue) and email the venue's DCDJs contact",
      "Admin → Venue Portals → a venue shows everything the venue added under “From the venue”",
      "Specials show on event rows, in event details and on the calendar; the page background is now a soft blur of the venue's banner"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" }
  },
  {
    id: "2026-11-13-venue-lineup-scroll",
    date: "2026-11-13",
    area: "CRM",
    title: "Venue portal: scrolling DJ lineup",
    summary: "The DJ lineup now drifts right to left, 3–4 DJs at a time, and hovering a DJ enlarges their photo and shows their dates at the venue.",
    bullets: [
      "Shows 4 DJs at a time on desktop, 3 on tablets, 2 on phones; loops when there are more DJs than fit",
      "Pauses while you hover or tab through it; Pause, previous and next buttons included",
      "Hover (or keyboard focus) enlarges the DJ's card and photo and lists their upcoming dates at that venue",
      "Stays still for people who turn on reduced motion in their device settings"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" }
  },
  {
    id: "2026-11-12-venue-dashboard-redesign",
    date: "2026-11-12",
    area: "CRM",
    title: "Venue portal dashboard redesign",
    summary: "Photo metric cards that open what they count, a bigger events list, DJ profile cards and a calendar with day details.",
    bullets: [
      "Four photo cards (Upcoming nights, Assigned DJs, Pending confirmation, Holiday requests) with live counts; each whole card opens its section",
      "Upcoming events: date tile, DJ photo, event type, local time, status and View details (first three, then View all)",
      "DJ lineup: profile cards with real DJ photos (initials if none) and View profile",
      "Calendar beside the events: previous/next month, Today, pick a day to see its nights, status legend",
      "Holiday planning: Request emails your DCDJs contact for that night; holiday status comes from actual bookings",
      "Works on phones and tablets with large touch targets, keyboard navigation and reduced-motion support"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" }
  },
  {
    id: "2026-11-12-venue-calendar-djs",
    date: "2026-11-12",
    area: "CRM",
    title: "Venue Portals: calendar name dropdown and DJ names",
    summary: "Pick each venue's calendar name from a list, and tell the CRM each DJ's actual name so venue portals show it.",
    bullets: [
      "Venue Portals → Manage → Name on the DCDJ calendar: choose Casey Key, North 48 or Brass Boar's Den (or Other…)",
      "Venue Portals → DJs on the DCDJ calendar: choose Que, GMO, Makara, Bubblz, Omerta or Penny (or Other…) and type the actual name",
      "A night like “Casey Key / Que” shows on the Casey Key portal with the actual name you gave Que, plus their CRM photo when the names match",
      "Curly and straight apostrophes are treated the same, so “Brass Boar’s Den” on the calendar matches"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" },
    action: "Run migration 0047_calendar_dj_names in Supabase (SQL Editor) once, then add your DJs."
  },
  {
    id: "2026-11-12-venue-calendar-nights",
    date: "2026-11-12",
    area: "CRM",
    title: "Venue portals show their nights from the DCDJ calendar",
    summary: "Each venue's portal now pulls its nights from the shared DCDJ Google Calendar, with the DJ who's playing.",
    bullets: [
      "Matches calendar nights by the venue's “Names on the DCDJ calendar” (title or location), e.g. “Casey Keys”, “CK Fri”",
      "Shows on the venue's Dashboard, Calendar and DJ Lineup alongside CRM bookings",
      "Confirmed (green) once the DJ is confirmed in the members-area Availability tab; Pending (amber) while the DJ is only tagged or not set yet",
      "Uses the venue's regular night name for the day when you've set one, otherwise “DCDJs night”",
      "Venues only see the date, time and DJ: never the calendar title, notes or client details",
      "Admin preview shows a note if a venue has no calendar names yet or the calendar can't be reached"
    ],
    link: { href: "/admin/venues", label: "Open Venue Portals" },
    action: "For each venue, open Manage and add how it's written on the DCDJ calendar under “Names on the DCDJ calendar”, then Save."
  },
  {
    id: "2026-11-11-crate-upload",
    date: "2026-11-11",
    area: "Members area",
    title: "Crate Challenge: upload and drag-and-drop",
    summary: "DJs can now upload songs straight into a Crate Challenge crate, and every crate page looks like the Music Pool.",
    bullets: [
      "Open any crate and click ↑ Upload songs, or just drop audio files (or a whole folder) anywhere on the page",
      "Same drop zone and cards as the Music Pool: each file is analyzed for BPM, key and energy before you upload, and you can fix the title, artist and genre",
      "Uploaded songs are saved to the Music Pool and added to the crate under the DJ's name, so they count toward the 10-per-crate limit and the leaderboards",
      "Crate pages now use the Music Pool layout: blurred cover header, Play all, and song rows with play buttons, who added each song, BPM and Camelot key",
      "Locked crates and the per-DJ limit are enforced on the server; MP3, WAV, FLAC, M4A, OGG and AIF are accepted",
      "Fixed: crate and collection names with an & (like R&B After Dark) could show as \"&amp;\" after a DJ added a song"
    ],
    link: { href: "https://digitalcratedjs.com/members/#curator/crates", label: "Open the Crate Challenge", external: true }
  },
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
