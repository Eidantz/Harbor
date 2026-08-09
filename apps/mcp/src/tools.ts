import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KanbanApiClient } from './client.js';
import { paginateArray, runTool, ToolValidationError } from './response.js';
import {
  BoardLayoutSchema,
  ColumnIdSchema,
  EpicIdSchema,
  HexColorSchema,
  IssueIdSchema,
  IssuePrioritySchema,
  IssueTypeSchema,
  LabelIdSchema,
  LinkIdSchema,
  LinkTypeSchema,
  ListFieldSchema,
  NullableIdFilterSchema,
  PaginationSchema,
  ProjectIdSchema,
  ProjectThemeSchema,
} from './schemas.js';

export function registerTools(server: McpServer, api: KanbanApiClient): void {
  // ── Meta ──────────────────────────────────────────────────────────────
  server.registerTool(
    'health',
    {
      title: 'API health',
      description: 'Check whether the Kanban API is reachable (GET /health).',
    },
    async () =>
      runTool(async () => api.get<{ ok: boolean; service: string }>('/health', undefined, false)),
  );

  // ── Projects ──────────────────────────────────────────────────────────
  server.registerTool(
    'project_list',
    {
      title: 'List projects',
      description: 'List all projects with issue/column counts.',
      inputSchema: { ...PaginationSchema },
    },
    async ({ limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>('/api/projects');
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'project_get',
    {
      title: 'Get project',
      description: 'Get a project by id, including columns and counts.',
      inputSchema: { projectId: ProjectIdSchema },
    },
    async ({ projectId }) =>
      runTool(async () => api.get(`/api/projects/${projectId}`)),
  );

  server.registerTool(
    'project_create',
    {
      title: 'Create project',
      description:
        'Create a project. Key must be 2–10 chars, start with a letter, A–Z/0–9 only (e.g. KAN). Default columns To Do / In Progress / Done are created (Done has isDone=true). Optional theme (default tokyo-night) and boardLayout (columns|list).',
      inputSchema: {
        name: z.string().min(1).max(120).describe('Project name'),
        key: z
          .string()
          .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'key must be 2–10 chars, A–Z / 0–9, start with letter')
          .describe('Issue key prefix, e.g. KAN'),
        description: z.string().max(2000).optional().describe('Optional description'),
        theme: ProjectThemeSchema.optional().describe(
          'Named theme id (default tokyo-night)',
        ),
        boardLayout: BoardLayoutSchema.optional().describe(
          'Board layout: columns (Kanban) or list (default columns)',
        ),
      },
    },
    async (args) =>
      runTool(async () => {
        const body: Record<string, unknown> = {
          name: args.name,
          key: args.key,
        };
        if (args.description !== undefined) body.description = args.description;
        if (args.theme !== undefined) body.theme = args.theme;
        if (args.boardLayout !== undefined) body.boardLayout = args.boardLayout;
        return api.post('/api/projects', body);
      }),
  );

  server.registerTool(
    'project_update',
    {
      title: 'Update project',
      description:
        'Update project name, description, theme, boardLayout, and/or listFields (Monday-list columns).',
      inputSchema: {
        projectId: ProjectIdSchema,
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
        theme: ProjectThemeSchema.optional().describe('Named theme id'),
        boardLayout: BoardLayoutSchema.optional().describe(
          'Board layout: columns or list',
        ),
        listFields: z
          .array(ListFieldSchema)
          .optional()
          .describe('Visible list-table field ids'),
      },
    },
    async ({ projectId, name, description, theme, boardLayout, listFields }) =>
      runTool(async () => {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (theme !== undefined) body.theme = theme;
        if (boardLayout !== undefined) body.boardLayout = boardLayout;
        if (listFields !== undefined) body.listFields = listFields;
        return api.patch(`/api/projects/${projectId}`, body);
      }),
  );

  server.registerTool(
    'project_delete',
    {
      title: 'Delete project',
      description:
        'Delete a project and EVERYTHING in it: columns, issues (incl. subtasks), epics, labels, comments, links, and activity. Irreversible — confirm with the user before calling.',
      inputSchema: { projectId: ProjectIdSchema },
    },
    async ({ projectId }) =>
      runTool(async () => api.delete(`/api/projects/${projectId}`)),
  );

  // ── Board / columns ───────────────────────────────────────────────────
  server.registerTool(
    'column_list',
    {
      title: 'List columns',
      description:
        'List board columns for a project (ordered by position). Each column includes isDone (at most one true per project).',
      inputSchema: {
        projectId: ProjectIdSchema,
        ...PaginationSchema,
      },
    },
    async ({ projectId, limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>(`/api/projects/${projectId}/columns`);
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'column_create',
    {
      title: 'Create column',
      description:
        'Create a board column. Optional isDone and color (#RRGGBB accent).',
      inputSchema: {
        projectId: ProjectIdSchema,
        name: z.string().min(1).max(80).describe('Column name'),
        isDone: z
          .boolean()
          .optional()
          .describe('Mark as Done column (at most one per project)'),
        color: HexColorSchema.nullable()
          .optional()
          .describe('Hex outline color'),
      },
    },
    async ({ projectId, name, isDone, color }) =>
      runTool(async () => {
        const body: Record<string, unknown> = { name };
        if (isDone !== undefined) body.isDone = isDone;
        if (color !== undefined) body.color = color;
        return api.post(`/api/projects/${projectId}/columns`, body);
      }),
  );

  server.registerTool(
    'column_update',
    {
      title: 'Update column',
      description:
        'Update column name, position, isDone, and/or color. Setting isDone=true clears it on other columns.',
      inputSchema: {
        columnId: ColumnIdSchema,
        name: z.string().min(1).max(80).optional(),
        position: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('0-based position among project columns'),
        isDone: z.boolean().optional(),
        color: HexColorSchema.nullable()
          .optional()
          .describe('Hex outline color; null clears'),
      },
    },
    async ({ columnId, name, position, isDone, color }) =>
      runTool(async () => {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (position !== undefined) body.position = position;
        if (isDone !== undefined) body.isDone = isDone;
        if (color !== undefined) body.color = color;
        return api.patch(`/api/columns/${columnId}`, body);
      }),
  );

  server.registerTool(
    'column_delete',
    {
      title: 'Delete column',
      description:
        'Delete a board column. Fails if it is the last column or still contains issues.',
      inputSchema: { columnId: ColumnIdSchema },
    },
    async ({ columnId }) =>
      runTool(async () => api.delete(`/api/columns/${columnId}`)),
  );

  server.registerTool(
    'column_reorder',
    {
      title: 'Reorder columns',
      description:
        'Reorder all columns in a project. columnIds must list every column id exactly once.',
      inputSchema: {
        projectId: ProjectIdSchema,
        columnIds: z
          .array(ColumnIdSchema)
          .min(1)
          .describe('Column ids in desired order'),
      },
    },
    async ({ projectId, columnIds }) =>
      runTool(async () =>
        api.put(`/api/projects/${projectId}/columns/reorder`, { columnIds }),
      ),
  );

  server.registerTool(
    'board_get',
    {
      title: 'Get board',
      description:
        'Get the Kanban board: columns with ordered top-level issues (and color/isDone metadata). Archived issues are excluded; use issue_list with archived:"true" to see them.',
      inputSchema: {
        projectId: ProjectIdSchema,
      },
    },
    async ({ projectId }) =>
      runTool(async () => api.get(`/api/projects/${projectId}/board`)),
  );

  // ── Issues ────────────────────────────────────────────────────────────
  server.registerTool(
    'issue_list',
    {
      title: 'List issues',
      description:
        'List issues in a project with filters and pagination. Excludes archived issues by default; use archived to include them.',
      inputSchema: {
        projectId: ProjectIdSchema,
        columnId: ColumnIdSchema.optional(),
        parentId: NullableIdFilterSchema.optional().describe(
          'Parent issue id, or "null" for top-level only',
        ),
        q: z.string().optional().describe('Search title/description'),
        archived: z
          .enum(['true', 'false', 'all'])
          .optional()
          .describe(
            'Archived filter: "false" (default) active only, "true" archived only, "all" both',
          ),
        ...PaginationSchema,
      },
    },
    async ({ projectId, columnId, parentId, q, archived, limit, offset }) =>
      runTool(async () =>
        api.get(`/api/projects/${projectId}/issues`, {
          columnId,
          parentId,
          q,
          archived,
          limit,
          offset,
        }),
      ),
  );

  server.registerTool(
    'issue_get',
    {
      title: 'Get issue',
      description:
        'Get full issue detail (column, parent, subtasks, labels, links, assignee). Includes blockers: { blockedBy, blocks } each entry { id, key, title, type, parentId? }.',
      inputSchema: { issueId: IssueIdSchema },
    },
    async ({ issueId }) =>
      runTool(async () => api.get(`/api/issues/${issueId}`)),
  );

  server.registerTool(
    'issue_create',
    {
      title: 'Create issue',
      description:
        'Create an issue (or subtask via parentId). Defaults to first column and medium priority. Supports humanEffort (hours), locEffort (lines), and epicId (top-level only).',
      inputSchema: {
        projectId: ProjectIdSchema,
        title: z.string().min(1).max(300),
        description: z.string().max(10000).optional(),
        type: IssueTypeSchema.optional(),
        priority: IssuePrioritySchema.optional(),
        humanEffort: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe('Human effort hours'),
        locEffort: z
          .number()
          .int()
          .min(0)
          .nullable()
          .optional()
          .describe('LOC effort'),
        dueDate: z
          .string()
          .nullable()
          .optional()
          .describe('Target completion date (ISO 8601, e.g. 2026-08-31)'),
        columnId: ColumnIdSchema.optional(),
        parentId: IssueIdSchema.optional().describe('Parent for subtasks'),
        epicId: EpicIdSchema.nullable()
          .optional()
          .describe('Epic id (top-level issues only)'),
        assigneeId: z.string().nullable().optional(),
      },
    },
    async ({ projectId, ...body }) =>
      runTool(async () => api.post(`/api/projects/${projectId}/issues`, body)),
  );

  server.registerTool(
    'issue_update',
    {
      title: 'Update issue',
      description:
        'Update issue fields (incl. priority, humanEffort hours, locEffort, dueDate, epicId). archived: true hides the issue from the board (restorable with false). Returns the full updated issue. epicId is top-level only; null clears.',
      inputSchema: {
        issueId: IssueIdSchema,
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(10000).nullable().optional(),
        type: IssueTypeSchema.optional(),
        priority: IssuePrioritySchema.optional(),
        humanEffort: z.number().min(0).nullable().optional(),
        locEffort: z.number().int().min(0).nullable().optional(),
        dueDate: z
          .string()
          .nullable()
          .optional()
          .describe('Target completion date (ISO 8601); null clears'),
        assigneeId: z.string().nullable().optional(),
        epicId: EpicIdSchema.nullable()
          .optional()
          .describe('Epic id (top-level only); null clears'),
        archived: z
          .boolean()
          .optional()
          .describe('true archives (hidden from board), false restores'),
      },
    },
    async ({ issueId, ...body }) =>
      runTool(async () => {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined) patch[k] = v;
        }
        return api.patch(`/api/issues/${issueId}`, patch);
      }),
  );

  server.registerTool(
    'issue_move',
    {
      title: 'Move issue',
      description:
        'Move an issue to a column (and optional rank via before/after). Moving into an isDone column may return soft warnings (OPEN_BLOCKERS) but still succeeds.',
      inputSchema: {
        issueId: IssueIdSchema,
        columnId: ColumnIdSchema,
        beforeIssueId: IssueIdSchema.optional().describe(
          'Place immediately before this issue',
        ),
        afterIssueId: IssueIdSchema.optional().describe(
          'Place immediately after this issue',
        ),
      },
    },
    async ({ issueId, columnId, beforeIssueId, afterIssueId }) =>
      runTool(async () => {
        if (beforeIssueId && afterIssueId) {
          throw new ToolValidationError(
            'Provide at most one of beforeIssueId or afterIssueId',
          );
        }
        return api.post(`/api/issues/${issueId}/move`, {
          columnId,
          beforeIssueId,
          afterIssueId,
        });
      }),
  );

  server.registerTool(
    'issue_delete',
    {
      title: 'Delete issue',
      description: 'Delete an issue by id.',
      inputSchema: { issueId: IssueIdSchema },
    },
    async ({ issueId }) =>
      runTool(async () => api.delete(`/api/issues/${issueId}`)),
  );

  // ── Subtasks ──────────────────────────────────────────────────────────
  server.registerTool(
    'subtask_list',
    {
      title: 'List subtasks',
      description: 'List subtasks for a parent issue.',
      inputSchema: {
        issueId: IssueIdSchema.describe('Parent issue id'),
        ...PaginationSchema,
      },
    },
    async ({ issueId, limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>(`/api/issues/${issueId}/subtasks`);
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'subtask_create',
    {
      title: 'Create subtask',
      description: 'Create a subtask under a parent issue. Returns the full issue.',
      inputSchema: {
        issueId: IssueIdSchema.describe('Parent issue id'),
        title: z.string().min(1).max(300),
        description: z.string().max(10000).optional(),
        type: IssueTypeSchema.optional(),
        priority: IssuePrioritySchema.optional(),
        humanEffort: z.number().min(0).nullable().optional(),
        locEffort: z.number().int().min(0).nullable().optional(),
        columnId: ColumnIdSchema.optional(),
        assigneeId: z.string().nullable().optional(),
      },
    },
    async ({ issueId, ...body }) =>
      runTool(async () => api.post(`/api/issues/${issueId}/subtasks`, body)),
  );

  // ── Links (blocks only) ───────────────────────────────────────────────
  server.registerTool(
    'fetch_blockers',
    {
      title: 'Fetch blockers',
      description:
        'Return blockers summary for an issue: { blockedBy, blocks }, each entry { id, key, title, type, parentId? }. Empty arrays when none. Resolve by issueId, or issueKey with projectId/projectKey.',
      inputSchema: {
        issueId: IssueIdSchema.optional(),
        issueKey: z
          .string()
          .min(1)
          .optional()
          .describe('Issue key, e.g. KAN-3 (requires projectId or projectKey)'),
        projectId: ProjectIdSchema.optional(),
        projectKey: z
          .string()
          .min(1)
          .optional()
          .describe('Project key prefix, e.g. KAN'),
      },
    },
    async ({ issueId, issueKey, projectId, projectKey }) =>
      runTool(async () => {
        let resolvedId = issueId;
        if (!resolvedId) {
          if (!issueKey) {
            throw new ToolValidationError('Provide issueId or issueKey');
          }
          let pid = projectId;
          if (!pid) {
            if (!projectKey) {
              throw new ToolValidationError(
                'When using issueKey, provide projectId or projectKey',
              );
            }
            const projects = await api.get<Array<{ id: string; key: string }>>(
              '/api/projects',
            );
            const project = projects.find(
              (p) => p.key.toUpperCase() === projectKey.toUpperCase(),
            );
            if (!project) {
              throw new ToolValidationError(
                `Project key ${projectKey} not found`,
              );
            }
            pid = project.id;
          }
          const listed = await api.get<{
            items: Array<{ id: string; key: string }>;
          }>(`/api/projects/${pid}/issues`, { q: issueKey, limit: 50 });
          const match = listed.items.find(
            (i) => i.key.toLowerCase() === issueKey.toLowerCase(),
          );
          if (!match) {
            throw new ToolValidationError(`Issue ${issueKey} not found`);
          }
          resolvedId = match.id;
        }

        const issue = await api.get<{
          id: string;
          key: string;
          blockers?: { blockedBy: unknown[]; blocks: unknown[] };
        }>(`/api/issues/${resolvedId}`);

        return {
          issueId: issue.id,
          issueKey: issue.key,
          blockers: issue.blockers ?? { blockedBy: [], blocks: [] },
        };
      }),
  );

  server.registerTool(
    'link_list',
    {
      title: 'List issue links',
      description:
        'List links for an issue grouped by type: blocks / blockedBy (dependency), relatesTo (symmetric), duplicates / duplicatedBy.',
      inputSchema: { issueId: IssueIdSchema },
    },
    async ({ issueId }) =>
      runTool(async () => api.get(`/api/issues/${issueId}/links`)),
  );

  server.registerTool(
    'link_create',
    {
      title: 'Create issue link',
      description:
        'Create a link from issueId (source) to targetId. Types: blocks (source blocks target; rejects cycles), relates_to (symmetric relation), duplicates (source duplicates target). Rejects self-links and exact duplicates. Default type: blocks.',
      inputSchema: {
        issueId: IssueIdSchema.describe('Source issue id'),
        targetId: IssueIdSchema.describe('Target issue id'),
        type: LinkTypeSchema.optional().describe(
          'blocks (default) | relates_to | duplicates',
        ),
      },
    },
    async ({ issueId, targetId, type }) =>
      runTool(async () =>
        api.post(`/api/issues/${issueId}/links`, {
          targetId,
          type: type ?? 'blocks',
        }),
      ),
  );

  server.registerTool(
    'link_delete',
    {
      title: 'Delete link',
      description: 'Delete an issue link by id.',
      inputSchema: { linkId: LinkIdSchema },
    },
    async ({ linkId }) =>
      runTool(async () => api.delete(`/api/links/${linkId}`)),
  );

  // ── Epics ─────────────────────────────────────────────────────────────
  server.registerTool(
    'epic_list',
    {
      title: 'List epics',
      description: 'List epics for a project (includes _count.issues).',
      inputSchema: {
        projectId: ProjectIdSchema,
        ...PaginationSchema,
      },
    },
    async ({ projectId, limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>(`/api/projects/${projectId}/epics`);
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'epic_get',
    {
      title: 'Get epic',
      description:
        'Get epic detail including associated top-level issues (id, key, title, type, column).',
      inputSchema: { epicId: EpicIdSchema },
    },
    async ({ epicId }) => runTool(async () => api.get(`/api/epics/${epicId}`)),
  );

  server.registerTool(
    'epic_create',
    {
      title: 'Create epic',
      description:
        'Create a project epic (outside the board). Optional description and color (#RRGGBB).',
      inputSchema: {
        projectId: ProjectIdSchema,
        name: z.string().min(1).max(120),
        description: z.string().max(5000).optional(),
        color: HexColorSchema.optional().describe('Badge color (default #7aa2f7)'),
      },
    },
    async ({ projectId, name, description, color }) =>
      runTool(async () => {
        const body: Record<string, unknown> = { name };
        if (description !== undefined) body.description = description;
        if (color !== undefined) body.color = color;
        return api.post(`/api/projects/${projectId}/epics`, body);
      }),
  );

  server.registerTool(
    'epic_update',
    {
      title: 'Update epic',
      description: 'Update epic name, description, color, and/or position.',
      inputSchema: {
        epicId: EpicIdSchema,
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(5000).nullable().optional(),
        color: HexColorSchema.optional(),
        position: z.number().int().min(0).optional().describe('List order (0-based)'),
      },
    },
    async ({ epicId, name, description, color, position }) =>
      runTool(async () => {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (color !== undefined) body.color = color;
        if (position !== undefined) body.position = position;
        return api.patch(`/api/epics/${epicId}`, body);
      }),
  );

  server.registerTool(
    'epic_delete',
    {
      title: 'Delete epic',
      description: 'Delete an epic. Linked issues get epicId cleared (SetNull).',
      inputSchema: { epicId: EpicIdSchema },
    },
    async ({ epicId }) =>
      runTool(async () => api.delete(`/api/epics/${epicId}`)),
  );

  // ── Labels ────────────────────────────────────────────────────────────
  server.registerTool(
    'label_list',
    {
      title: 'List labels',
      description: 'List labels for a project.',
      inputSchema: {
        projectId: ProjectIdSchema,
        ...PaginationSchema,
      },
    },
    async ({ projectId, limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>(`/api/projects/${projectId}/labels`);
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'label_create',
    {
      title: 'Create label',
      description: 'Create a project label. Returns the label.',
      inputSchema: {
        projectId: ProjectIdSchema,
        name: z.string().min(1).max(40),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be #RRGGBB')
          .optional(),
      },
    },
    async ({ projectId, name, color }) =>
      runTool(async () =>
        api.post(`/api/projects/${projectId}/labels`, { name, color }),
      ),
  );

  server.registerTool(
    'label_update',
    {
      title: 'Update label',
      description: 'Update a label name/color. Returns the label.',
      inputSchema: {
        labelId: LabelIdSchema,
        name: z.string().min(1).max(40).optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be #RRGGBB')
          .optional(),
      },
    },
    async ({ labelId, name, color }) =>
      runTool(async () => {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (color !== undefined) body.color = color;
        return api.patch(`/api/labels/${labelId}`, body);
      }),
  );

  server.registerTool(
    'label_delete',
    {
      title: 'Delete label',
      description: 'Delete a project label.',
      inputSchema: { labelId: LabelIdSchema },
    },
    async ({ labelId }) =>
      runTool(async () => api.delete(`/api/labels/${labelId}`)),
  );

  server.registerTool(
    'label_attach',
    {
      title: 'Attach label',
      description: 'Attach a label to an issue (idempotent). Returns the issue with labels.',
      inputSchema: {
        issueId: IssueIdSchema,
        labelId: LabelIdSchema,
      },
    },
    async ({ issueId, labelId }) =>
      runTool(async () =>
        api.post(`/api/issues/${issueId}/labels`, { labelId }),
      ),
  );

  server.registerTool(
    'label_detach',
    {
      title: 'Detach label',
      description: 'Remove a label from an issue.',
      inputSchema: {
        issueId: IssueIdSchema,
        labelId: LabelIdSchema,
      },
    },
    async ({ issueId, labelId }) =>
      runTool(async () => api.delete(`/api/issues/${issueId}/labels/${labelId}`)),
  );

  // ── Comments ──────────────────────────────────────────────────────────
  server.registerTool(
    'comment_list',
    {
      title: 'List comments',
      description: 'List comments on an issue (oldest first).',
      inputSchema: {
        issueId: IssueIdSchema,
        ...PaginationSchema,
      },
    },
    async ({ issueId, limit, offset }) =>
      runTool(async () => {
        const items = await api.get<unknown[]>(`/api/issues/${issueId}/comments`);
        return paginateArray(items, limit, offset);
      }),
  );

  server.registerTool(
    'comment_add',
    {
      title: 'Add comment',
      description: 'Add a comment to an issue. Returns the comment with author.',
      inputSchema: {
        issueId: IssueIdSchema,
        body: z.string().min(1).max(10000).describe('Comment body'),
      },
    },
    async ({ issueId, body }) =>
      runTool(async () =>
        api.post(`/api/issues/${issueId}/comments`, { body }),
      ),
  );

  // ── Activity ──────────────────────────────────────────────────────────
  server.registerTool(
    'activity_list',
    {
      title: 'List activity',
      description:
        'List activity events. Provide projectId (optional issueId filter) or issueId alone for issue-scoped history.',
      inputSchema: {
        projectId: ProjectIdSchema.optional(),
        issueId: IssueIdSchema.optional(),
        ...PaginationSchema,
      },
    },
    async ({ projectId, issueId, limit, offset }) =>
      runTool(async () => {
        if (!projectId && !issueId) {
          throw new ToolValidationError('Provide projectId and/or issueId');
        }
        if (issueId && !projectId) {
          return api.get(`/api/issues/${issueId}/activity`, { limit, offset });
        }
        return api.get(`/api/projects/${projectId}/activity`, {
          issueId,
          limit,
          offset,
        });
      }),
  );
}
