import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { ApiClientError } from './client.js';

export class ToolValidationError extends Error {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ToolValidationError';
    this.details = details;
  }
}

export type ToolError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ToolSuccess<T> = { ok: true; data: T };
export type ToolFailure = { ok: false; error: ToolError };
export type ToolPayload<T> = ToolSuccess<T> | ToolFailure;

export function okResult<T>(data: T): CallToolResult {
  const payload: ToolSuccess<T> = { ok: true, data };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}

export function errResult(error: ToolError): CallToolResult {
  const payload: ToolFailure = { ok: false, error };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as unknown as Record<string, unknown>,
    isError: true,
  };
}

export function fromUnknownError(err: unknown): CallToolResult {
  if (err instanceof ApiClientError) {
    return errResult({
      code: err.code,
      message: err.message,
      details: err.details ?? (err.status ? { status: err.status } : undefined),
    });
  }
  if (err instanceof ToolValidationError) {
    return errResult({
      code: 'VALIDATION_ERROR',
      message: err.message,
      details: err.details,
    });
  }
  if (err instanceof ZodError) {
    return errResult({
      code: 'VALIDATION_ERROR',
      message: 'Invalid tool arguments',
      details: err.flatten(),
    });
  }
  if (err instanceof Error) {
    return errResult({
      code: 'INTERNAL_ERROR',
      message: err.message,
    });
  }
  return errResult({
    code: 'INTERNAL_ERROR',
    message: String(err),
  });
}

/** Run a tool handler and always return structured { ok, data|error }. */
export async function runTool<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return okResult(data);
  } catch (err) {
    return fromUnknownError(err);
  }
}

/** Client-side pagination helper for endpoints that return arrays. */
export function paginateArray<T>(
  items: T[],
  limit?: number,
  offset?: number,
): { items: T[]; total: number; limit: number; offset: number } {
  const safeOffset = offset ?? 0;
  const safeLimit = limit ?? 50;
  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}
