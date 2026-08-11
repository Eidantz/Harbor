import type {
  ApiTokenMeta,
  Attachment,
  AuthMe,
  BoardColumn,
  BoardLayout,
  BoardResponse,
  Comment,
  CreatedApiToken,
  CustomColumn,
  CustomColumnType,
  CustomValuePayload,
  Epic,
  IssueDetail,
  IssueLinkType,
  IssueListItem,
  IssuePriority,
  IssueType,
  Label,
  LinkList,
  MoveResult,
  Paginated,
  ActivityEvent,
  Project,
  ProjectTheme,
  SearchResponse,
  User,
} from './types';
import { ApiError } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies set their own multipart Content-Type (with boundary)
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      (typeof (data as { message: unknown }).message === 'string' ||
        Array.isArray((data as { message: unknown }).message))
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: string }).message)
        : res.statusText || 'Request failed';
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  setup() {
    return request<{ needsSignup: boolean }>('/api/auth/setup');
  },

  signup(email: string, password: string) {
    return request<User>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    return request<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  me() {
    return request<AuthMe>('/api/auth/me');
  },

  listTokens() {
    return request<ApiTokenMeta[]>('/api/auth/tokens');
  },

  createToken(name?: string) {
    return request<CreatedApiToken>('/api/auth/tokens', {
      method: 'POST',
      body: JSON.stringify({ name: name || 'MCP' }),
    });
  },

  revokeToken(tokenId: string) {
    return request<{ ok: boolean }>(`/api/auth/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  },

  listProjects() {
    return request<Project[]>('/api/projects');
  },

  getProject(projectId: string) {
    return request<Project>(`/api/projects/${projectId}`);
  },

  createProject(body: {
    name: string;
    key: string;
    description?: string;
    theme?: ProjectTheme;
    boardLayout?: BoardLayout;
  }) {
    return request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateProject(
    projectId: string,
    body: {
      name?: string;
      description?: string | null;
      theme?: ProjectTheme;
      boardLayout?: BoardLayout;
      listFields?: string[];
      listWidths?: Record<string, number>;
    },
  ) {
    return request<Project>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteProject(projectId: string) {
    return request<{ ok: boolean; id: string; key: string }>(
      `/api/projects/${projectId}`,
      { method: 'DELETE' },
    );
  },

  getBoard(projectId: string) {
    return request<BoardResponse>(`/api/projects/${projectId}/board`);
  },

  listColumns(projectId: string) {
    return request<BoardColumn[]>(`/api/projects/${projectId}/columns`);
  },

  createColumn(
    projectId: string,
    body: { name: string; isDone?: boolean; color?: string | null },
  ) {
    return request<BoardColumn>(`/api/projects/${projectId}/columns`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateColumn(
    columnId: string,
    body: {
      name?: string;
      position?: number;
      isDone?: boolean;
      color?: string | null;
    },
  ) {
    return request<BoardColumn>(`/api/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteColumn(columnId: string) {
    return request<{ ok: boolean }>(`/api/columns/${columnId}`, {
      method: 'DELETE',
    });
  },

  reorderColumns(projectId: string, columnIds: string[]) {
    return request<BoardColumn[]>(`/api/projects/${projectId}/columns/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    });
  },

  listIssues(
    projectId: string,
    params: {
      columnId?: string;
      parentId?: string;
      q?: string;
      archived?: 'true' | 'false' | 'all';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    return request<Paginated<IssueListItem>>(
      `/api/projects/${projectId}/issues${qs(params)}`,
    );
  },

  createIssue(
    projectId: string,
    body: {
      title: string;
      description?: string;
      document?: string;
      type?: IssueType;
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      columnId?: string;
      parentId?: string;
      epicId?: string | null;
    },
  ) {
    return request<IssueDetail>(`/api/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getIssue(issueId: string) {
    return request<IssueDetail>(`/api/issues/${issueId}`);
  },

  updateIssue(
    issueId: string,
    body: {
      title?: string;
      description?: string | null;
      document?: string | null;
      type?: IssueType;
      priority?: IssuePriority;
      humanEffort?: number | null;
      locEffort?: number | null;
      dueDate?: string | null;
      assigneeId?: string | null;
      epicId?: string | null;
      archived?: boolean;
    },
  ) {
    return request<IssueDetail>(`/api/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteIssue(issueId: string) {
    return request<{ ok: boolean }>(`/api/issues/${issueId}`, {
      method: 'DELETE',
    });
  },

  moveIssue(
    issueId: string,
    body: { columnId: string; beforeIssueId?: string; afterIssueId?: string },
  ) {
    return request<MoveResult>(`/api/issues/${issueId}/move`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  listSubtasks(issueId: string) {
    return request<IssueListItem[]>(`/api/issues/${issueId}/subtasks`);
  },

  createSubtask(
    issueId: string,
    body: { title: string; type?: IssueType; priority?: IssuePriority },
  ) {
    return request<IssueDetail>(`/api/issues/${issueId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  listLinks(issueId: string) {
    return request<LinkList>(`/api/issues/${issueId}/links`);
  },

  createLink(issueId: string, targetId: string, type: IssueLinkType = 'blocks') {
    return request(`/api/issues/${issueId}/links`, {
      method: 'POST',
      body: JSON.stringify({ targetId, type }),
    });
  },

  deleteLink(linkId: string) {
    return request(`/api/links/${linkId}`, { method: 'DELETE' });
  },

  listAttachments(issueId: string) {
    return request<Attachment[]>(`/api/issues/${issueId}/attachments`);
  },

  uploadAttachment(issueId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return request<Attachment>(`/api/issues/${issueId}/attachments`, {
      method: 'POST',
      body,
    });
  },

  deleteAttachment(attachmentId: string) {
    return request<{ ok: boolean; id: string }>(
      `/api/attachments/${attachmentId}`,
      { method: 'DELETE' },
    );
  },

  attachmentDownloadUrl(attachmentId: string) {
    return `/api/attachments/${attachmentId}/download`;
  },

  listLabels(projectId: string) {
    return request<Label[]>(`/api/projects/${projectId}/labels`);
  },

  createLabel(projectId: string, body: { name: string; color?: string }) {
    return request<Label>(`/api/projects/${projectId}/labels`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateLabel(labelId: string, body: { name?: string; color?: string }) {
    return request<Label>(`/api/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteLabel(labelId: string) {
    return request<{ ok: boolean; id: string }>(`/api/labels/${labelId}`, {
      method: 'DELETE',
    });
  },

  listCustomColumns(projectId: string) {
    return request<CustomColumn[]>(`/api/projects/${projectId}/list-columns`);
  },

  createCustomColumn(
    projectId: string,
    body: {
      name: string;
      type: CustomColumnType;
      settings?: CustomColumn['settings'];
    },
  ) {
    return request<CustomColumn>(`/api/projects/${projectId}/list-columns`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateCustomColumn(
    columnId: string,
    body: {
      name?: string;
      position?: number;
      settings?: CustomColumn['settings'];
    },
  ) {
    return request<CustomColumn>(`/api/list-columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteCustomColumn(columnId: string) {
    return request<{ ok: boolean; id: string }>(`/api/list-columns/${columnId}`, {
      method: 'DELETE',
    });
  },

  setCustomValue(issueId: string, columnId: string, value: CustomValuePayload | null) {
    return request<{ ok: boolean }>(`/api/issues/${issueId}/values/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },

  listUsers() {
    return request<User[]>('/api/users');
  },

  listEpics(projectId: string) {
    return request<Epic[]>(`/api/projects/${projectId}/epics`);
  },

  getEpic(epicId: string) {
    return request<Epic>(`/api/epics/${epicId}`);
  },

  createEpic(
    projectId: string,
    body: { name: string; description?: string; document?: string; color?: string },
  ) {
    return request<Epic>(`/api/projects/${projectId}/epics`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateEpic(
    epicId: string,
    body: {
      name?: string;
      description?: string | null;
      document?: string | null;
      color?: string;
      position?: number;
    },
  ) {
    return request<Epic>(`/api/epics/${epicId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteEpic(epicId: string) {
    return request<{ ok: boolean; id: string }>(`/api/epics/${epicId}`, {
      method: 'DELETE',
    });
  },

  attachLabel(issueId: string, labelId: string) {
    return request(`/api/issues/${issueId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    });
  },

  detachLabel(issueId: string, labelId: string) {
    return request(`/api/issues/${issueId}/labels/${labelId}`, {
      method: 'DELETE',
    });
  },

  listComments(issueId: string) {
    return request<Comment[]>(`/api/issues/${issueId}/comments`);
  },

  addComment(issueId: string, body: string) {
    return request<Comment>(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  deleteComment(commentId: string) {
    return request(`/api/comments/${commentId}`, { method: 'DELETE' });
  },

  searchIssues(q: string, limit = 20) {
    return request<SearchResponse>(`/api/search${qs({ q, limit })}`);
  },

  listIssueActivity(issueId: string, limit = 50) {
    return request<Paginated<ActivityEvent>>(
      `/api/issues/${issueId}/activity${qs({ limit })}`,
    );
  },
};
