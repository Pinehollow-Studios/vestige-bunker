/**
 * Crash severity + plain-English translation.
 *
 * Sentry hands us harsh, technical signatures — `EXC_BAD_ACCESS: Exception 1,
 * Code 2`, `NSInternalInconsistencyException`, `App Hanging for at least 2000
 * ms`. This module turns each one into:
 *
 *   - a **severity band** (critical / high / medium / low) tuned to what the
 *     *user actually experienced*, not the raw error class, so an operator can
 *     glance at the queue (or a crash email) and instantly know how bad it is;
 *   - a short **category** tag ("Crash", "Froze", "Slow", "Handled", "Noise"…);
 *   - a **summary** — one plain sentence a non-engineer can read.
 *
 * The rules are curated (a hand-written signature → meaning map), not
 * statistical: crashes cluster into a handful of shapes, so a deterministic
 * map is instant, free, and predictable. First matching rule wins; anything
 * unmatched falls back to the Sentry `level`.
 *
 * MIRROR: the same ruleset is ported (verbatim in spirit) into the
 * `sentry-webhook` Edge Function in `Vestige-ios` so the crash-alert email
 * classifies identically to this dashboard. If you change a rule here, mirror
 * it there (`supabase/functions/sentry-webhook/index.ts` → `classifyCrash`).
 */

export type CrashSeverity = "critical" | "high" | "medium" | "low";

export type CrashClassification = {
  severity: CrashSeverity;
  /** Short human tag for the chip, e.g. "Crash", "Froze", "Slow". */
  category: string;
  /** One plain-English sentence describing what happened. */
  summary: string;
};

type Rule = {
  test: RegExp;
  severity: CrashSeverity;
  category: string;
  summary: string;
};

/**
 * Ordered most-specific-first. Each `test` runs against a lowercased haystack
 * of `message` + `culprit`. The noise/handled rules sit at the top so genuinely
 * benign events (cancellations, offline blips, external-service hiccups) are
 * demoted *before* a broad "fatal" rule could over-escalate them.
 */
const RULES: Rule[] = [
  // ---- Noise: not really bugs. Demote hard so they don't crowd the queue. ----
  {
    test: /cancellationerror|task (was )?cancell|\bcancelled\b|\bcancelation\b/,
    severity: "low",
    category: "Noise",
    summary:
      "A background task was cancelled before it finished — this is almost always harmless.",
  },
  {
    test: /\boffline\b|not ?connected ?to ?internet|no internet|network (is )?unreachable|the internet connection|urlerror|timed out/,
    severity: "low",
    category: "Handled",
    summary:
      "A data request failed because the device was offline or the network dropped. The app handles this gracefully.",
  },
  {
    test: /weatherkit|liveweatherprovider|\bweather\b/,
    severity: "low",
    category: "External",
    summary:
      "Weather data couldn’t load — this depends on Apple’s WeatherKit service, not our own code.",
  },

  // ---- High: the app froze or was killed. Very disruptive, not always fatal. ----
  {
    test: /watchdogtermination|watchdog|0x8badf00d/,
    severity: "high",
    category: "Froze",
    summary:
      "iOS force-quit the app because it stopped responding for too long — a serious freeze the user definitely noticed.",
  },
  {
    test: /out of memory|\boom\b|memory pressure|jettison|0xdead10cc/,
    severity: "high",
    category: "Memory",
    summary:
      "iOS shut the app down for using too much memory or holding a resource while suspended.",
  },

  // ---- Medium: recovered, but the user saw a stall or a broken feature. ----
  {
    test: /app hanging|hang detected|hanging for|main thread was blocked/,
    severity: "medium",
    category: "Slow",
    summary:
      "The app froze for a few seconds and then recovered — annoying, but not a crash.",
  },

  // ---- Critical: the app crashed and the session was lost. ----
  {
    test: /main thread|must be used from main thread|nsinternalinconsistency/,
    severity: "critical",
    category: "Crash",
    summary:
      "The app crashed because a screen update ran on the wrong thread.",
  },
  {
    test: /exc_bad_access|sigsegv|segmentation|bad_access|zombie|use[- ]after[- ]free/,
    severity: "critical",
    category: "Crash",
    summary:
      "The app crashed after touching memory it shouldn’t have — a hard crash that ends the session.",
  },
  {
    test: /unexpectedly found nil|force[- ]?unwrap|index out of range|array index|precondition failed|fatal error|fatalerror/,
    severity: "critical",
    category: "Crash",
    summary:
      "The app hit a fatal internal error (a bad assumption in the code) and crashed.",
  },
  {
    test: /exc_breakpoint|exc_bad_instruction|sigabrt|sigill|sigtrap|nsexception|nsinvalidargument|nsrangeexception|abort\(\)|terminating/,
    severity: "critical",
    category: "Crash",
    summary:
      "The app crashed due to an unexpected internal error.",
  },

  // ---- Data layer (caught): a feature likely misbehaved but the app lived. ----
  {
    test: /repositoryerror|decodingerror|encodingerror|postgrest|supabase|keynotfound|typemismatch|http (4|5)\d\d|status ?code ?(4|5)\d\d/,
    severity: "medium",
    category: "Error",
    summary:
      "A data operation failed. The app caught it, but a feature may not have worked correctly.",
  },
];

/** Fallback when no rule matches — lean on Sentry's own level. */
function fallbackByLevel(level: string | null): CrashClassification {
  switch ((level ?? "").toLowerCase()) {
    case "fatal":
      return {
        severity: "critical",
        category: "Crash",
        summary: "The app crashed. We don’t have a plain-English summary for this one yet — open the technical detail below.",
      };
    case "error":
      return {
        severity: "medium",
        category: "Error",
        summary: "Something went wrong in a feature. The app kept running.",
      };
    case "warning":
      return {
        severity: "low",
        category: "Handled",
        summary: "A minor, handled problem was reported. No crash.",
      };
    default:
      return {
        severity: "low",
        category: "Info",
        summary: "A low-level diagnostic event. Not a crash.",
      };
  }
}

/**
 * Classify a crash from the fields we store on `crash_reports`.
 * `eventCount` is accepted for future frequency-based escalation; v1 keeps
 * the mapping purely signature-driven (predictable, per the curated choice).
 */
export function classifyCrash(input: {
  level: string | null;
  message: string | null;
  culprit: string | null;
  eventCount?: number;
}): CrashClassification {
  const haystack = `${input.message ?? ""} ${input.culprit ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(haystack)) {
      return {
        severity: rule.severity,
        category: rule.category,
        summary: rule.summary,
      };
    }
  }
  return fallbackByLevel(input.level);
}

// ---------------------------------------------------------------------------
// Display metadata — one source of truth for badge label / colour / ordering.
// ---------------------------------------------------------------------------

export const SEVERITY_META: Record<
  CrashSeverity,
  { label: string; short: string; rank: number; dot: string; chip: string }
> = {
  critical: {
    label: "Critical",
    short: "🔴",
    rank: 4,
    dot: "bg-alert",
    chip: "border-alert/40 bg-alert/10 text-alert",
  },
  high: {
    label: "High",
    short: "🟠",
    rank: 3,
    dot: "bg-amber",
    chip: "border-amber/40 bg-amber/10 text-amber",
  },
  medium: {
    label: "Medium",
    short: "🟡",
    rank: 2,
    dot: "bg-yellow-500",
    chip: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  },
  low: {
    label: "Low",
    short: "⚪",
    rank: 1,
    dot: "bg-ink-3",
    chip: "border-rule/70 bg-paper-sunken/50 text-ink-3",
  },
};

/** Sort helper: most-severe first, then by the caller's secondary key. */
export function bySeverityRank(a: CrashSeverity, b: CrashSeverity): number {
  return SEVERITY_META[b].rank - SEVERITY_META[a].rank;
}

/**
 * Best-effort friendly location from Sentry's `culprit`. Sentry culprits look
 * like `Vestige.CourseDetailView.body.getter` or `closure #1 in …`. We strip
 * the module prefix and closure noise and return the most human token, or null
 * when there's nothing useful. Kept deliberately conservative — a wrong guess
 * is worse than none.
 */
export function friendlyLocation(culprit: string | null): string | null {
  if (!culprit) return null;
  const cleaned = culprit
    .replace(/^Vestige[./]/, "")
    .replace(/closure #\d+ in /gi, "")
    .replace(/\.(body|getter|setter|init)(\.\w+)?$/i, "")
    .trim();
  if (!cleaned || cleaned.length > 80) return null;
  return cleaned;
}
