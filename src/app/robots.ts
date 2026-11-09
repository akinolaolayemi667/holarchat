import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Allow search + AI answer / generative crawlers to index public pages.
 * Keep private app surfaces out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/chat", "/chat/", "/auth/", "/auth/callback"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
      // Answer / generative engines (AEO + GEO)
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow,
      },
      {
        userAgent: "Anthropic-AI",
        allow: "/",
        disallow,
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
