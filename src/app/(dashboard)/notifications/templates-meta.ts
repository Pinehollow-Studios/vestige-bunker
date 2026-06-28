/**
 * Per-kind metadata for the notification copy editor.
 *
 * The ~20 system notification kinds have dynamic copy, so an admin edits a
 * TEMPLATE with `{token}` placeholders. This file holds, per kind: a label, the
 * tokens it exposes (with a sample value for the live preview), and the
 * built-in DEFAULT copy (shown as a placeholder / reference). Mirrors the iOS
 * `NotificationPresentation` + `send-apns` built-in strings — when a field is
 * left blank, the client falls back to that built-in, so this is reference
 * text, not the source of truth. `admin_broadcast` is excluded (free-form).
 */

export type TemplateToken = { token: string; sample: string; desc: string };

export type TemplateKindMeta = {
  kind: string;
  label: string;
  category: "Friends" | "Social" | "Collection" | "Feedback" | "Societies" | "Safeguarding";
  tokens: TemplateToken[];
  defaults: {
    pushTitle: string;
    pushBody: string;
    inboxTitle: string; // the inbox headline (supports *bold*)
    inboxBody: string; // the quiet subline (optional)
  };
};

const NAME: TemplateToken = { token: "name", sample: "Sarah", desc: "The person's name" };

export const TEMPLATE_KINDS: TemplateKindMeta[] = [
  {
    kind: "friend_request_received",
    label: "Friend request received",
    category: "Friends",
    tokens: [NAME],
    defaults: { pushTitle: "New friend request", pushBody: "{name} sent you a friend request", inboxTitle: "*{name}* sent you a friend request", inboxBody: "" },
  },
  {
    kind: "friend_request_accepted",
    label: "Friend request accepted",
    category: "Friends",
    tokens: [NAME],
    defaults: { pushTitle: "Request accepted", pushBody: "{name} accepted your friend request", inboxTitle: "*{name}* accepted your friend request", inboxBody: "" },
  },
  {
    kind: "friend_reacted_to_round",
    label: "Reaction on your round",
    category: "Social",
    tokens: [NAME, { token: "reactors", sample: "Sarah and 2 others", desc: "The reactor(s), pluralised" }],
    defaults: { pushTitle: "Your round", pushBody: "{reactors} reacted to your round", inboxTitle: "*{name}* reacted to your round", inboxBody: "" },
  },
  {
    kind: "round_commented",
    label: "Comment on your round",
    category: "Social",
    tokens: [NAME, { token: "comment", sample: "Lovely course!", desc: "The comment text" }],
    defaults: { pushTitle: "Your round", pushBody: "{name} commented on your round", inboxTitle: "*{name}* commented on your round", inboxBody: "{comment}" },
  },
  {
    kind: "partner_tagged",
    label: "Tagged in a round",
    category: "Social",
    tokens: [NAME],
    defaults: { pushTitle: "Tagged in a round", pushBody: "{name} tagged you in a round", inboxTitle: "*{name}* tagged you in a round", inboxBody: "Tap to see the round" },
  },
  {
    kind: "partner_claimed_your_round",
    label: "Partner claimed your round",
    category: "Social",
    tokens: [NAME],
    defaults: { pushTitle: "Round claimed", pushBody: "{name} claimed a round you played together", inboxTitle: "*{name}* claimed a round you played together", inboxBody: "" },
  },
  {
    kind: "badge_earned",
    label: "Badge earned",
    category: "Collection",
    tokens: [{ token: "badge", sample: "Surrey complete", desc: "The badge name" }],
    defaults: { pushTitle: "Badge earned", pushBody: "You earned a badge — tap to see it", inboxTitle: "You earned a badge", inboxBody: "" },
  },
  {
    kind: "your_list_verified",
    label: "Your list verified",
    category: "Collection",
    tokens: [],
    defaults: { pushTitle: "List verified", pushBody: "Your list was verified", inboxTitle: "Your list was verified", inboxBody: "" },
  },
  {
    kind: "community_list_updated",
    label: "Saved list updated",
    category: "Collection",
    tokens: [{ token: "list", sample: "Heathland gems", desc: "The list name" }],
    defaults: { pushTitle: "List updated", pushBody: "{list} has a new course", inboxTitle: "{list} has a new course", inboxBody: "" },
  },
  {
    kind: "course_photo_approved",
    label: "Course photo approved",
    category: "Collection",
    tokens: [{ token: "course", sample: "Sunningdale", desc: "The course name" }],
    defaults: { pushTitle: "Photo approved", pushBody: "Your photo of {course} is now live", inboxTitle: "Your photo of {course} is now live", inboxBody: "" },
  },
  {
    kind: "course_photo_rejected",
    label: "Course photo rejected",
    category: "Collection",
    tokens: [{ token: "course", sample: "Sunningdale", desc: "The course name" }],
    defaults: { pushTitle: "Photo not used", pushBody: "Your photo of {course} couldn’t be used", inboxTitle: "Your photo of {course} couldn’t be used", inboxBody: "" },
  },
  {
    kind: "county_courses_added",
    label: "New course in a completed county",
    category: "Collection",
    tokens: [
      { token: "courses", sample: "2 new courses", desc: "New courses, pluralised (e.g. 1 new course)" },
      { token: "county", sample: "Surrey", desc: "The county name" },
      { token: "played", sample: "34", desc: "How many they've played" },
      { token: "total", sample: "36", desc: "Total courses in the county" },
    ],
    defaults: { pushTitle: "New course added", pushBody: "{courses} added to {county}", inboxTitle: "{courses} added to {county}", inboxBody: "You’re now at {played} of {total}" },
  },
  {
    kind: "feedback_in_progress",
    label: "Feedback — working on it",
    category: "Feedback",
    tokens: [{ token: "message", sample: "We’re looking into it", desc: "Your note to the user (shown as the message)" }],
    defaults: { pushTitle: "Vestige", pushBody: "{message}", inboxTitle: "{message}", inboxBody: "" },
  },
  {
    kind: "feedback_message_posted",
    label: "Feedback — admin replied",
    category: "Feedback",
    tokens: [],
    defaults: { pushTitle: "Vestige", pushBody: "The team replied to your feedback", inboxTitle: "The team replied to your feedback", inboxBody: "" },
  },
  {
    kind: "feedback_resolved",
    label: "Feedback — resolved",
    category: "Feedback",
    tokens: [],
    defaults: { pushTitle: "Vestige", pushBody: "Something you flagged was fixed", inboxTitle: "Something you flagged was fixed", inboxBody: "" },
  },
  {
    kind: "admin_outreach_received",
    label: "Admin outreach",
    category: "Safeguarding",
    tokens: [],
    defaults: { pushTitle: "Vestige", pushBody: "A message from Vestige — tap to read", inboxTitle: "A message from Vestige", inboxBody: "" },
  },
  {
    kind: "account_status_changed",
    label: "Account status changed",
    category: "Safeguarding",
    tokens: [{ token: "status", sample: "restricted", desc: "The new account status" }],
    defaults: { pushTitle: "Vestige", pushBody: "Your account status changed — tap for details", inboxTitle: "Your account status changed", inboxBody: "Check your feedback inbox for the details" },
  },
  {
    kind: "society_invite_received",
    label: "Society invite",
    category: "Societies",
    tokens: [NAME, { token: "society", sample: "The Saturday Four", desc: "The society name" }],
    defaults: { pushTitle: "Society invite", pushBody: "{name} invited you to {society}", inboxTitle: "*{name}* invited you to {society}", inboxBody: "" },
  },
  {
    kind: "society_challenge_received",
    label: "Society challenge (Singles)",
    category: "Societies",
    tokens: [NAME, { token: "society", sample: "The Saturday Four", desc: "The society name" }],
    defaults: { pushTitle: "Head to head", pushBody: "{name} challenged you — tap to accept", inboxTitle: "*{name}* challenged you head-to-head", inboxBody: "Tap to accept or decline" },
  },
  {
    kind: "society_format_finished",
    label: "Society Format finished",
    category: "Societies",
    tokens: [
      { token: "title", sample: "Surrey Sprint", desc: "The Format's name" },
      { token: "winner", sample: "Sarah", desc: "The winner's name (if any)" },
    ],
    defaults: { pushTitle: "Format finished", pushBody: "{title} has finished", inboxTitle: "{title} has finished", inboxBody: "" },
  },
];

/** Client-side preview: substitute each token with its sample value, strip the rest, drop *bold* markers. */
export function previewTemplate(template: string, tokens: TemplateToken[]): string {
  let out = template;
  for (const t of tokens) out = out.split(`{${t.token}}`).join(t.sample);
  out = out.replace(/\{[a-zA-Z_]+\}/g, "");
  return out.replace(/\*/g, "");
}
