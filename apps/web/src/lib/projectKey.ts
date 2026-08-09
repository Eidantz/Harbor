/**
 * Auto-generate a project key from a display name.
 *
 * | Name shape | Key |
 * |---|---|
 * | One word (`Harbor`) | First 3 letters → `HAR` |
 * | Multi (`My Project`, `my-project`) | L1+L2 of word1 + L1 of word2 → `MYP` |
 * | 3+ parts | First letter of first 3 parts → `ABC` |
 *
 * Uppercase A–Z only; length clamped to 2–10.
 */
export function projectKeyFromName(name: string): string {
  const parts = name
    .trim()
    .split(/[\s\-_]+/)
    .map((part) => part.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);

  if (parts.length === 0) return '';

  let raw: string;
  if (parts.length === 1) {
    raw = parts[0].slice(0, 3);
  } else if (parts.length === 2) {
    const [w1, w2] = parts;
    raw = `${w1[0] ?? ''}${w1[1] ?? ''}${w2[0] ?? ''}`;
  } else {
    raw = parts
      .slice(0, 3)
      .map((p) => p[0] ?? '')
      .join('');
  }

  let key = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (key.length > 10) key = key.slice(0, 10);
  if (key.length === 1) {
    // Pad to satisfy 2-char minimum when the name only yields one letter.
    const extra = parts[0]?.slice(1).replace(/[^a-zA-Z]/g, '').toUpperCase() ?? '';
    key = (key + (extra || key)).slice(0, 10);
  }
  return key;
}
