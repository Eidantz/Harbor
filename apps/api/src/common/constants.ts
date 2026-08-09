export const SESSION_COOKIE = 'kanban_session';
export const DEFAULT_COLUMN_NAMES = ['To Do', 'In Progress', 'Done'] as const;
/** Default column name that receives `isDone: true` on project create / seed. */
export const DEFAULT_DONE_COLUMN_NAME = 'Done';

/** Tokyo-friendly solid accents for the default three columns (by position). */
export const DEFAULT_COLUMN_COLORS = ['#7aa2f7', '#e0af68', '#9ece6a'] as const;

/** Rotating palette for custom columns past the default three. */
export const COLUMN_COLOR_PALETTE = [
  '#7aa2f7',
  '#e0af68',
  '#9ece6a',
  '#bb9af7',
  '#f7768e',
  '#7dcfff',
  '#ff9e64',
  '#73daca',
] as const;

export function defaultColumnColor(position: number): string {
  return COLUMN_COLOR_PALETTE[position % COLUMN_COLOR_PALETTE.length]!;
}

export const DEFAULT_PROJECT_THEME = 'tokyo-night';
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
export type ProjectTheme = (typeof PROJECT_THEMES)[number];

export const LIST_FIELD_IDS = [
  'key',
  'title',
  'priority',
  'humanEffort',
  'locEffort',
  'dueDate',
  'type',
  'labels',
  'blockers',
] as const;
export type ListFieldId = (typeof LIST_FIELD_IDS)[number];
export const DEFAULT_LIST_FIELDS: ListFieldId[] = [...LIST_FIELD_IDS];
