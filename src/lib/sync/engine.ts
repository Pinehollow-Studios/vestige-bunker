import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { courseCoverStorageKey, curatedCoverStorageKey } from "@/lib/storage";
import type { SyncClients } from "./clients";

/**
 * Editorial dev→prod mirror engine.
 *
 * Prod editorial is a pure downstream replica of dev. Course/county/
 * club/badge UUIDs differ across the two projects (the import never
 * sets `id`; badge defs were seeded independently), so EVERY reference
 * is resolved through stable natural keys — never raw UUIDs:
 *   - courses   → matched by `legacy_fid` (fallback `slug`)
 *   - counties  → matched by `slug`
 *   - lists     → matched by `slug`
 *   - badges    → matched by `slug`
 *
 * Scope ("everything editorial"):
 *   1. Course editorial fields — UPDATE-by-key overlay (never insert/
 *      delete; the import owns course rows).
 *   2. Curated lists + membership + covers — FULL MIRROR (create /
 *      update / delete by slug).
 *   3. Badge definitions + art — FULL MIRROR with earned-badge-safe
 *      deletes (a delete that would cascade earned `badges` is
 *      downgraded to archive).
 *
 * Two modes: `dry` computes the diff with no writes; `apply` executes.
 * Same input → idempotent (a second apply reports zero changes).
 */

export type SyncMode = "dry" | "apply";

export type ChangeKind = "create" | "update" | "delete" | "archive" | "skip";

export type EntityChange = {
  kind: ChangeKind;
  label: string;
  detail?: string;
};

export type EntityReport = {
  entity: string;
  created: number;
  updated: number;
  deleted: number;
  archived: number;
  skipped: number;
  /** Capped sample of detailed change rows (counts above are exact). */
  changes: EntityChange[];
  warnings: string[];
};

export type SyncReport = {
  mode: SyncMode;
  ok: boolean;
  error?: string;
  entities: EntityReport[];
};

const MAX_DETAIL = 120;

// Editorial columns mirrored onto prod courses (identity + geometry
// are owned by the import and never touched).
const COURSE_EDITORIAL = [
  "description",
  "par",
  "yards",
  "style",
  "established",
  "type",
  "tier",
  "hole_count",
] as const;

const CURATED_COLUMNS = [
  "name",
  "slug",
  "description",
  "bio",
  "tags",
  "region",
  "tier",
  "display_priority",
  "is_ordered",
  "published_at",
  "unpublished_at",
  "is_archived",
] as const;

const BADGE_COLUMNS = [
  "slug",
  "name",
  "tagline",
  "description",
  "how_to_earn",
  "glyph",
  "theme",
  "tint_hex",
  "tier",
  "shape",
  "effect",
  "criteria",
  "category",
  "series_key",
  "series_rank",
  "display_priority",
  "is_published",
  "is_secret",
  "is_archived",
] as const;

type Row = Record<string, unknown>;

// ── small helpers ────────────────────────────────────────────────────

/** Stable JSON (sorted keys, recursive) for value comparison. */
function stable(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Row).sort()) {
      out[k] = sortKeys((value as Row)[k]);
    }
    return out;
  }
  return value;
}
function pick(row: Row, keys: readonly string[]): Row {
  const out: Row = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}
function objPath(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  return storageKey.split("?", 1)[0];
}
function buster(): string {
  return crypto.randomUUID().slice(0, 8);
}

function emptyReport(entity: string): EntityReport {
  return {
    entity,
    created: 0,
    updated: 0,
    deleted: 0,
    archived: 0,
    skipped: 0,
    changes: [],
    warnings: [],
  };
}
function note(report: EntityReport, kind: ChangeKind, label: string, detail?: string) {
  if (kind === "create") report.created += 1;
  else if (kind === "update") report.updated += 1;
  else if (kind === "delete") report.deleted += 1;
  else if (kind === "archive") report.archived += 1;
  else report.skipped += 1;
  if (report.changes.length < MAX_DETAIL) report.changes.push({ kind, label, detail });
}

async function fetchAll(client: SupabaseClient, table: string, columns: string): Promise<Row[]> {
  const { data, error } = await client.from(table).select(columns).limit(5000);
  if (error) throw new Error(`read ${table}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

/** Copy a public-bucket object dev→prod. Returns false on any failure
 *  (logged into the entity warnings by the caller). */
async function copyBlob(
  clients: SyncClients,
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<boolean> {
  const dl = await clients.dev.storage.from(bucket).download(fromPath);
  if (dl.error || !dl.data) return false;
  const buf = await dl.data.arrayBuffer();
  const up = await clients.prod.storage
    .from(bucket)
    .upload(toPath, buf, { contentType: dl.data.type || "image/jpeg", upsert: true });
  return !up.error;
}

// ── entity 1: course editorial overlay ───────────────────────────────

type CourseMaps = {
  /** dev course id → prod course id, via legacy_fid then slug. */
  devToProd: Map<string, string>;
};

async function syncCourses(
  clients: SyncClients,
  mode: SyncMode,
): Promise<{ report: EntityReport; maps: CourseMaps }> {
  const report = emptyReport("Courses (editorial)");
  const cols = `id,slug,legacy_fid,hero_photo_storage_key,${COURSE_EDITORIAL.join(",")}`;
  const [dev, prod] = await Promise.all([
    fetchAll(clients.dev, "courses", cols),
    fetchAll(clients.prod, "courses", cols),
  ]);

  const prodBySlug = new Map<string, Row>();
  const prodByFid = new Map<number, Row>();
  for (const p of prod) {
    prodBySlug.set(p.slug as string, p);
    if (p.legacy_fid != null) prodByFid.set(p.legacy_fid as number, p);
  }

  const devToProd = new Map<string, string>();

  for (const d of dev) {
    const match =
      (d.legacy_fid != null ? prodByFid.get(d.legacy_fid as number) : undefined) ??
      prodBySlug.get(d.slug as string);
    if (!match) {
      note(
        report,
        "skip",
        d.slug as string,
        "no prod course with this legacy_fid/slug — re-run import-courses on prod",
      );
      continue;
    }
    devToProd.set(d.id as string, match.id as string);

    const editorialDiffers = stable(pick(d, COURSE_EDITORIAL)) !== stable(pick(match, COURSE_EDITORIAL));
    const devHero = (d.hero_photo_storage_key as string | null) ?? null;
    const prodHero = (match.hero_photo_storage_key as string | null) ?? null;
    // First-time copy / clear only — content drift on an existing cover
    // isn't detected by key compare (keys embed differing ids). Covers
    // change rarely; documented limitation.
    const heroAction: "copy" | "clear" | "none" = devHero && !prodHero ? "copy" : !devHero && prodHero ? "clear" : "none";

    if (!editorialDiffers && heroAction === "none") continue;

    const detailBits: string[] = [];
    if (editorialDiffers) detailBits.push("editorial fields");
    if (heroAction === "copy") detailBits.push("+ hero photo");
    if (heroAction === "clear") detailBits.push("− hero photo");
    note(report, "update", d.slug as string, detailBits.join(" "));

    if (mode === "apply") {
      const update: Row = editorialDiffers ? pick(d, COURSE_EDITORIAL) : {};
      const prodId = match.id as string;
      if (heroAction === "copy") {
        const fromPath = objPath(devHero);
        const { path, key } = courseCoverStorageKey(prodId, buster());
        const ok = fromPath ? await copyBlob(clients, "course-covers", fromPath, path) : false;
        if (ok) update.hero_photo_storage_key = key;
        else report.warnings.push(`${d.slug}: hero photo copy failed`);
      } else if (heroAction === "clear") {
        update.hero_photo_storage_key = null;
        await clients.prod.storage
          .from("course-covers")
          .remove([courseCoverStorageKey(prodId).path]);
      }
      if (Object.keys(update).length > 0) {
        const { error } = await clients.prod.from("courses").update(update).eq("id", prodId);
        if (error) report.warnings.push(`${d.slug}: update failed — ${error.message}`);
      }
    }
  }

  return { report, maps: { devToProd } };
}

// ── entity 2: curated lists (full mirror) ─────────────────────────────

async function syncCuratedLists(
  clients: SyncClients,
  mode: SyncMode,
  courseMaps: CourseMaps,
): Promise<EntityReport> {
  const report = emptyReport("Curated lists");

  const listCols = `id,${CURATED_COLUMNS.join(",")},cover_storage_key`;
  const [devLists, prodListsBefore] = await Promise.all([
    fetchAll(clients.dev, "curated_lists", listCols),
    fetchAll(clients.prod, "curated_lists", listCols),
  ]);
  const devSlugs = new Set(devLists.map((l) => l.slug as string));
  const prodBySlug = new Map<string, Row>();
  for (const p of prodListsBefore) prodBySlug.set(p.slug as string, p);

  // 2a. upsert dev lists (create + update by slug). Cover handled after.
  for (const d of devLists) {
    const slug = d.slug as string;
    const existing = prodBySlug.get(slug);
    const differs = !existing || stable(pick(d, CURATED_COLUMNS)) !== stable(pick(existing, CURATED_COLUMNS));
    if (!differs) continue;
    note(report, existing ? "update" : "create", slug);
    if (mode === "apply") {
      const { error } = await clients.prod
        .from("curated_lists")
        .upsert(pick(d, CURATED_COLUMNS), { onConflict: "slug" });
      if (error) report.warnings.push(`${slug}: upsert failed — ${error.message}`);
    }
  }

  // 2b. deletes — prod lists whose slug isn't in dev.
  for (const p of prodListsBefore) {
    const slug = p.slug as string;
    if (devSlugs.has(slug)) continue;
    note(report, "delete", slug, "not present in dev");
    if (mode === "apply") {
      const cover = objPath(p.cover_storage_key as string | null);
      if (cover) await clients.prod.storage.from("list-covers").remove([cover]);
      const { error } = await clients.prod.from("curated_lists").delete().eq("id", p.id as string);
      if (error) report.warnings.push(`${slug}: delete failed — ${error.message}`);
    }
  }

  // From here on we need prod list ids by slug. In apply mode re-read
  // (newly-created rows now exist); in dry mode use what existed before.
  const prodListIdBySlug = new Map<string, string>();
  if (mode === "apply") {
    const after = await fetchAll(clients.prod, "curated_lists", "id,slug,cover_storage_key");
    for (const p of after) prodListIdBySlug.set(p.slug as string, p.id as string);
  } else {
    for (const p of prodListsBefore) prodListIdBySlug.set(p.slug as string, p.id as string);
  }

  // 2c. covers + membership per dev list.
  const [devMembers, prodMembers] = await Promise.all([
    fetchAll(clients.dev, "curated_list_courses", "curated_list_id,course_id,position,editor_note"),
    fetchAll(clients.prod, "curated_list_courses", "curated_list_id,course_id,position,editor_note"),
  ]);
  const devMembersByList = groupBy(devMembers, (m) => m.curated_list_id as string);
  const prodMembersByList = groupBy(prodMembers, (m) => m.curated_list_id as string);

  for (const d of devLists) {
    const slug = d.slug as string;
    const prodListId = prodListIdBySlug.get(slug); // may be undefined in dry-run for new lists

    // Cover: copy when dev has one (re-key to prod list id); clear when not.
    const devCover = objPath(d.cover_storage_key as string | null);
    if (devCover && prodListId) {
      if (mode === "apply") {
        const { path, key } = curatedCoverStorageKey(prodListId, buster());
        const ok = await copyBlob(clients, "list-covers", devCover, path);
        if (ok) {
          const { error } = await clients.prod
            .from("curated_lists")
            .update({ cover_storage_key: key })
            .eq("id", prodListId);
          if (error) report.warnings.push(`${slug}: cover key update failed — ${error.message}`);
        } else {
          report.warnings.push(`${slug}: cover copy failed`);
        }
      }
    }

    // Membership: resolve dev course ids → prod course ids, replace wholesale.
    const desired: DesiredMember[] = [];
    for (const m of devMembersByList.get(d.id as string) ?? []) {
      const prodCourseId = courseMaps.devToProd.get(m.course_id as string);
      if (!prodCourseId) {
        report.warnings.push(`${slug}: member course not in prod (skipped)`);
        continue;
      }
      desired.push({
        course_id: prodCourseId,
        position: (m.position as number | null) ?? null,
        editor_note: (m.editor_note as string | null) ?? null,
      });
    }

    const existingForList = prodListId ? prodMembersByList.get(prodListId) ?? [] : [];
    const membershipDiffers =
      !prodListId ||
      stable(normaliseMembers(existingForList)) !== stable(normaliseMembers(desired));
    if (membershipDiffers && desired.length >= 0 && (prodListId || mode === "dry")) {
      note(
        report,
        prodListId && existingForList.length ? "update" : "create",
        `${slug} · membership`,
        `${desired.length} course${desired.length === 1 ? "" : "s"}`,
      );
      if (mode === "apply" && prodListId) {
        await clients.prod
          .from("curated_list_courses")
          .delete()
          .eq("curated_list_id", prodListId);
        if (desired.length > 0) {
          const rows = desired.map((r) => ({ ...r, curated_list_id: prodListId }));
          const { error } = await clients.prod.from("curated_list_courses").insert(rows);
          if (error) report.warnings.push(`${slug}: membership insert failed — ${error.message}`);
        }
      }
    }
  }

  return report;
}

type DesiredMember = {
  course_id: string;
  position: number | null;
  editor_note: string | null;
};

function normaliseMembers(members: Row[]): Row[] {
  return members
    .map((m) => ({
      course_id: m.course_id ?? null,
      position: m.position ?? null,
      editor_note: m.editor_note ?? null,
    }))
    .sort((a, b) => String(a.course_id).localeCompare(String(b.course_id)));
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

// ── entity 3: badge definitions (full mirror, earned-safe deletes) ────

type RefMaps = {
  courseDevToProd: Map<string, string>;
  countyDevToProd: Map<string, string>;
  /** dev curated-list id → prod curated-list id (only resolvable in
   *  apply mode for newly-created lists; in dry-run we only know the
   *  slug WILL resolve). */
  listDevToProd: Map<string, string>;
  /** dev curated-list id → slug, for dry-run resolvability checks. */
  listDevSlug: Map<string, string>;
  /** slugs that exist (or will exist) in prod after the list mirror. */
  listProdSlugs: Set<string>;
  countyDevId: Map<string, string>; // dev county id → slug (debug labels)
};

function rewriteCriteria(
  criteria: Row,
  maps: RefMaps,
  mode: SyncMode,
): { criteria: Row; unresolved: string[] } {
  const unresolved: string[] = [];
  const out: Row = { ...criteria };
  const type = criteria.type as string;

  const resolveCounty = (devId: string, slot: string): string | null => {
    const prodId = maps.countyDevToProd.get(devId);
    if (!prodId) unresolved.push(`county (${slot})`);
    return prodId ?? null;
  };

  if (type === "specific_course") {
    const prodId = maps.courseDevToProd.get(criteria.course_id as string);
    if (!prodId) unresolved.push("course");
    else out.course_id = prodId;
  } else if (type === "specific_county_complete") {
    const prodId = resolveCounty(criteria.county_id as string, "county");
    if (prodId) out.county_id = prodId;
  } else if (type === "specific_list_complete") {
    const devListId = criteria.curated_list_id as string;
    const slug = maps.listDevSlug.get(devListId);
    if (!slug || !maps.listProdSlugs.has(slug)) {
      unresolved.push("curated list");
    } else {
      const prodId = maps.listDevToProd.get(devListId);
      if (prodId) {
        // List already exists in prod → resolve fully (keeps repeat
        // dry-runs idempotent rather than re-reporting a diff).
        out.curated_list_id = prodId;
      } else if (mode === "apply") {
        // Shouldn't happen — lists are mirrored before badges in apply.
        unresolved.push("curated list");
      }
      // dry-run + list not yet in prod (brand-new): slug will resolve
      // after the list mirror; leave the id placeholder (never written
      // in dry mode anyway).
    }
  } else if (type === "count_threshold") {
    const scope = criteria.scope as Row | undefined;
    if (scope && scope.county_id) {
      const prodId = resolveCounty(scope.county_id as string, "scope.county");
      if (prodId) out.scope = { ...scope, county_id: prodId };
    }
  }

  return { criteria: out, unresolved };
}

async function syncBadgeDefinitions(
  clients: SyncClients,
  mode: SyncMode,
  maps: RefMaps,
): Promise<EntityReport> {
  const report = emptyReport("Badge definitions");

  const cols = `id,${BADGE_COLUMNS.join(",")},custom_image_key`;
  const [dev, prodBefore] = await Promise.all([
    fetchAll(clients.dev, "badge_definitions", cols),
    fetchAll(clients.prod, "badge_definitions", cols),
  ]);
  const devSlugs = new Set(dev.map((b) => b.slug as string));
  const prodBySlug = new Map<string, Row>();
  for (const p of prodBefore) prodBySlug.set(p.slug as string, p);

  // 3a. upsert (create + update), with criteria rewritten + audit nulled.
  for (const d of dev) {
    const slug = d.slug as string;
    const { criteria, unresolved } = rewriteCriteria(d.criteria as Row, maps, mode);
    if (unresolved.length > 0) {
      note(report, "skip", slug, `unresolved ${unresolved.join(", ")} in prod`);
      continue;
    }
    const devRow = { ...pick(d, BADGE_COLUMNS), criteria };
    const existing = prodBySlug.get(slug);
    const differs = !existing || stable(devRow) !== stable(pick(existing, BADGE_COLUMNS));
    if (differs) {
      note(report, existing ? "update" : "create", slug);
      if (mode === "apply") {
        const { error } = await clients.prod
          .from("badge_definitions")
          .upsert(devRow, { onConflict: "slug" });
        if (error) report.warnings.push(`${slug}: upsert failed — ${error.message}`);
      }
    }

    // Art: copy when dev has custom artwork (re-key to prod def id).
    const devArt = objPath(d.custom_image_key as string | null);
    if (devArt && mode === "apply") {
      // Need prod def id — re-read once below would be heavy; fetch the one row.
      const { data: prodDef } = await clients.prod
        .from("badge_definitions")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      const prodId = (prodDef as Row | null)?.id as string | undefined;
      if (prodId) {
        const toPath = `badges/${prodId}/art.png`;
        const ok = await copyBlob(clients, "badge-art", devArt, toPath);
        if (ok) {
          await clients.prod
            .from("badge_definitions")
            .update({ custom_image_key: `${toPath}?v=${buster()}` })
            .eq("id", prodId);
        } else {
          report.warnings.push(`${slug}: art copy failed`);
        }
      }
    }
  }

  // 3b. deletes — prod defs whose slug isn't in dev. Earned-safe: if any
  // `badges` row references the def (ON DELETE CASCADE would wipe earned
  // badges), archive instead of deleting.
  for (const p of prodBefore) {
    const slug = p.slug as string;
    if (devSlugs.has(slug)) continue;
    const prodId = p.id as string;
    const { count } = await clients.prod
      .from("badges")
      .select("id", { count: "exact", head: true })
      .eq("definition_id", prodId);
    const earned = count ?? 0;
    if (earned > 0) {
      note(report, "archive", slug, `${earned} earned — archived (delete would wipe them)`);
      if (mode === "apply") {
        const { error } = await clients.prod
          .from("badge_definitions")
          .update({ is_published: false, is_archived: true })
          .eq("id", prodId);
        if (error) report.warnings.push(`${slug}: archive failed — ${error.message}`);
      }
    } else {
      note(report, "delete", slug, "not present in dev");
      if (mode === "apply") {
        await clients.prod.storage.from("badge-art").remove([`badges/${prodId}/art.png`]);
        const { error } = await clients.prod
          .from("badge_definitions")
          .delete()
          .eq("id", prodId);
        if (error) report.warnings.push(`${slug}: delete failed — ${error.message}`);
      }
    }
  }

  return report;
}

// ── reference maps for badge criteria ─────────────────────────────────

async function buildRefMaps(
  clients: SyncClients,
  courseMaps: CourseMaps,
): Promise<RefMaps> {
  const [devCounties, prodCounties, devLists, prodLists] = await Promise.all([
    fetchAll(clients.dev, "counties", "id,slug"),
    fetchAll(clients.prod, "counties", "id,slug"),
    fetchAll(clients.dev, "curated_lists", "id,slug"),
    fetchAll(clients.prod, "curated_lists", "id,slug"),
  ]);

  const prodCountyIdBySlug = new Map<string, string>();
  for (const c of prodCounties) prodCountyIdBySlug.set(c.slug as string, c.id as string);
  const countyDevToProd = new Map<string, string>();
  const countyDevId = new Map<string, string>();
  for (const c of devCounties) {
    countyDevId.set(c.id as string, c.slug as string);
    const prodId = prodCountyIdBySlug.get(c.slug as string);
    if (prodId) countyDevToProd.set(c.id as string, prodId);
  }

  const prodListIdBySlug = new Map<string, string>();
  for (const l of prodLists) prodListIdBySlug.set(l.slug as string, l.id as string);
  const listDevToProd = new Map<string, string>();
  const listDevSlug = new Map<string, string>();
  const listProdSlugs = new Set<string>(prodLists.map((l) => l.slug as string));
  for (const l of devLists) {
    listDevSlug.set(l.id as string, l.slug as string);
    // After the list mirror, every dev slug exists in prod — so it's
    // resolvable for criteria even when the prod row was just created.
    listProdSlugs.add(l.slug as string);
    const prodId = prodListIdBySlug.get(l.slug as string);
    if (prodId) listDevToProd.set(l.id as string, prodId);
  }

  return {
    courseDevToProd: courseMaps.devToProd,
    countyDevToProd,
    listDevToProd,
    listDevSlug,
    listProdSlugs,
    countyDevId,
  };
}

// ── entity 4: config / seed (singletons, no UUID remapping) ───────────

// Server-tunable config singletons mirrored dev→prod. These carry no
// cross-project UUID references (just tunable values keyed by a fixed id),
// so it's a plain row compare + upsert.
const CONFIG_TABLES: Array<{ table: string; idColumn: string; columns: readonly string[] }> = [
  {
    table: "safeguard_config",
    idColumn: "id",
    columns: [
      "id",
      "same_day_rounds_cap",
      "impossible_geo_distance_km",
      "velocity_spike_window_days",
      "velocity_spike_rounds_cap",
    ],
  },
];

async function syncConfig(clients: SyncClients, mode: SyncMode): Promise<EntityReport> {
  const report = emptyReport("Config & seed");
  for (const cfg of CONFIG_TABLES) {
    const [dev, prod] = await Promise.all([
      fetchAll(clients.dev, cfg.table, cfg.columns.join(",")),
      fetchAll(clients.prod, cfg.table, cfg.columns.join(",")),
    ]);
    const prodById = new Map<string, Row>();
    for (const p of prod) prodById.set(String(p[cfg.idColumn]), p);

    for (const d of dev) {
      const key = String(d[cfg.idColumn]);
      const existing = prodById.get(key);
      const differs = !existing || stable(pick(d, cfg.columns)) !== stable(pick(existing, cfg.columns));
      if (!differs) continue;
      note(report, existing ? "update" : "create", `${cfg.table} #${key}`);
      if (mode === "apply") {
        const { error } = await clients.prod
          .from(cfg.table)
          .upsert(pick(d, cfg.columns), { onConflict: cfg.idColumn });
        if (error) report.warnings.push(`${cfg.table} #${key}: upsert failed — ${error.message}`);
      }
    }
  }
  return report;
}

// ── orchestrator ──────────────────────────────────────────────────────

export async function runSync(clients: SyncClients, mode: SyncMode): Promise<SyncReport> {
  try {
    // 1. Course editorial overlay (also yields the course id map).
    const { report: courseReport, maps: courseMaps } = await syncCourses(clients, mode);
    // 2. Curated lists (uses the course map for membership remap).
    const curatedReport = await syncCuratedLists(clients, mode, courseMaps);
    // 3. Badge defs (uses county + course + curated-list maps; built
    //    AFTER lists are mirrored so just-created prod lists resolve).
    const refMaps = await buildRefMaps(clients, courseMaps);
    const badgeReport = await syncBadgeDefinitions(clients, mode, refMaps);
    // 4. Config / seed singletons.
    const configReport = await syncConfig(clients, mode);

    return {
      mode,
      ok: true,
      entities: [curatedReport, badgeReport, courseReport, configReport],
    };
  } catch (err) {
    return {
      mode,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      entities: [],
    };
  }
}
