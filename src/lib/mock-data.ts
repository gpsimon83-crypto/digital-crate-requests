export const MOCK_EVENT = {
  eventCode: "CASEY-0704",
  title: "Casey Keys — Saturday Nights",
  venue: "Casey Keys",
  dj: { id: "dj-1", name: "DJ Omertà", photo: "" },
  startsAt: "2026-07-04T21:00:00-05:00",
  crowdEnergy: 78,
};

export const MOCK_REQUESTS = [
  {
    id: "r1",
    songTitle: "Blinding Lights",
    artist: "The Weeknd",
    votes: 24,
    boostCents: 500,
    status: "pending" as const,
    genre: "Synthpop",
    bpm: 171,
    crate: { owned: true, clean: true, remix: false, explicit: false },
  },
  {
    id: "r2",
    songTitle: "Levitating",
    artist: "Dua Lipa",
    votes: 18,
    boostCents: 200,
    status: "approved" as const,
    genre: "Pop",
    bpm: 103,
    crate: { owned: true, clean: true, remix: true, explicit: false },
  },
  {
    id: "r3",
    songTitle: "SICKO MODE",
    artist: "Travis Scott",
    votes: 31,
    boostCents: 1000,
    status: "pending" as const,
    genre: "Hip-Hop",
    bpm: 155,
    crate: { owned: false, clean: true, remix: false, explicit: true },
  },
  {
    id: "r4",
    songTitle: "Get Lucky",
    artist: "Daft Punk ft. Pharrell",
    votes: 12,
    boostCents: 0,
    status: "played" as const,
    genre: "Funk",
    bpm: 116,
    crate: { owned: true, clean: true, remix: false, explicit: false },
  },
];

export const MOCK_FEED = [
  { id: "f1", type: "request", text: "Someone requested Blinding Lights", time: "2m ago" },
  { id: "f2", type: "tip", text: "$10 tip sent to DJ Omertà", time: "4m ago" },
  { id: "f3", type: "boost", text: "SICKO MODE boosted +$5", time: "6m ago" },
  { id: "f4", type: "played", text: "Get Lucky marked as played", time: "9m ago" },
  { id: "f5", type: "announcement", text: "DJ Omertà: \"Last call for requests before the set!\"", time: "12m ago" },
  { id: "f6", type: "crowd_favorite", text: "Levitating is trending as a crowd favorite", time: "15m ago" },
];

export const MOCK_REWARDS = {
  points: 340,
  history: [
    { id: "h1", action: "Requested a song", points: 10 },
    { id: "h2", action: "Voted on a request", points: 5 },
    { id: "h3", action: "Tipped the DJ", points: 25 },
  ],
  unlockables: [
    { id: "u1", label: "Priority Request", cost: 150 },
    { id: "u2", label: "VIP Request", cost: 400 },
    { id: "u3", label: "Free Request", cost: 100 },
    { id: "u4", label: "10% Merch Discount", cost: 300 },
  ],
};

export const TIP_PRESETS_CENTS = [500, 1000, 2000];
export const BOOST_PRESETS_CENTS = [100, 200, 500];

// ============ DJ DASHBOARD MOCK DATA ============

export const MOCK_PULSE = {
  crowdEnergy: 78,
  history: [42, 51, 48, 60, 55, 64, 70, 66, 72, 78],
  topGenres: [
    { genre: "Hip-Hop", pct: 34 },
    { genre: "Pop", pct: 26 },
    { genre: "House", pct: 18 },
    { genre: "R&B", pct: 12 },
    { genre: "Latin", pct: 10 },
  ],
  suggestedNext: ["Levitating — Dua Lipa", "One Dance — Drake", "Titi Me Pregunto — Bad Bunny"],
};

export const MOCK_PAYMENTS = [
  { id: "p1", type: "tip" as const, guest: "Jordan S.", amountCents: 1000, status: "captured" as const, time: "2m ago" },
  { id: "p2", type: "request" as const, guest: "Casey M.", song: "SICKO MODE", amountCents: 1000, status: "authorized" as const, time: "6m ago" },
  { id: "p3", type: "boost" as const, guest: "Ava R.", song: "Blinding Lights", amountCents: 500, status: "captured" as const, time: "8m ago" },
  { id: "p4", type: "request" as const, guest: "Marcus T.", song: "Levitating", amountCents: 1000, status: "captured" as const, time: "20m ago" },
  { id: "p5", type: "request" as const, guest: "Priya K.", song: "Old Town Road", amountCents: 1000, status: "canceled" as const, time: "35m ago" },
];

export const MOCK_CRM = [
  {
    id: "c1",
    name: "Jordan Smith",
    phone: "(555) 555-0101",
    email: "jordan@email.com",
    favoriteGenres: ["Hip-Hop", "R&B"],
    marketingOptIn: true,
    rewardPoints: 340,
    tipTotalCents: 4500,
    requestCount: 6,
  },
  {
    id: "c2",
    name: "Ava Rodriguez",
    phone: "(555) 555-0142",
    email: "ava.r@email.com",
    favoriteGenres: ["Pop", "House"],
    marketingOptIn: true,
    rewardPoints: 210,
    tipTotalCents: 2000,
    requestCount: 3,
  },
  {
    id: "c3",
    name: "Marcus Thompson",
    phone: "(555) 555-0177",
    email: "marcus.t@email.com",
    favoriteGenres: ["Latin", "Pop"],
    marketingOptIn: false,
    rewardPoints: 95,
    tipTotalCents: 1000,
    requestCount: 2,
  },
  {
    id: "c4",
    name: "Priya Kapoor",
    phone: "(555) 555-0188",
    email: "priya.k@email.com",
    favoriteGenres: ["Country", "Pop"],
    marketingOptIn: true,
    rewardPoints: 60,
    tipTotalCents: 0,
    requestCount: 1,
  },
];

export const MOCK_ANALYTICS = {
  totalEvents: 91,
  totalRequests: 1284,
  totalTipsCents: 218500,
  avgCrowdEnergy: 74,
  topDJ: "DJ Omertà",
  weeklyRequests: [120, 145, 132, 168, 190, 175, 210],
  revenueByType: [
    { label: "Tips", amountCents: 128500, color: "pink" as const },
    { label: "Paid Requests", amountCents: 74000, color: "cyan" as const },
    { label: "Boosts", amountCents: 16000, color: "orange" as const },
  ],
};

export const MOCK_EVENT_SETTINGS = {
  mustPlay: ["First Dance — Ed Sheeran", "Sweet Caroline — Neil Diamond"],
  doNotPlay: ["Any Nickelback"],
  guestRequestsEnabled: true,
  boostsEnabled: true,
  explicitAllowed: false,
  maxRequestPriceCents: 2000,
};

// ============ CLIENT PORTAL MOCK DATA ============

export const MOCK_CLIENT_EVENT = {
  clientName: "Sarah & Mike Anderson",
  eventType: "Wedding Reception",
  date: "2026-09-12",
  venue: "Casey Keys",
  dj: "DJ Omertà",
  guestCount: 140,
  status: "Confirmed",
};

export const MOCK_TIMELINE = [
  { id: "t1", time: "5:00 PM", label: "Guest arrival & cocktail hour" },
  { id: "t2", time: "6:00 PM", label: "Grand entrance" },
  { id: "t3", time: "6:15 PM", label: "First dance" },
  { id: "t4", time: "6:30 PM", label: "Dinner service" },
  { id: "t5", time: "8:00 PM", label: "Open dancing begins" },
  { id: "t6", time: "9:30 PM", label: "Cake cutting" },
  { id: "t7", time: "11:00 PM", label: "Last call & send-off" },
];

export const MOCK_CONTRACTS = [
  { id: "doc1", name: "DJ Services Agreement", status: "Signed", date: "2026-04-02" },
  { id: "doc2", name: "Venue Rider", status: "Signed", date: "2026-04-02" },
  { id: "doc3", name: "Payment Schedule", status: "Pending", date: "—" },
];

export const MOCK_CLIENT_PAYMENTS = [
  { id: "cp1", label: "Deposit", amountCents: 50000, status: "paid" as const, due: "2026-04-05" },
  { id: "cp2", label: "Balance Due", amountCents: 150000, status: "due" as const, due: "2026-08-29" },
];

// ============ MARKETING SITE MOCK DATA ============

export const MOCK_DJS = [
  {
    id: "dj-omerta",
    name: "DJ Omertà",
    bio: "10+ years spinning weddings, clubs, and private events across Wisconsin. Known for reading a room and never letting the energy drop.",
    eventTypes: ["Weddings", "Clubs", "Private Events"],
    topGenres: ["Hip-Hop", "House", "Top 40"],
    rating: 4.9,
    reviewCount: 128,
    tipLink: "#",
  },
  {
    id: "dj-bubblz",
    name: "DJ Bubblz",
    bio: "High-energy open format DJ specializing in Latin, pop, and crowd-favorite mashups for weddings and corporate events.",
    eventTypes: ["Weddings", "Corporate"],
    topGenres: ["Latin", "Pop", "R&B"],
    rating: 4.8,
    reviewCount: 94,
    tipLink: "#",
  },
  {
    id: "dj-gmo",
    name: "DJ GMO",
    bio: "Club resident turned event specialist. Deep house and techno sets that keep the dance floor packed all night.",
    eventTypes: ["Clubs", "Private Events"],
    topGenres: ["House", "Techno", "Deep House"],
    rating: 4.9,
    reviewCount: 76,
    tipLink: "#",
  },
];

export const MOCK_VENUES = [
  {
    id: "casey-keys",
    name: "Casey Keys",
    location: "Cedarburg, WI",
    djs: ["DJ Omertà", "DJ J Prime"],
    topRequests: ["Blinding Lights", "SICKO MODE", "Levitating"],
    upcomingEvents: 27,
  },
  {
    id: "schooners-pub",
    name: "Schooner's Pub",
    location: "Port Washington, WI",
    djs: ["DJ Bubblz"],
    topRequests: ["Mr. Brightside", "Uptown Funk"],
    upcomingEvents: 26,
  },
  {
    id: "brass-boars-den",
    name: "Brass Boar's Den",
    location: "Grafton, WI",
    djs: ["DJ GMO", "DJ Omertà"],
    topRequests: ["One More Time", "Sandstorm"],
    upcomingEvents: 26,
  },
];

export const MOCK_PRICING = [
  {
    id: "essential",
    name: "Essential",
    priceLabel: "$895",
    tagline: "Great for smaller private parties",
    features: ["4-hour event coverage", "1 professional DJ", "Basic sound system", "Digital Crate Requests access"],
  },
  {
    id: "signature",
    name: "Signature",
    priceLabel: "$1,650",
    tagline: "Our most-booked wedding package",
    features: [
      "6-hour event coverage",
      "1 professional DJ + MC services",
      "Premium sound + lighting",
      "Digital Crate Requests + Crowd Vote",
      "Dedicated Client Portal",
    ],
    highlighted: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    priceLabel: "Custom",
    tagline: "Full production for large events",
    features: [
      "Full-day coverage",
      "2 DJs + MC + lighting designer",
      "Custom staging & effects",
      "Full Crate Requests suite + Party Pulse",
      "Dedicated event planner",
    ],
  },
];

// ============ TEAM HUB MOCK DATA ============

export const MOCK_TEAM = [
  { id: "u1", name: "DJ Omertà", role: "Lead DJ", eventsThisMonth: 9, status: "Available" as const },
  { id: "u2", name: "DJ Bubblz", role: "DJ", eventsThisMonth: 6, status: "Booked" as const },
  { id: "u3", name: "DJ GMO", role: "DJ", eventsThisMonth: 5, status: "Available" as const },
  { id: "u4", name: "Peace Simon", role: "Owner / Operations", eventsThisMonth: 12, status: "Available" as const },
  { id: "u5", name: "Maria Chen", role: "Event Coordinator", eventsThisMonth: 14, status: "Booked" as const },
];

export const MOCK_ANNOUNCEMENTS = [
  { id: "a1", author: "Peace Simon", text: "New gold sound system arriving next week — training session Sunday.", time: "2h ago" },
  { id: "a2", author: "Maria Chen", text: "Reminder: submit next month's availability by Friday.", time: "1d ago" },
  { id: "a3", author: "DJ Omertà", text: "Casey Keys crowd was incredible last night — Crate Requests numbers were the best yet.", time: "3d ago" },
];

export const MOCK_UPCOMING_ASSIGNMENTS = [
  { id: "as1", dj: "DJ Omertà", event: "Casey Keys — Saturday Nights", date: "2026-07-04" },
  { id: "as2", dj: "DJ Bubblz", event: "Anderson Wedding", date: "2026-09-12" },
  { id: "as3", dj: "DJ GMO", event: "Brass Boar's Den — Club Night", date: "2026-07-05" },
];

// ============ ADMIN MOCK DATA ============

export const MOCK_ADMIN_STATS = {
  totalDjs: 3,
  totalVenues: 3,
  totalEvents: 91,
  activeInviteCodes: 4,
};

export const MOCK_INVITE_CODES = [
  { id: "ic1", code: "DCDJ-7F2A", assignedTo: "New DJ", used: false },
  { id: "ic2", code: "DCDJ-91XR", assignedTo: "DJ Bubblz", used: true },
  { id: "ic3", code: "DCDJ-K3M8", assignedTo: "New DJ", used: false },
  { id: "ic4", code: "DCDJ-Q7ZP", assignedTo: "New DJ", used: false },
];
