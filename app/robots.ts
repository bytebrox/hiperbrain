import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://haiperbrain.com/sitemap.xml",
    host: "https://haiperbrain.com",
  };
}
