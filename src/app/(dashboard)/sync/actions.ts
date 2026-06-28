"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSyncClients } from "@/lib/sync/clients";
import { runSync, type SyncReport } from "@/lib/sync/engine";
import { migrationStatus, type MigrationStatus } from "@/lib/sync/migrations";
import {
  dispatchProdDeploy,
  githubConfigured,
  latestProdDeployRun,
  type WorkflowRun,
} from "@/lib/github/dispatch";

export type SyncActionResult =
  | { ok: true; report: SyncReport }
  | { ok: false; message: string };

export type SchemaStatusResult =
  | { ok: true; status: MigrationStatus; githubReady: boolean; latestRun: WorkflowRun | null }
  | { ok: false; message: string };

export type DeployResult = { ok: true } | { ok: false; message: string };

/** Sync writes to prod - super_admin only, regardless of the active env. */
async function gateSuperAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Editorial sync requires super_admin." };
  }
  return { ok: true };
}

async function run(mode: "dry" | "apply"): Promise<SyncActionResult> {
  const gate = await gateSuperAdmin();
  if (!gate.ok) return gate;
  try {
    const clients = createSyncClients();
    const report = await runSync(clients, mode);
    return { ok: true, report };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Compute the dev→prod diff with NO writes. */
export async function dryRunSync(): Promise<SyncActionResult> {
  return run("dry");
}

/** Execute the dev→prod mirror. */
export async function applySync(): Promise<SyncActionResult> {
  return run("apply");
}

// ── Schema (migrations + functions) ───────────────────────────────────────

/** Read the dev→prod migration gap + latest prod-deploy run status. */
export async function getSchemaStatus(): Promise<SchemaStatusResult> {
  const gate = await gateSuperAdmin();
  if (!gate.ok) return gate;
  try {
    const [status, latestRun] = await Promise.all([
      migrationStatus(),
      latestProdDeployRun(),
    ]);
    return { ok: true, status, githubReady: githubConfigured(), latestRun };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Fire the prod-deploy GitHub Action (db push + optional functions deploy).
 *  Held migrations are excluded server-side by the workflow. */
export async function deploySchemaToProd(opts: {
  migrations: boolean;
  functions: boolean;
}): Promise<DeployResult> {
  const gate = await gateSuperAdmin();
  if (!gate.ok) return gate;
  try {
    await dispatchProdDeploy({
      migrations: opts.migrations,
      functions: opts.functions,
      reason: "admin dashboard push",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Poll the latest prod-deploy run (for live status after a dispatch). */
export async function getLatestProdRun(): Promise<WorkflowRun | null> {
  const gate = await gateSuperAdmin();
  if (!gate.ok) return null;
  return latestProdDeployRun();
}
