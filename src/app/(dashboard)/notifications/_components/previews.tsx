import type { CSSProperties, ReactNode } from "react";

/**
 * Faithful iOS-26 notification + lock-screen mirrors for the dashboard.
 *
 * Key to realism: everything inside a preview renders in the **actual San
 * Francisco** system font via the `-apple-system` stack (the dashboard is
 * viewed on a Mac, so this is the real Apple typeface), and the notification
 * platter is a true frosted material (`backdrop-filter` blur over the
 * wallpaper). Colours are literal iOS values, not dashboard tokens.
 */

const SF: CSSProperties = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif',
  WebkitFontSmoothing: "antialiased",
};

// A realistic iOS wallpaper (deep dusk gradient) with a subtle bottom vignette
// so notifications read legibly - the way iOS darkens behind them.
const WALLPAPER =
  "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.10), transparent 60%)," +
  "linear-gradient(160deg, #3a2b62 0%, #25315f 38%, #18233f 70%, #0c1020 100%)";

function stripStars(s: string): string {
  return s.replace(/\*/g, "");
}

/** Render `*bold*` segments as bold (for the in-app inbox surface only). */
function boldSegments(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let bold = false;
  s.split("*").forEach((seg, i) => {
    if (seg) out.push(bold ? <strong key={i} style={{ fontWeight: 600 }}>{seg}</strong> : <span key={i}>{seg}</span>);
    bold = !bold;
  });
  return out;
}

/** The Vestige app icon - mint→lime squircle + dark golf flag (matches the real icon). */
export function VestigeAppIcon({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.2237),
        background: "linear-gradient(145deg, #5BE4C3 0%, #8FE85B 100%)",
        boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.2)",
        flexShrink: 0,
      }}
      className="flex items-center justify-center"
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 100 100" fill="none">
        <rect x="45" y="16" width="5.5" height="68" rx="2.75" fill="#0E1822" />
        <path d="M50.5 18 L83 30 L50.5 42 Z" fill="#0E1822" />
        <ellipse cx="50" cy="87" rx="23" ry="5" fill="#0E1822" opacity="0.3" />
      </svg>
    </div>
  );
}

/** The bare notification platter (frosted material). Sits over a wallpaper. */
function NotificationPlatter({ title, body, time }: { title: string; body: string; time: string }) {
  return (
    <div
      style={{
        ...SF,
        background: "rgba(244,244,247,0.58)",
        backdropFilter: "blur(22px) saturate(180%)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        borderRadius: 24,
        boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.5), 0 6px 22px rgba(0,0,0,0.22)",
      }}
      className="flex gap-2.5 px-3 py-2.5"
    >
      <VestigeAppIcon size={38} />
      <div className="min-w-0 flex-1" style={{ paddingTop: 1 }}>
        <div className="flex items-baseline justify-between gap-2">
          <p style={{ fontSize: 15, fontWeight: 600, color: "#000", lineHeight: 1.2 }} className="truncate">
            {/* No title set → iOS shows the app name. */}
            {stripStars(title) || "Vestige"}
          </p>
          <span style={{ fontSize: 12.5, color: "rgba(0,0,0,0.42)", fontWeight: 400 }} className="shrink-0">
            {time}
          </span>
        </div>
        {stripStars(body) && (
          <p style={{ fontSize: 14.5, color: "rgba(0,0,0,0.82)", lineHeight: 1.32 }} className="mt-px line-clamp-4">
            {stripStars(body)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A notification banner on a slice of wallpaper - for cards/thumbnails. */
export function IOSNotification({ title, body, time = "now" }: { title: string; body: string; time?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl p-2.5" style={{ background: WALLPAPER }}>
      <NotificationPlatter title={title} body={body} time={time} />
    </div>
  );
}

/** The in-app inbox row (Vestige dark "Atlas" surface) - for the inbox copy. */
export function VestigeInboxRow({
  title,
  body,
  icon,
  unread = true,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  unread?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
      style={{ ...SF, background: "rgba(20,34,53,0.92)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[#0E1822]"
        style={{ background: "linear-gradient(145deg,#5BE4C3,#8FE85B)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 14, color: "#F3F0E5", lineHeight: 1.35 }}>{title.trim() ? boldSegments(title) : "Vestige"}</p>
        {stripStars(body) && (
          <p style={{ fontSize: 12.5, color: "rgba(243,240,229,0.55)", lineHeight: 1.35 }}>{stripStars(body)}</p>
        )}
        <p style={{ fontSize: 10, letterSpacing: 0.4, color: "rgba(243,240,229,0.35)" }} className="mt-0.5 uppercase">
          now
        </p>
      </div>
      {unread && <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: "#5BE4C3" }} />}
    </div>
  );
}
