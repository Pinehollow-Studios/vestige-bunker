"use client";

import { Award, ChevronDown, Mail, Megaphone, Plus, Rocket, Send, Sparkles } from "lucide-react";
import { AdminMenu, MenuItem, MenuLabel } from "@/components/admin/AdminMenu";

/**
 * The top-bar "New" quick-create. Jumps to the create surface for the common
 * objects — compose a message or start an editorial object from anywhere, not
 * just its own page. Kept in step with the live surfaces (messaging + editorial).
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
          <MenuLabel>Messaging</MenuLabel>
          <MenuItem href="/emails" icon={<Mail className="size-4" />} onClick={close}>
            Email
          </MenuItem>
          <MenuItem href="/notifications" icon={<Send className="size-4" />} onClick={close}>
            Notification
          </MenuItem>
          <MenuItem href="/announcements" icon={<Megaphone className="size-4" />} onClick={close}>
            Announcement
          </MenuItem>

          <MenuLabel>Editorial</MenuLabel>
          <MenuItem href="/curated" icon={<Sparkles className="size-4" />} onClick={close}>
            Curated list
          </MenuItem>
          <MenuItem href="/badges" icon={<Award className="size-4" />} onClick={close}>
            Badge
          </MenuItem>
          <MenuItem href="/changelog" icon={<Rocket className="size-4" />} onClick={close}>
            Version
          </MenuItem>
        </>
      )}
    </AdminMenu>
  );
}
