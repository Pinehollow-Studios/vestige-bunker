import { TAB_LIST_CLASS, TabLink } from "@/components/admin/Tabs";
import { ANALYTICS_TABS } from "@/lib/analytics/config";

/** Sub-route tab bar for the analytics surface. Server-rendered; each page
 *  passes its own `active` href (the repo's URL-driven tab idiom). Shares the
 *  one canonical tab visual with PageTabs + the feedback queue. */
export function AnalyticsNav({ active }: { active: string }) {
  return (
    <nav className={TAB_LIST_CLASS}>
      {ANALYTICS_TABS.map((t) => (
        <TabLink key={t.href} href={t.href} active={t.href === active}>
          {t.label}
        </TabLink>
      ))}
    </nav>
  );
}
