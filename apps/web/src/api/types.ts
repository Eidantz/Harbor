export type IssueType = 'task' | 'bug' | 'story';
export type IssueLinkType = 'blocks' | 'relates_to' | 'duplicates';
export type IssuePriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';
export type BoardLayout = 'columns' | 'list';
export type ListFieldId =
  | 'key'
  | 'title'
  | 'priority'
  | 'humanEffort'
  | 'locEffort'
  | 'dueDate'
  | 'type'
  | 'labels'
  | 'blockers';
export const DEFAULT_LIST_FIELDS: ListFieldId[] = [
  'key',
  'title',
  'priority',
  'humanEffort',
  'locEffort',
  'dueDate',
  'type',
  'labels',
  'blockers',
];
export type ProjectTheme =
  | 'tokyo-night'
  | 'noctis-sereno'
  | 'gruvbox-dark-hard'
  | 'github-dark-colorblind'
  | 'catppuccin-mocha'
  | 'ubuntu'
  | 'ultra-dark'
  | 'northern-lights';
export type ActivityType =
  | 'created'
  | 'updated'
  | 'moved'
  | 'linked'
  | 'commented';

export interface User {
  id: string;
  email: string;
}

export interface AuthMe {
  id: string;
  email: string;
  via: 'session' | 'bearer';
}

export interface ApiTokenMeta {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiToken extends ApiTokenMeta {
  /** Plaintext secret — only returned at creation time */
  token: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  theme: ProjectTheme | string;
  boardLayout: BoardLayout;
  listFields?: ListFieldId[] | string[];
  issueCounter: number;
  createdAt: string;
  updatedAt: string;
  columns?: BoardColumn[];
  _count?: { issues: number; columns?: number; labels?: number };
}

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  position: number;
  isDone: boolean;
  color: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EpicSummary {
  id: string;
  name: string;
  color: string;
}

export interface Epic extends EpicSummary {
  projectId: string;
  description: string | null;
  /** Long-form markdown plan/spec document */
  document: string | null;
  position: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: { issues: number };
  issues?: Array<{
    id: string;
    key: string;
    title: string;
    type: IssueType;
    priority: IssuePriority;
    columnId: string;
    column?: { id: string; name: string };
  }>;
}

export interface IssueLabel {
  issueId: string;
  labelId: string;
  label: Label;
}

export interface BoardIssue {
  id: string;
  projectId: string;
  columnId: string;
  parentId: string | null;
  epicId?: string | null;
  assigneeId: string | null;
  key: string;
  number: number;
  title: string;
  description: string | null;
  document?: string | null;
  type: IssueType;
  priority: IssuePriority;
  humanEffort: number | null;
  locEffort: number | null;
  dueDate: string | null;
  archivedAt: string | null;
  rank: string;
  createdAt: string;
  updatedAt: string;
  labels: IssueLabel[];
  epic: EpicSummary | null;
  assignee: User | null;
  _count: { subtasks: number; linksTo: number; linksFrom: number };
}

export interface BoardColumnWithIssues extends BoardColumn {
  issues: BoardIssue[];
}

export interface BoardResponse {
  projectId: string;
  columns: BoardColumnWithIssues[];
}

export interface BlockerRef {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  parentId?: string;
}

export interface BlockersSummary {
  blockedBy: BlockerRef[];
  blocks: BlockerRef[];
}

export interface IssueDetail {
  id: string;
  projectId: string;
  columnId: string;
  parentId: string | null;
  epicId?: string | null;
  assigneeId: string | null;
  key: string;
  number: number;
  title: string;
  description: string | null;
  /** Long-form markdown plan/spec document */
  document: string | null;
  type: IssueType;
  priority: IssuePriority;
  humanEffort: number | null;
  locEffort: number | null;
  dueDate: string | null;
  archivedAt: string | null;
  rank: string;
  createdAt: string;
  updatedAt: string;
  column: BoardColumn;
  epic: EpicSummary | null;
  parent: { id: string; key: string; title: string } | null;
  subtasks: IssueListItem[];
  assignee: User | null;
  labels: IssueLabel[];
  blockers: BlockersSummary;
  linksFrom: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: IssueLinkType;
    target: {
      id: string;
      key: string;
      title: string;
      type: IssueType;
      parentId: string | null;
      columnId: string;
    };
  }>;
  linksTo: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: IssueLinkType;
    source: {
      id: string;
      key: string;
      title: string;
      type: IssueType;
      parentId: string | null;
      columnId: string;
      column: { id: string; name: string };
    };
  }>;
}

export interface IssueListItem {
  id: string;
  projectId: string;
  columnId: string;
  parentId: string | null;
  epicId?: string | null;
  key: string;
  number: number;
  title: string;
  description: string | null;
  document?: string | null;
  type: IssueType;
  priority: IssuePriority;
  humanEffort?: number | null;
  locEffort?: number | null;
  dueDate?: string | null;
  archivedAt?: string | null;
  rank: string;
  createdAt: string;
  updatedAt: string;
  column?: { id: string; name: string };
  epic?: EpicSummary | null;
  labels?: IssueLabel[];
  assignee?: User | null;
  _count?: { subtasks: number };
}

export interface SearchResultItem {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  parentId: string | null;
  updatedAt: string;
  project: { id: string; key: string; name: string };
  column: { id: string; name: string };
}

export interface SearchResponse {
  q: string;
  items: SearchResultItem[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MoveWarning {
  code: string;
  message: string;
  blockers: Array<{
    linkId: string;
    blocker: {
      id: string;
      key: string;
      title: string;
      column: { id: string; name: string };
    };
  }>;
}

export interface MoveResult {
  issue: IssueDetail;
  warnings: MoveWarning[];
}

export interface IssueLinkOut {
  id: string;
  sourceId: string;
  targetId: string;
  type: IssueLinkType;
  target: { id: string; key: string; title: string; columnId: string };
}

export interface IssueLinkIn {
  id: string;
  sourceId: string;
  targetId: string;
  type: IssueLinkType;
  source: { id: string; key: string; title: string; columnId: string };
}

export interface LinkList {
  issueId: string;
  blocks: IssueLinkOut[];
  blockedBy: IssueLinkIn[];
  relatesTo: Array<IssueLinkOut | IssueLinkIn>;
  duplicates: IssueLinkOut[];
  duplicatedBy: IssueLinkIn[];
}

export interface Attachment {
  id: string;
  issueId: string;
  filename: string;
  mimeType: string;
  size: number;
  storedName: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: User;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  issueId: string | null;
  actorId: string | null;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: string;
  actor?: User | null;
  issue?: { id: string; key: string; title: string } | null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
