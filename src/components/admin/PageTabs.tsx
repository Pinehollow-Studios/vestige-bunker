"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tabItemClass } from "@/components/admin/Tabs";

export type TabDef = {
  key: string;
  label: string;
  content: ReactNode;
  /** Optional action (e.g. a compose button) shown in the tab bar when active. */
  action?: ReactNode;
};

/**
 * A simple two-plus tab surface used to split a page's distinct jobs (e.g.
 * "things you send" vs. "automatic templates"). Every tab's content stays
 * mounted (`hidden`) so in-progress editor state survives a tab switch. The
 * active tab's optional `action` rides in the tab bar on the right.
 */
export function PageTabs({ tabs, initialKey }: { tabs: TabDef[]; initialKey?: string }) {
  const [active, setActive] = useState(initialKey ?? tabs[0]?.key ?? "");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule/60">
        <div className="flex gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active === t.key}
              onClick={() => setActive(t.key)}
              className={tabItemClass(active === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeTab?.action && <div className="mb-2">{activeTab.action}</div>}
      </div>

      {tabs.map((t) => (
        <div key={t.key} className={cn(active !== t.key && "hidden")}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
