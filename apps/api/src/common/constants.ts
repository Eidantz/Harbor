export const SESSION_COOKIE = 'kanban_session';
export const DEFAULT_COLUMN_NAMES = ['To Do', 'In Progress', 'Done'] as const;
/** Default column name that receives `isDone: true` on project create / seed. */
export const DEFAULT_DONE_COLUMN_NAME = 'Done';

/** Monday-style default labels created with every new project. */
export const DEFAULT_LABELS = [
  { name: 'Done', color: '#00C875' },
  { name: 'Working on it', color: '#FDAB3D' },
  { name: 'Stuck', color: '#DF2F4A' },
] as const;

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
  'assignee',
  'epic',
  'status',
  'document',
  'description',
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
