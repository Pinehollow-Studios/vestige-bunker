/**
 * The Vestige Index blend, mirrored client-side for live projection.
 *
 * Canonical definition lives in the iOS migration
 * `20260626220000_vestige_index_foundation.sql`:
 *
 *   index = clamp( prestige * (1 + swing * (rarity - 50) / 50), 0, 100 )
 *
 * with rarity 0-100 (100 = rarest, 50 = neutral when there's no play variance)
 * and swing the global `rarity_index_config.rarity_swing` (0-1).
 *
 * This is exact for a single course: editing one row's prestige moves only
 * that row's index by this formula. It is an *approximation* across a recompute
 * because rarity is relative to the play-count spread of every course - so the
 * committed value after "Save" can differ by a point or two on other rows. We
 * use it to preview the edited row's index before committing.
 */
export function projectIndex(
  prestige: number,
  rarity: number | null,
  swing: number,
): number {
  const r = rarity ?? 50;
  const raw = prestige * (1 + swing * ((r - 50) / 50));
  return Math.max(0, Math.min(100, Math.round(raw)));
}
