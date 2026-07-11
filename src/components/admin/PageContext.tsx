"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { detailLabel, sectionLabel } from "@/lib/nav-shortcuts";

/**
 * Top-bar breadcrumb. The section label is derived from the nav (single source
 * of truth — never goes stale), and the section crumb links back to its list.
 * On a detail route it appends a friendly sub-label (New / Import / Detail / …).
 */
export function PageContext() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const section = sectionLabel(pathname);
  const sectionHref = segments.length ? `/${segments[0]}` : "/";
  const detail = segments.length > 1 ? detailLabel(segments[segments.length - 1]) : null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 max-w-[45vw] items-center gap-1.5 text-sm sm:max-w-none"
    >
      {detail ? (
        <Link href={sectionHref} className="truncate text-ink-3 transition-colors hover:text-ink-2">
          {section}
        </Link>
      ) : (
        <span className="truncate font-medium text-ink">{section}</span>
      )}
      {detail && (
        <>
          <ChevronRight aria-hidden className="size-3.5 text-ink-3/60" />
          <span className="truncate font-medium text-ink">{detail}</span>
        </>
      )}
    </nav>
  );
}
