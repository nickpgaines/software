import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: "facebookexternalhit", allow: "/" },
      { userAgent: "facebookexternalhit/1.1", allow: "/" },
      { userAgent: "facebookcatalog/1.0", allow: "/" },
      { userAgent: "Meta-ExternalAgent", allow: "/" },
      { userAgent: "meta-externalagent", allow: "/" },
    ],
  };
}
