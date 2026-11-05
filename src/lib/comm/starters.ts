// Starter designs added to the Communications Center the first time it
// opens. They are ordinary designs: edit, duplicate or delete them freely.

import { defaultBlock, type EmailBlock, type EmailDesign } from "./blocks";

function b<T extends EmailBlock["type"]>(type: T, props: Partial<Extract<EmailBlock, { type: T }>> = {}): EmailBlock {
  return { ...defaultBlock(type), ...props } as EmailBlock;
}

const SITE = "https://digitalcratedjs.com";
const SOCIAL = b("social", { website: SITE });
const FOOTER = b("footer");

export const STARTER_DESIGNS: (EmailDesign & { audience: "client" })[] = [
  {
    audience: "client",
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
    audience: "client",
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
    audience: "client",
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
    audience: "client",
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
    audience: "client",
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
    audience: "client",
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
    audience: "client",
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
  }
];
