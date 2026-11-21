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
