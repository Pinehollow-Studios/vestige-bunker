"use client";

import { Award, ChevronDown, Megaphone, Plus, Rocket, Sparkles } from "lucide-react";
import { AdminMenu, MenuItem, MenuLabel } from "@/components/admin/AdminMenu";

/**
 * The top-bar "New" quick-create. Jumps to the create surface for the common
 * editorial objects - start a list / announcement / version / badge from
 * anywhere, not just its index page.
 */
export function QuickCreate() {
  return (
    <AdminMenu
      label="Create new"
      width="w-56"
      trigger={
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg transition-colors hover:bg-brand-deep">
          <Plus aria-hidden className="size-3.5" />
          New
          <ChevronDown aria-hidden className="size-3 opacity-80" />
        </span>
      }
    >
      {(close) => (
        <>
          <MenuLabel>Create</MenuLabel>
          <MenuItem href="/curated" icon={<Sparkles className="size-4" />} onClick={close}>
            Curated list
          </MenuItem>
          <MenuItem href="/announcements" icon={<Megaphone className="size-4" />} onClick={close}>
            Announcement
          </MenuItem>
          <MenuItem href="/changelog" icon={<Rocket className="size-4" />} onClick={close}>
            Version
          </MenuItem>
          <MenuItem href="/badges" icon={<Award className="size-4" />} onClick={close}>
            Badge
          </MenuItem>
        </>
      )}
    </AdminMenu>
  );
}
