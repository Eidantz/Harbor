export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  [key: string]: unknown;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type KanbanClientOptions = {
  baseUrl: string;
  token: string;
};

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function codeFromStatus(status: number, fallback?: string): string {
  if (fallback && typeof fallback === 'string' && fallback.length > 0) {
    return fallback.toUpperCase().replace(/\s+/g, '_');
  }
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'UNPROCESSABLE';
  if (status >= 500) return 'SERVER_ERROR';
  return `HTTP_${status}`;
}

export class KanbanApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: KanbanClientOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token;
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      query?: Record<string, string | number | boolean | null | undefined>;
      body?: unknown;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const url = new URL(joinUrl(this.baseUrl, path));
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (options.auth !== false) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiClientError(0, 'NETWORK_ERROR', `Failed to reach API at ${this.baseUrl}: ${message}`);
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const body = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as ApiErrorBody;
      const rawMessage = body.message ?? body.error ?? response.statusText;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : `HTTP ${response.status}`;
      const code = codeFromStatus(
        response.status,
        typeof body.error === 'string' ? body.error : undefined,
      );
      throw new ApiClientError(response.status, code, message, parsed);
    }

    return parsed as T;
  }

  get<T>(
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
    auth = true,
  ): Promise<T> {
    return this.request<T>('GET', path, { query, auth });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export function createClientFromEnv(): KanbanApiClient {
  const baseUrl =
    process.env.KANBAN_API_URL?.trim() ||
    process.env.API_URL?.trim() ||
    'http://localhost:3001';
  const token = process.env.KANBAN_API_TOKEN?.trim() || '';

  if (!token) {
    throw new Error(
      'Missing KANBAN_API_TOKEN. Create one in Harbor → MCP tokens and set it in the environment or .cursor/mcp.json.',
    );
  }

  return new KanbanApiClient({ baseUrl, token });
}
