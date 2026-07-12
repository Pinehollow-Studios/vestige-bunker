/**
 * Ready-made, on-brand email starters for the composer. Jack picks one, it drops
 * into the content box already looking like Vestige, and he edits the words.
 *
 * Built to the Vestige design system (extracted 2026-07-06):
 *   • Premium black canvas (#070A10), quiet blue soul, cream text (#F2EFE6).
 *   • One accent — mint (#5BE4C3). The mint→lime gradient (#5BE4C3→#8FE85B, 135°)
 *     is RATIONED: it appears only on the single primary button.
 *   • Manrope display font (with a system fallback for clients that can't load it).
 *   • UPPERCASE eyebrow motif (mint dot + tracked caption), calm hierarchy, en-GB
 *     sentence case, the middle dot · as the separator.
 *
 * Email-client realities handled: table layout, inline styles, a solid button
 * colour behind the gradient (Outlook ignores gradients + radius), and a footer
 * carrying {{unsubscribe_url}} (legally required — the sender also appends one if
 * a template ever omitted it). {{first_name}} personalises.
 */

// Design-system tokens (dark appearance — the brand default for outward material).
const SURFACE = "#070A10"; // page
const CARD = "#0C1220"; // SurfaceRaised
const CARD_TOP = "#0E1826"; // faint blue lift at the card head
const BORDER = "#1C2636"; // ~ Border on glass, solid for email
const INK = "#F2EFE6"; // TextPrimary (warm cream)
const BODY = "#9DA9B6"; // TextSecondary
const MUTED = "#66717E"; // TextTertiary
const MINT = "#5BE4C3"; // Accent / AccentInk(dark)
const LIME = "#8FE85B"; // gradient second stop
const ON_ACCENT = "#06231C"; // ink on mint

const FONT =
  "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Wrap body content in the branded shell (mark · card · footer). */
function shell(inner: string): string {
  return `<!-- Vestige email -->
<div style="margin:0;padding:0;background:${SURFACE};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:2px 6px 18px 6px;">
          <span style="font-family:${FONT};font-size:17px;font-weight:600;letter-spacing:0.5px;color:${INK};">Vestige</span>
        </td></tr>
        <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;">
          <div style="background:${CARD_TOP};padding:0;font-size:0;line-height:0;height:3px;">&nbsp;</div>
          <div style="padding:34px 34px 38px 34px;">
${inner}
          </div>
        </td></tr>
        <tr><td style="padding:22px 8px 8px 8px;text-align:center;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};">
            You're receiving this from Vestige · England's golf, collected.
          </p>
          <p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};">
            <a href="{{unsubscribe_url}}" style="color:${BODY};text-decoration:underline;">Unsubscribe</a>
          </p>
          <p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.7;color:${MUTED};">
            Pinehollow Studios · England &nbsp;·&nbsp; <span style="color:${MUTED};">[add postal address]</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function eyebrow(text: string): string {
  return `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BODY};">
    <span style="color:${MINT};">&#9679;</span>&nbsp;&nbsp;${text}</p>`;
}
function h1(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.6px;color:${INK};">${text}</h1>`;
}
function h2(text: string): string {
  return `<h2 style="margin:22px 0 8px 0;font-family:${FONT};font-size:18px;line-height:1.3;font-weight:600;letter-spacing:-0.2px;color:${INK};">${text}</h2>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.7;color:${BODY};">${text}</p>`;
}
function button(label: string, href = "https://vestige.golf"): string {
  // Solid mint behind the gradient so Outlook (no gradient/radius) still looks right.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px 0;"><tr>
    <td align="center" style="border-radius:999px;background:${MINT};background-image:linear-gradient(135deg,${MINT},${LIME});">
      <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:${ON_ACCENT};text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr></table>`;
}
function divider(): string {
  return `<div style="height:1px;background:${BORDER};margin:26px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}
function signoff(): string {
  return `<p style="margin:18px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.7;color:${MUTED};">— The Vestige team</p>`;
}

export type EmailStarter = {
  key: string;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  html: string;
};

export const EMAIL_STARTERS: EmailStarter[] = [
  {
    key: "announcement",
    name: "Announcement",
    description: "One clear message with a button.",
    subject: "A quick update from Vestige",
    preheader: "Something new from the team.",
    html: shell(
      eyebrow("Announcement") +
        h1("Hi {{first_name}}, we've got news") +
        p("Tell them the one thing you want them to know, in a sentence or two. Keep it human and understated.") +
        p("Add the detail that matters — what's changing, when, and why it's good for them.") +
        button("See what's new"),
    ),
  },
  {
    key: "product_update",
    name: "Product update",
    description: "A headline and a couple of sections.",
    subject: "What's new in Vestige",
    preheader: "The latest, in brief.",
    html: shell(
      eyebrow("Product update") +
        h1("Hi {{first_name}}, here's what's new") +
        p("A short line to set up the update.") +
        divider() +
        h2("The first thing") +
        p("Describe the first improvement in a line or two.") +
        h2("The second thing") +
        p("Describe the second improvement.") +
        divider() +
        button("Open Vestige"),
    ),
  },
  {
    key: "note",
    name: "Personal note",
    description: "Plain and personal — reads like a letter.",
    subject: "A note from the Vestige team",
    preheader: "Just a quick hello.",
    html: shell(
      p("Hi {{first_name}},") +
        p("Write this like you're emailing one person. Say the thing you want to say, plainly.") +
        p("Sign off warmly.") +
        signoff(),
    ),
  },
  {
    key: "launch",
    name: "Launch / invite",
    description: "A hero line, a date, and a call to action.",
    subject: "You're in early — Vestige is nearly here",
    preheader: "Be among the first in.",
    html: shell(
      eyebrow("You're on the list") +
        h1("Hi {{first_name}}, it's almost time") +
        p("One line of quiet anticipation — what's coming, and why they'll want it.") +
        p(`<strong style="color:${INK};font-weight:600;">When&nbsp;·&nbsp;</strong>add the date here.`) +
        button("Get ready") +
        p(`<span style="font-size:14px;color:${MUTED};">Thanks for being early. It means a lot.</span>`),
    ),
  },
  {
    key: "blank",
    name: "Blank (branded)",
    description: "Just the Vestige shell — write your own.",
    subject: "",
    preheader: "",
    html: shell(eyebrow("Vestige") + h1("Hi {{first_name}},") + p("Start writing here.")),
  },
];
