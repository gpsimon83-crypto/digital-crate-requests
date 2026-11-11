import type { MetadataRoute } from "next";

/** Keeps search engines out of every private area (pages also send X-Robots-Tag: noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/portal", "/dj-dashboard", "/venue", "/analytics", "/auth", "/inquiry", "/api", "/r/"]
      }
    ]
  };
}
