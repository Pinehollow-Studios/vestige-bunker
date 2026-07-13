/**
 * Email delivery-status vocabulary + presentation, mirroring Resend's event
 * model (sent / queued / delivered / opened / clicked / bounced / complained /
 * delivery_delayed / failed / suppressed). One source of truth for the status
 * chip shown in the email log, the message detail header, and timelines.
 */

export type EmailStatusTone = "brand" | "muted" | "amber" | "alert";

export function emailStatusMeta(event: string): { label: string; tone: EmailStatusTone } {
  switch (event) {
    case "clicked":
      return { label: "Clicked", tone: "brand" };
    case "opened":
      return { label: "Opened", tone: "brand" };
    case "delivered":
      return { label: "Delivered", tone: "muted" };
    case "sent":
      return { label: "Sent", tone: "muted" };
    case "queued":
      return { label: "Queued", tone: "amber" };
    case "scheduled":
      return { label: "Scheduled", tone: "amber" };
    case "delivery_delayed":
      return { label: "Delayed", tone: "amber" };
    case "bounced":
      return { label: "Bounced", tone: "alert" };
    case "complained":
      return { label: "Complained", tone: "alert" };
    case "failed":
      return { label: "Failed", tone: "alert" };
    case "suppressed":
      return { label: "Suppressed", tone: "alert" };
    default:
      return { label: event.replace(/_/g, " "), tone: "muted" };
  }
}

const TONE_CLASS: Record<EmailStatusTone, string> = {
  brand: "border-brand/30 bg-brand/10 text-brand",
  muted: "border-rule/60 text-ink-3",
  amber: "border-amber/30 bg-amber/10 text-amber",
  alert: "border-alert/30 bg-alert/10 text-alert",
};

export function emailStatusChipClass(tone: EmailStatusTone): string {
  return TONE_CLASS[tone];
}
