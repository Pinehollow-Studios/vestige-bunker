/**
 * Live legal/deliverability checks for an email being composed. Pure + synchronous
 * so the composer can re-run it on every keystroke.
 *
 * Marketing email (UK PECR / GDPR + US CAN-SPAM for any US recipients) legally
 * needs: a working unsubscribe, clear sender identity, and a valid postal address.
 * Transactional/"service" messages (the app's bypass-consent mode) are exempt from
 * the marketing-specific rules, so those checks soften to info there.
 */

export type CheckLevel = "pass" | "warn" | "fail";
export type ComplianceCheck = { id: string; label: string; level: CheckLevel; hint: string };

// A UK postcode (loose) or a US ZIP — enough to tell "an address was added".
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|\d{5}(-\d{4})?)\b/i;
const ADDRESS_PLACEHOLDER = /\[add postal address\]/i;

export function checkEmailCompliance(opts: {
  subject: string;
  html: string;
  preheader: string;
  isServiceMessage: boolean;
}): ComplianceCheck[] {
  const { subject, html, preheader, isServiceMessage } = opts;
  const h = html || "";
  const lower = h.toLowerCase();

  const hasUnsub = h.includes("{{unsubscribe_url}}") || /unsubscribe/i.test(lower);
  const hasSender = /vestige/i.test(lower);
  const hasAddress = POSTCODE.test(h) && !ADDRESS_PLACEHOLDER.test(h);
  const addressPlaceholderLeft = ADDRESS_PLACEHOLDER.test(h);

  const checks: ComplianceCheck[] = [];

  // Subject
  checks.push(
    subject.trim()
      ? { id: "subject", label: "Subject line", level: "pass", hint: "Set." }
      : { id: "subject", label: "Subject line", level: "fail", hint: "Add a subject — it can't be empty." },
  );

  // Content
  checks.push(
    h.trim()
      ? { id: "content", label: "Content", level: "pass", hint: "Written." }
      : { id: "content", label: "Content", level: "fail", hint: "Write the email body." },
  );

  // Unsubscribe — required for marketing, exempt for service messages.
  if (hasUnsub) {
    checks.push({ id: "unsub", label: "Unsubscribe link", level: "pass", hint: "Present — recipients can opt out." });
  } else if (isServiceMessage) {
    checks.push({ id: "unsub", label: "Unsubscribe link", level: "warn", hint: "Service messages are exempt, but include one unless this is strictly transactional." });
  } else {
    checks.push({ id: "unsub", label: "Unsubscribe link", level: "fail", hint: "Legally required. Add {{unsubscribe_url}} (every template's footer has it)." });
  }

  // Sender identity
  checks.push(
    hasSender
      ? { id: "sender", label: "Sender identity", level: "pass", hint: "Vestige is named." }
      : { id: "sender", label: "Sender identity", level: "warn", hint: "Name who it's from (Vestige) somewhere in the email." },
  );

  // Postal address — required by US CAN-SPAM (any US recipients) and best practice
  // everywhere. Surfaced prominently, but a warning not a hard block (UK PECR
  // doesn't mandate it, and a pre-launch list may not have one yet).
  if (hasAddress) {
    checks.push({ id: "address", label: "Postal address", level: "pass", hint: "An address is included." });
  } else {
    checks.push({
      id: "address",
      label: "Postal address",
      level: "warn",
      hint: addressPlaceholderLeft
        ? "Replace “[add postal address]” in the footer — legally required if any recipients are in the US."
        : "Add a physical postal address to the footer — legally required if any recipients are in the US.",
    });
  }

  // Preheader — deliverability best practice, never blocking.
  checks.push(
    preheader.trim()
      ? { id: "preheader", label: "Preview text", level: "pass", hint: "Set." }
      : { id: "preheader", label: "Preview text", level: "warn", hint: "Add a preheader — it's the line shown after the subject in most inboxes." },
  );

  return checks;
}

/** True when nothing legally blocks a send (no `fail`). Warnings are allowed. */
export function canSend(checks: ComplianceCheck[]): boolean {
  return !checks.some((c) => c.level === "fail");
}

export function complianceSummary(checks: ComplianceCheck[]): { fails: number; warns: number } {
  return {
    fails: checks.filter((c) => c.level === "fail").length,
    warns: checks.filter((c) => c.level === "warn").length,
  };
}
