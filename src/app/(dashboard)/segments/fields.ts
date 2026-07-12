/**
 * The catalogue of fields a segment can filter on — mirrors the SQL whitelist in
 * `20260712200000_segments.sql` (`_segment_compile_where`). Keep the two in sync:
 * a field here that the compiler doesn't know will error on count/save.
 */

export type FieldKind = "number" | "enum" | "bool" | "county" | "text";

export type SegmentField = {
  key: string;
  label: string;
  group: "Behaviour" | "Profile" | "Demographics";
  kind: FieldKind;
  unit?: string;
  options?: { value: string; label: string }[];
};

export const SEGMENT_FIELDS: SegmentField[] = [
  // Behaviour
  { key: "courses_played", label: "Courses played", group: "Behaviour", kind: "number", unit: "courses" },
  { key: "counties_touched", label: "Counties touched", group: "Behaviour", kind: "number", unit: "counties" },
  { key: "rounds_logged", label: "Rounds logged", group: "Behaviour", kind: "number", unit: "rounds" },
  { key: "friends_count", label: "Friends", group: "Behaviour", kind: "number", unit: "friends" },
  { key: "days_since_signup", label: "Days since signup", group: "Behaviour", kind: "number", unit: "days" },
  { key: "days_since_active", label: "Days since last round", group: "Behaviour", kind: "number", unit: "days" },

  // Profile
  {
    key: "privacy",
    label: "Profile privacy",
    group: "Profile",
    kind: "enum",
    options: [
      { value: "everyone", label: "Public" },
      { value: "friendsOnly", label: "Private" },
    ],
  },
  {
    key: "account_status",
    label: "Account status",
    group: "Profile",
    kind: "enum",
    options: [
      { value: "active", label: "Active" },
      { value: "restricted", label: "Restricted" },
      { value: "suspended", label: "Suspended" },
    ],
  },
  { key: "home_county_id", label: "Home county", group: "Profile", kind: "county" },
  { key: "has_home_county", label: "Has a home county", group: "Profile", kind: "bool" },
  { key: "is_founding_member", label: "Founding member", group: "Profile", kind: "bool" },
  { key: "marketing_opt_out", label: "Opted out of marketing", group: "Profile", kind: "bool" },

  // Demographics
  {
    key: "age_band",
    label: "Age band",
    group: "Demographics",
    kind: "enum",
    options: [
      { value: "17_24", label: "17–24" },
      { value: "25_34", label: "25–34" },
      { value: "35_44", label: "35–44" },
      { value: "45_54", label: "45–54" },
      { value: "55_64", label: "55–64" },
      { value: "65_plus", label: "65+" },
    ],
  },
];

export function fieldByKey(key: string): SegmentField | undefined {
  return SEGMENT_FIELDS.find((f) => f.key === key);
}

export const NUMBER_OPERATORS = [
  { value: "gte", label: "at least" },
  { value: "lte", label: "at most" },
  { value: "eq", label: "exactly" },
];
export const IS_OPERATORS = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
];

// ── Definition tree ──────────────────────────────────────────────────────

export type SegmentRule = { field: string; operator: string; value: string | number | boolean };
export type SegmentGroup = { op: "and" | "or"; rules: SegmentNode[] };
export type SegmentNode = SegmentGroup | SegmentRule;

export function isGroup(node: SegmentNode): node is SegmentGroup {
  return (node as SegmentGroup).rules !== undefined;
}

/** A fresh leaf defaulted to the first field. */
export function newRule(): SegmentRule {
  return { field: "courses_played", operator: "gte", value: 1 };
}
export function newGroup(): SegmentGroup {
  return { op: "and", rules: [newRule()] };
}

/** Human summary of a definition, e.g. "All of: courses played ≥ 5 · Public". */
export function describeNode(node: SegmentNode): string {
  if (isGroup(node)) {
    if (node.rules.length === 0) return "everyone";
    const joiner = node.op === "or" ? " or " : " and ";
    return node.rules.map(describeNode).join(joiner);
  }
  const f = fieldByKey(node.field);
  if (!f) return node.field;
  if (f.kind === "bool") return `${f.label.toLowerCase()} ${node.value ? "yes" : "no"}`;
  if (f.kind === "number") {
    const op = node.operator === "gte" ? "≥" : node.operator === "lte" ? "≤" : "=";
    return `${f.label.toLowerCase()} ${op} ${node.value}`;
  }
  const opt = f.options?.find((o) => o.value === node.value);
  const verb = node.operator === "neq" ? "is not" : "is";
  return `${f.label.toLowerCase()} ${verb} ${opt?.label ?? node.value}`;
}
