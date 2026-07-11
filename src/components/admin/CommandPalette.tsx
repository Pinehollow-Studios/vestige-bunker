"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  FlaskConical,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { NAV_GROUPS } from "@/components/admin/nav";
import { readRecent, type RecentPage } from "@/lib/nav-shortcuts";
import { setEnv, signOut } from "@/app/(dashboard)/actions";
import { createDraftEmail } from "@/app/(dashboard)/emails/campaigns/actions";
import { createDraftBroadcast } from "@/app/(dashboard)/notifications/actions";
import type { AdminEnvKey } from "@/lib/supabase/env";
import type { SearchGroup } from "@/app/api/search/route";

/** Window event any control can dispatch to open the palette (e.g. the TopBar
 *  search button). Keeps the trigger decoupled from this single mounted host. */
export const OPEN_COMMAND_EVENT = "vestige:command";

const NAV = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The ⌘K command palette. Mounted once in the dashboard layout. Navigate to any
 * surface, search users / courses / feedback / curated / badges (debounced
 * server search), and run global actions. Keyboard-first: ⌘K / Ctrl-K to open,
 * ↑↓ to move, ↵ to run, Esc to close.
 */
export function CommandPalette({
  devSwitchEnabled,
  currentEnv,
}: {
  devSwitchEnabled: boolean;
  currentEnv: AdminEnvKey;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentPage[]>([]);
  const [, startTransition] = useTransition();
  const reqId = useRef(0);
  const openRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    setLoading(false);
  }, []);

  // Open the palette and refresh the recent-pages list at the same moment
  // (no open→effect→setState cascade).
  const openPalette = useCallback(() => {
    setRecent(readRecent());
    setOpen(true);
  }, []);

  // Mirror `open` into a ref so the (deps-free) key handler reads it fresh.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Open on ⌘K / Ctrl-K, on the custom event; close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) close();
        else openPalette();
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onOpen = () => openPalette();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, [close, openPalette]);

  // Debounced server search. Every state write happens inside the timer
  // callback (async) - never synchronously in the effect body.
  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    const t = setTimeout(
      async () => {
        if (q.length < 2) {
          setGroups([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const json = (await res.json()) as { groups?: SearchGroup[] };
          if (id === reqId.current) setGroups(json.groups ?? []);
        } catch {
          if (id === reqId.current) setGroups([]);
        } finally {
          if (id === reqId.current) setLoading(false);
        }
      },
      q.length < 2 ? 0 : 180,
    );
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  if (!open) return null;

  const ql = query.trim().toLowerCase();
  const navMatches = ql
    ? NAV.filter((n) => n.label.toLowerCase().includes(ql) || n.href.includes(ql))
    : NAV;

  const CREATE = [
    { key: "email", label: "New email", icon: Mail, run: createDraftEmail },
    { key: "notification", label: "New notification", icon: Send, run: createDraftBroadcast },
  ];
  const createMatches = ql ? CREATE.filter((c) => c.label.toLowerCase().includes(ql)) : CREATE;

  return (
    <div
      className="fixed inset-0 z-50 bg-paper-sunken/70 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="mx-auto mt-[10vh] w-[92vw] max-w-xl overflow-hidden rounded-2xl border border-rule bg-paper-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border/70 px-4">
            <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search users, courses, feedback… or jump to a page"
              className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
            />
            {loading && (
              <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border border-ink-3/40 border-t-brand" />
            )}
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">
              {ql.length >= 2 && !loading ? "No matches." : "Type to search."}
            </Command.Empty>

            {!ql && recent.length > 0 && (
              <Group label="Recent">
                {recent.map((r) => (
                  <Item key={r.href} value={`recent:${r.href}`} onSelect={() => go(r.href)}>
                    <Clock aria-hidden className="size-4 shrink-0 text-ink-3" />
                    <span className="flex-1 truncate">{r.label}</span>
                    <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-3 opacity-0 group-data-[selected=true]/item:opacity-100" />
                  </Item>
                ))}
              </Group>
            )}

            {createMatches.length > 0 && (
              <Group label="Create">
                {createMatches.map((c) => {
                  const Icon = c.icon;
                  return (
                    <Item
                      key={c.key}
                      value={`create:${c.key}`}
                      onSelect={() => {
                        close();
                        startTransition(() => void c.run());
                      }}
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-brand" />
                      <span className="flex-1">{c.label}</span>
                      <Plus aria-hidden className="size-3.5 shrink-0 text-ink-3 opacity-0 group-data-[selected=true]/item:opacity-100" />
                    </Item>
                  );
                })}
              </Group>
            )}

            {navMatches.length > 0 && (
              <Group label="Navigate">
                {navMatches.map((n) => {
                  const Icon = n.icon;
                  return (
                    <Item key={n.href} value={`nav:${n.href}`} onSelect={() => go(n.href)}>
                      <Icon aria-hidden className="size-4 shrink-0 text-ink-3" />
                      <span className="flex-1 truncate">{n.label}</span>
                      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-3 opacity-0 group-data-[selected=true]/item:opacity-100" />
                    </Item>
                  );
                })}
              </Group>
            )}

            {groups.map((g) => (
              <Group key={g.key} label={g.label}>
                {g.items.map((it) => (
                  <Item key={it.id} value={`${g.key}:${it.id}`} onSelect={() => go(it.href)}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-ink">{it.title}</span>
                      {it.subtitle && (
                        <span className="truncate text-xs text-ink-3">{it.subtitle}</span>
                      )}
                    </span>
                    <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-3 opacity-0 group-data-[selected=true]/item:opacity-100" />
                  </Item>
                ))}
              </Group>
            ))}

            <Group label="Actions">
              {devSwitchEnabled && (
                <Item
                  value="action:env"
                  onSelect={() => {
                    close();
                    startTransition(() => void setEnv(currentEnv === "dev" ? "prod" : "dev"));
                  }}
                >
                  <FlaskConical aria-hidden className="size-4 shrink-0 text-amber" />
                  <span className="flex-1">
                    {currentEnv === "dev" ? "Switch to prod" : "Switch to dev (developer)"}
                  </span>
                </Item>
              )}
              <Item
                value="action:signout"
                onSelect={() => {
                  close();
                  startTransition(() => void signOut());
                }}
              >
                <LogOut aria-hidden className="size-4 shrink-0 text-ink-3" />
                <span className="flex-1">Sign out</span>
              </Item>
            </Group>
          </Command.List>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2 text-[10px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <CornerDownLeft aria-hidden className="size-3" /> open
              <span className="mx-1 text-ink-3/50">·</span>
              <kbd className="kbd">esc</kbd> close
              <span className="mx-1 text-ink-3/50">·</span>
              <kbd className="kbd">?</kbd> shortcuts
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={label}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-ink-3"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group/item flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-sidebar-accent-foreground"
    >
      {children}
    </Command.Item>
  );
}
