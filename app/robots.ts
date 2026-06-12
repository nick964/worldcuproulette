import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Auth-gated app pages and invite links have no business in search.
      disallow: ["/pools", "/join"],
    },
    sitemap: "https://worldcuproulette.com/sitemap.xml",
  };
}
