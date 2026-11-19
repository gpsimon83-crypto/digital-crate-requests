import type { Metadata } from "next";

// What a text message shows for the link: a tappable card with this title,
// line and picture (iMessage and most Android messaging apps read these).
export const metadata: Metadata = {
  metadataBase: new URL((process.env.NEXT_PUBLIC_APP_URL || "https://cratesdjs.com").replace(/\/$/, "")),
  title: "Wedding Basics · Digital Crate DJs",
  description: "A few quick questions to lock in your wedding date. About 3 minutes.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Wedding Basics · Digital Crate DJs",
    description: "A few quick questions to lock in your wedding date. About 3 minutes.",
    siteName: "Digital Crate DJs",
    type: "website",
    images: [{ url: "/og/wedding-basics.jpg", width: 1200, height: 630, alt: "Wedding Basics, Digital Crate DJs" }]
  },
  twitter: { card: "summary_large_image", title: "Wedding Basics · Digital Crate DJs", images: ["/og/wedding-basics.jpg"] }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
