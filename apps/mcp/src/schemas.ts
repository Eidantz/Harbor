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
