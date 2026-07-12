/**
 * Types + vocabulary for the admin waitlist surface (`/emails` → "Waitlist").
 *
 * Mirrors the server waitlist tables + RPCs
 * (`Vestige-ios/supabase/migrations/20260712160000_waitlist.sql`). The waitlist
 * is keyed by EMAIL (subscribers aren't app users), so it's a parallel, simpler
 * sibling of the email-campaigns surface: no audience targeting — a waitlist
 * campaign always goes to every subscribed address.
 */

import { STATUS_CHIP, STATUS_DOT, STATUS_LABELS, type BroadcastStatus } from "../../notifications/types";

export { STATUS_CHIP, STATUS_DOT, STATUS_LABELS };
export type WaitlistCampaignStatus = BroadcastStatus;

/** `admin_waitlist_overview()` — one-row headline counts. */
export type WaitlistOverview = {
  total: number;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  new_7d: number;
  new_30d: number;
};

/** `admin_waitlist_subscribers()` — one subscriber row. */
export type WaitlistSubscriberRow = {
  email: string;
  first_name: string | null;
  status: "subscribed" | "unsubscribed" | "bounced";
  source: string | null;
  subscribed_at: string;
};

/** Everyone on the list, or a hand-picked set of members. */
export type WaitlistAudienceKind = "everyone" | "individuals";

/** One waitlist campaign — mirrors `public.waitlist_campaigns`. */
export type WaitlistCampaignRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  html: string;
  audience_kind: WaitlistAudienceKind;
  status: WaitlistCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** `admin_waitlist_campaigns_overview()` — list-view projection. */
export type WaitlistCampaignOverviewRow = {
  id: string;
  name: string;
  subject: string;
  status: WaitlistCampaignStatus;
  audience_kind: WaitlistAudienceKind;
  target_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

/** `admin_waitlist_campaign_funnel()` — delivery funnel. */
export type WaitlistFunnel = {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};
