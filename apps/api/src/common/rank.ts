import {
  generateKeyBetween,
  generateNKeysBetween,
} from 'fractional-indexing';

/**
 * Rank helpers for ordering issues within a column/backlog, backed by
 * fractional-indexing order keys (base-62, always mid-insertable).
 */
export function rankInitial(): string {
  return generateKeyBetween(null, null);
}

/** Rank after `prev` when appending to the end of a list. */
export function rankAfter(prev: string | null | undefined): string {
  return generateKeyBetween(prev ?? null, null);
}

/** Rank strictly between `before` and `after` (either may be null). */
export function rankBetween(
  before: string | null | undefined,
  after: string | null | undefined,
): string {
  return generateKeyBetween(before ?? null, after ?? null);
}

/** `n` evenly spaced ranks for rebalancing an entire list at once. */
export function rankSequence(n: number): string[] {
  return generateNKeysBetween(null, null, n);
}

/** Whether `rank` is a well-formed fractional-indexing order key. */
export function isValidRank(rank: string): boolean {
  try {
    generateKeyBetween(rank, null);
    return true;
  } catch {
    return false;
  }
}
