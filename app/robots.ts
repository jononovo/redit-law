import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://creditclaw.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/claim"],
        disallow: ["/app/", "/onboarding", "/api/", "/merchant/", "/payment/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
