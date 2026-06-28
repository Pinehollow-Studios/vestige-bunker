import "server-only";
import { migrationStatus } from "./migrations";

/**
 * Lightweight dev↔prod sync summary for the global indicator. Schema-level
 * only (the migration gap is cheap + reliable); the full picture incl.
 * editorial lives on the /sync console. "In sync" = nothing pushable
 * (held migrations don't count - they're intentionally withheld).
 */

export type SyncSummary = {
  configured: boolean; // sync service-role keys present
  prodLedgerReady: boolean; // prod has the admin_applied_migrations RPC
  schemaPushable: number; // pending migrations, excluding held
  schemaHeld: number;
  inSync: boolean;
};

export async function syncSummary(): Promise<SyncSummary> {
  const m = await migrationStatus();
  const configured = !m.error;
  return {
    configured,
    prodLedgerReady: m.prodLedgerAvailable,
    schemaPushable: m.pushableCount,
    schemaHeld: m.heldCount,
    inSync: configured && m.prodLedgerAvailable && m.pushableCount === 0,
  };
}
