"use client";

import { Bell, Images, MessageSquareWarning, Shield } from "lucide-react";
import { AdminMenu, MenuItem, MenuLabel } from "@/components/admin/AdminMenu";

/**
 * The top-bar attention bell - a single badge summarising what needs a human
 * across the operational queues (open feedback + pending photos + safeguarding
 * flags). Click → a list that jumps straight into each queue.
 */
export function AttentionBell({
  feedback = 0,
  photos = 0,
  safeguarding = 0,
}: {
  feedback?: number;
  photos?: number;
  safeguarding?: number;
}) {
  const total = feedback + photos + safeguarding;

  return (
    <AdminMenu
      label="What needs attention"
      width="w-72"
      trigger={
        <span className="relative grid size-9 place-items-center rounded-lg border border-border/70 bg-paper-sunken/60 text-ink-2 transition-colors hover:border-rule-strong hover:text-ink">
          <Bell aria-hidden className="size-4" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-fg">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </span>
      }
    >
      {(close) => (
        <>
          <MenuLabel>Needs attention</MenuLabel>
          {total === 0 ? (
            <p className="px-2.5 py-3 text-center text-xs text-ink-3">All clear - nothing waiting.</p>
          ) : (
            <>
              <MenuItem
                href="/feedback"
                icon={<MessageSquareWarning className="size-4" />}
                hint={String(feedback)}
                onClick={close}
              >
                Open feedback
              </MenuItem>
              <MenuItem
                href="/photos"
                icon={<Images className="size-4" />}
                hint={String(photos)}
                onClick={close}
              >
                Photos to moderate
              </MenuItem>
              <MenuItem
                href="/safeguarding"
                icon={<Shield className="size-4" />}
                hint={String(safeguarding)}
                onClick={close}
              >
                Safeguarding flags
              </MenuItem>
            </>
          )}
        </>
      )}
    </AdminMenu>
  );
}
