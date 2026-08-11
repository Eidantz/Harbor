export const DEFAULT_THEME = 'tokyo-night' as const;

export const PROJECT_THEMES = [
  'tokyo-night',
  'noctis-sereno',
  'gruvbox-dark-hard',
  'github-dark-colorblind',
  'catppuccin-mocha',
  'ubuntu',
  'ultra-dark',
  'northern-lights',
] as const;

export type ProjectThemeId = (typeof PROJECT_THEMES)[number];

export const THEME_LABELS: Record<ProjectThemeId, string> = {
  'tokyo-night': 'Tokyo Night',
  'noctis-sereno': 'Noctis Sereno',
  'gruvbox-dark-hard': 'Gruvbox Dark Hard',
  'github-dark-colorblind': 'GitHub Dark Colorblind',
  'catppuccin-mocha': 'Catppuccin Mocha',
  ubuntu: 'Ubuntu',
  'ultra-dark': 'Ultra Dark',
  'northern-lights': 'Northern Lights',
};

export function isProjectTheme(value: string): value is ProjectThemeId {
  return (PROJECT_THEMES as readonly string[]).includes(value);
}

/**
 * Default board-column accents per theme, by column position. The first three
 * entries mirror each theme's --column-todo / --column-progress / --column-done
 * CSS vars; the rest extend the scheme for extra columns. Columns with an
 * explicitly saved color ignore these and stay identical across themes.
 */
export const THEME_COLUMN_COLORS: Record<ProjectThemeId, readonly string[]> = {
  'tokyo-night': ['#7dcfff', '#bb9af7', '#9ece6a', '#7aa2f7', '#e0af68', '#f7768e', '#73daca', '#ff9e64'],
  'noctis-sereno': ['#70b2c9', '#84c3be', '#8fbf8f', '#dfae72', '#e6657f', '#9fd4cf', '#b48ead', '#d08770'],
  'gruvbox-dark-hard': ['#83a598', '#d3869b', '#b8bb26', '#fe8019', '#fabd2f', '#8ec07c', '#fb4934', '#d65d0e'],
  // Colorblind-safe: blues, purple, and orange/yellow only (no red/green pairs)
  'github-dark-colorblind': ['#79c0ff', '#d2a8ff', '#a5d6ff', '#58a6ff', '#d29922', '#f0883e', '#bc8cff', '#ffdf5d'],
  'catppuccin-mocha': ['#89dceb', '#cba6f7', '#a6e3a1', '#89b4fa', '#f9e2af', '#f38ba8', '#94e2d5', '#fab387'],
  ubuntu: ['#729fcf', '#ad7fa8', '#8ae234', '#e95420', '#fce94f', '#f06d3d', '#34e2e2', '#75507b'],
  'ultra-dark': ['#89ddff', '#c792ea', '#c3e88d', '#82aaff', '#ffcb6b', '#f07178', '#80cbc4', '#f78c6c'],
  'northern-lights': ['#37eaf9', '#7751a9', '#1dc690', '#5c88da', '#ffcb6b', '#ff77ee', '#6fe7dd', '#4a6290'],
};

/** Theme default accent for a board column at the given position. */
export function themeColumnColor(theme: string, position: number): string {
  const id = isProjectTheme(theme) ? theme : DEFAULT_THEME;
  const palette = THEME_COLUMN_COLORS[id];
  return palette[position % palette.length];
}

export function applyDocumentTheme(theme: string | null | undefined) {
  const id = theme && isProjectTheme(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme = 'dark';
}
