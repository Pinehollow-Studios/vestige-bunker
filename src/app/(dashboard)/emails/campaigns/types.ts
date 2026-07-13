/**
 * Shared types + vocabulary for the admin email-campaigns surface
 * (`/emails` → "Campaigns you send").
 *
 * Mirrors the server `email_campaigns` table + RPCs
 * (`Vestige-ios/supabase/migrations/20260711110000_email_campaigns.sql`). The
 * TARGETING model is shared verbatim with push broadcasts, so we re-export the
 * audience vocabulary from `notifications/types` rather than duplicate it — one
 * source of truth for both surfaces.
 */

export {
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  PRIVACY_OPTIONS,
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  audienceSummary,
  versionBoundsLabel,
} from "../../notifications/types";

export type {
  BroadcastAudienceKind as CampaignAudienceKind,
  BroadcastTarget as CampaignTarget,
  BroadcastStatus as CampaignStatus,
  CountyOption,
  UserPickRow,
} from "../../notifications/types";

import type {
  BroadcastAudienceKind,
  BroadcastStatus,
  BroadcastTarget,
} from "../../notifications/types";

// ── DB row ──────────────────────────────────────────────────────────────

/** One email campaign — mirrors `public.email_campaigns`. */
export type EmailCampaignRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  html: string;
  audience_kind: BroadcastAudienceKind;
  target: BroadcastTarget;
  min_app_version: string | null;
  max_app_version: string | null;
  bypass_marketing_consent: boolean;
  status: BroadcastStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from `admin_email_campaigns_overview()` — adds the hand-picked count. */
export type EmailCampaignOverviewRow = EmailCampaignRow & {
  target_user_count: number;
};

/**
 * One row of the per-recipient delivery log (`admin_email_campaign_recipients`).
 * The send outcome (`status`/`error`/`sent_at`) comes from the recipient row; the
 * delivery/engagement fields are rolled up from `email_events` (the Resend webhook).
 */
export type CampaignRecipientRow = {
  user_id: string;
  email: string;
  status: "pending" | "sent" | "failed" | "skipped";
  resend_id: string | null;
  error: string | null;
  sent_at: string | null;
  display_name: string | null;
  username: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  bounced_at: string | null;
  bounce_reason: string | null;
  complained_at: string | null;
  delivery_delayed_at: string | null;
};

/** One raw Resend event for a recipient (`admin_email_recipient_events`). */
export type EmailEventRow = {
  event_type:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "complained"
    | "delivery_delayed"
    | "failed";
  occurred_at: string;
  meta: Record<string, unknown> | null;
};

/** One campaign a user received (`admin_user_email_history`). */
export type UserEmailHistoryRow = {
  campaign_id: string;
  name: string;
  subject: string;
  campaign_status: string;
  sent_at: string | null;
  recipient_status: "pending" | "sent" | "failed" | "skipped";
  error: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  bounced_at: string | null;
  bounce_reason: string | null;
  complained_at: string | null;
};
