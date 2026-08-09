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

export function applyDocumentTheme(theme: string | null | undefined) {
  const id = theme && isProjectTheme(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme = 'dark';
}
