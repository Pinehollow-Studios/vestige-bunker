/**
 * Ready-made, on-brand email starters for the composer. Jack picks one, it drops
 * into the HTML box already looking like Vestige, and he edits the words. This is
 * the "HTML + templates" approach — no blank box, no design work, always branded.
 *
 * Each is self-contained HTML with inline styles (email clients strip <style>),
 * a light readable background, the Vestige mark, and a footer carrying the
 * {{unsubscribe_url}} token (the sender fills it per recipient; if a starter ever
 * omitted it, the sender appends one anyway). {{first_name}} personalises.
 */

const MINT = "#3FA889";
const INK = "#0E1116";
const BODY = "#3A4048";
const MUTED = "#8A8F98";
const PAPER = "#F4F6F5";
const LINE = "#E4E8E6";

/** Wrap body content in the branded shell (header mark + card + footer). */
function shell(inner: string): string {
  return `<!-- Vestige email -->
<div style="margin:0;padding:0;background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:4px 8px 20px 8px;">
          <span style="font-size:15px;font-weight:800;letter-spacing:3px;color:${INK};text-transform:uppercase;">Vestige</span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
          <div style="height:4px;background:linear-gradient(90deg,#5BE4C3,#8FE85B);font-size:0;line-height:0;">&nbsp;</div>
          <div style="padding:32px 32px 36px 32px;">
${inner}
          </div>
        </td></tr>
        <tr><td style="padding:20px 8px;text-align:center;">
          <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:${MUTED};">
            You're receiving this from Vestige.
            <a href="{{unsubscribe_url}}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
          </p>
          <p style="margin:0;font-size:12px;color:${MUTED};">Vestige · England's golf, collected.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:${INK};">${text}</h1>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${BODY};">${text}</p>`;
}
function button(label: string, href = "https://vestige.golf"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px 0;"><tr><td style="border-radius:999px;background:${MINT};">
    <a href="${href}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr></table>`;
}
function divider(): string {
  return `<div style="height:1px;background:${LINE};margin:24px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}
function eyebrow(text: string): string {
  return `<p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${MINT};">${text}</p>`;
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
    description: "A single clear message with a button.",
    subject: "A quick update from Vestige",
    preheader: "Something new from the Vestige team.",
    html: shell(
      eyebrow("Announcement") +
        h1("Hi {{first_name}}, we've got news") +
        p("Tell them the one thing you want them to know, in a sentence or two. Keep it short and human.") +
        p("Add any detail that matters here — what's changing, when, and why it's good for them.") +
        button("See what's new"),
    ),
  },
  {
    key: "product_update",
    name: "Product update",
    description: "A headline plus a couple of sections.",
    subject: "What's new in Vestige",
    preheader: "The latest improvements, in brief.",
    html: shell(
      eyebrow("Product update") +
        h1("Hi {{first_name}}, here's what's new") +
        p("A short intro line setting up the update.") +
        divider() +
        `<h2 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:${INK};">First thing</h2>` +
        p("Describe the first improvement in a couple of lines.") +
        `<h2 style="margin:16px 0 8px 0;font-size:18px;font-weight:700;color:${INK};">Second thing</h2>` +
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
        p(`<span style="color:${MUTED};">— The Vestige team</span>`),
    ),
  },
  {
    key: "launch",
    name: "Launch / invite",
    description: "Hero headline, a date, and a call to action.",
    subject: "You're invited — Vestige is nearly here",
    preheader: "Be among the first in.",
    html: shell(
      eyebrow("You're on the list") +
        h1("Hi {{first_name}}, it's almost time") +
        p("One line of anticipation — what's coming, and why they'll want it.") +
        p(`<strong style="color:${INK};">When:</strong> add the date here.`) +
        button("Get ready") +
        p(`<span style="font-size:14px;color:${MUTED};">Thanks for being early. It means a lot.</span>`),
    ),
  },
  {
    key: "blank",
    name: "Blank (branded)",
    description: "Just the Vestige shell — write your own body.",
    subject: "",
    preheader: "",
    html: shell(h1("Hi {{first_name}},") + p("Start writing here.")),
  },
];
