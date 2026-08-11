export const CUSTOM_COLUMN_TYPES = [
  'text',
  'number',
  'date',
  'label',
  'person',
  'file',
  'checkbox',
] as const;

/** Option of a label-type custom column, stored in CustomColumn.settings.options. */
export interface CustomLabelOption {
  id: string;
  name: string;
  color: string;
}
