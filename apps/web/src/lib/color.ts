/** Pick black/white foreground for readable text on a #RRGGBB background. */
export function contrastForeground(hex: string): string {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Relative luminance (sRGB approximation)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#1a1b26' : '#f5f5f5';
}
