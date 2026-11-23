import type { Metadata } from "next";

// What a text message shows for an Event Basics link.
export const metadata: Metadata = {
  metadataBase: new URL((process.env.NEXT_PUBLIC_APP_URL || "https://cratesdjs.com").replace(/\/$/, "")),
  title: "Event Basics · Digital Crate DJs",
  description: "A few quick questions about your event so we can hold your date. About 2 minutes.",
  robots: { index: false, follow: false },
  openGraph: { title: "Event Basics · Digital Crate DJs", description: "A few quick questions about your event so we can hold your date. About 2 minutes.", siteName: "Digital Crate DJs", type: "website" }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
