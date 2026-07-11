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

/** One row of the per-recipient delivery log (`admin_email_campaign_recipients`). */
export type CampaignRecipientRow = {
  user_id: string;
  email: string;
  status: "pending" | "sent" | "failed" | "skipped";
  resend_id: string | null;
  error: string | null;
  sent_at: string | null;
  display_name: string | null;
  username: string | null;
};
