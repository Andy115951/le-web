import type { MetadataRoute } from "next";

/** P42-adjacent: production /robots.txt was bare 404; disallow API only. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
  };
}
