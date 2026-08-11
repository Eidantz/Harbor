import { z } from 'zod';

export const IssueTypeSchema = z.enum(['task', 'bug', 'story']);
export const IssuePrioritySchema = z.enum([
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
]);
export const LinkTypeSchema = z.enum(['blocks', 'relates_to', 'duplicates']);
export const BoardLayoutSchema = z.enum(['columns', 'list']);
export const ProjectThemeSchema = z.enum([
  'tokyo-night',
  'noctis-sereno',
  'gruvbox-dark-hard',
  'github-dark-colorblind',
  'catppuccin-mocha',
  'ubuntu',
  'ultra-dark',
  'northern-lights',
]);

export const PaginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Page size (1–200, default 50)'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Offset for pagination (default 0)'),
};

export const ProjectIdSchema = z.string().min(1).describe('Project id');
export const IssueIdSchema = z.string().min(1).describe('Issue id');
export const LabelIdSchema = z.string().min(1).describe('Label id');
export const EpicIdSchema = z.string().min(1).describe('Epic id');
export const LinkIdSchema = z.string().min(1).describe('Issue link id');
export const ColumnIdSchema = z.string().min(1).describe('Board column id');

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'must be #RRGGBB')
  .describe('Hex color e.g. #7aa2f7');

export const ListFieldSchema = z.enum([
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
]);

/** Parent filter: real id, or the string "null" for top-level. */
export const NullableIdFilterSchema = z
  .string()
  .min(1)
  .describe('Resource id, or the literal string "null" for unset/top-level');

export const CustomColumnIdSchema = z
  .string()
  .min(1)
  .describe('Custom list-table column id');

export const CustomColumnTypeSchema = z
  .enum(['text', 'number', 'date', 'label', 'person', 'file', 'checkbox'])
  .describe('Custom column type');

export const CustomColumnSettingsSchema = z
  .object({
    options: z
      .array(
        z.object({
          id: z.string().min(1).describe('Stable option id (any unique string)'),
          name: z.string().min(1).max(40),
          color: HexColorSchema,
        }),
      )
      .optional()
      .describe('Colored options for label-type columns'),
  })
  .describe('Type-specific config; label columns keep their colored options here');

/** Cell value; shape must match the column type. Null clears the cell. */
export const CustomValueSchema = z
  .union([
    z.object({ text: z.string().max(2000) }).describe('text column'),
    z.object({ number: z.number() }).describe('number column'),
    z.object({ date: z.string() }).describe('date column (ISO 8601)'),
    z.object({ optionId: z.string().min(1) }).describe('label column (option id)'),
    z.object({ userId: z.string().min(1) }).describe('person column'),
    z
      .object({ attachmentId: z.string().min(1), filename: z.string().min(1) })
      .describe('file column (existing attachment)'),
    z.object({ checked: z.boolean() }).describe('checkbox column'),
  ])
  .nullable()
  .describe(
    'Value matching the column type: { text } | { number } | { date } | { optionId } | { userId } | { attachmentId, filename } | { checked }. Send null to clear.',
  );

export const ListWidthsSchema = z
  .record(z.number().min(60).max(1200))
  .describe(
    'List-table column pixel widths keyed by built-in field id or custom column id',
  );
