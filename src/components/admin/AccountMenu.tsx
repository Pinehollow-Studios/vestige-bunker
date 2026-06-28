"use client";

import { useTransition } from "react";
import { ChevronDown, FlaskConical, LogOut } from "lucide-react";
import { AdminMenu, MenuItem, MenuSeparator } from "@/components/admin/AdminMenu";
import { setEnv, signOut } from "@/app/(dashboard)/actions";
import type { AdminEnvKey } from "@/lib/supabase/env";

type Role = "super_admin" | "moderator" | "editor";

/**
 * The consolidated account menu - avatar → name + role, the dev/prod switch
 * (when enabled), and sign out. Replaces the old row of separate role badge /
 * user pill / sign-out button / env toggle.
 */
export function AccountMenu({
  label,
  secondary,
  initials,
  role,
  env,
  devSwitchEnabled,
}: {
  label: string;
  secondary: string | null;
  initials: string;
  role: Role;
  env: AdminEnvKey;
  devSwitchEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const onDev = env === "dev";

  return (
    <AdminMenu
      label="Account"
      width="w-60"
      trigger={
        <span className="flex items-center gap-2 rounded-lg border border-border/70 bg-paper-sunken/60 py-1 pl-1 pr-2 transition-colors hover:border-rule-strong">
          <span className="grid size-7 place-items-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-wider text-brand-fg">
            {initials}
          </span>
          <span className="hidden max-w-[120px] truncate text-xs font-semibold text-ink sm:block">{label}</span>
          <ChevronDown aria-hidden className="size-3 text-ink-3" />
        </span>
      }
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-ink">{label}</p>
            {secondary && <p className="truncate text-[11px] text-ink-3">{secondary}</p>}
            <span className="mt-1.5 inline-flex rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
              {roleLabel(role)}
            </span>
          </div>
          <MenuSeparator />
          {devSwitchEnabled && (
            <MenuItem
              icon={<FlaskConical className="size-4" />}
              onClick={() => {
                close();
                startTransition(() => void setEnv(onDev ? "prod" : "dev"));
              }}
            >
              {pending ? "Switching…" : onDev ? "Switch to prod" : "Switch to dev"}
            </MenuItem>
          )}
          <MenuItem
            tone="danger"
            icon={<LogOut className="size-4" />}
            onClick={() => {
              close();
              startTransition(() => void signOut());
            }}
          >
            Sign out
          </MenuItem>
        </>
      )}
    </AdminMenu>
  );
}

function roleLabel(role: Role): string {
  return role === "super_admin" ? "Super admin" : role === "moderator" ? "Moderator" : "Editor";
}
