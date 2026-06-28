import type { MetadataRoute } from "next";

/**
 * The entire admin app is private - disallow all crawlers everywhere. The login
 * page additionally sets `noindex` (login/layout.tsx); this keeps the rest of
 * the surface (and any accidentally-public path) out of search indexes too.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
