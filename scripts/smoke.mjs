#!/usr/bin/env node
/**
 * Happy-path smoke against a live Kanban API (same HTTP paths the MCP uses).
 *
 * Usage (API must be up):
 *   bun run smoke
 *
 * On a fresh DB (no users) it signs up a smoke admin and mints a DB token.
 * On an existing DB set KANBAN_API_TOKEN (create one in Harbor → MCP tokens).
 * Env: KANBAN_API_URL, optional KANBAN_API_TOKEN
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile() {
  try {
    const text = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile();

const BASE =
  (process.env.KANBAN_API_URL || process.env.API_PUBLIC_URL || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  );

let bearerToken = (process.env.KANBAN_API_TOKEN || '').trim();
let sessionCookie = '';

const TAG = `[smoke-${Date.now()}]`;
let passed = 0;
let failed = 0;

function ok(label, detail = '') {
  passed += 1;
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, err) {
  failed += 1;
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`  ✗ ${label} — ${msg}`);
}

function captureCookie(res) {
  const raw = res.headers.getSetCookie?.() || [];
  const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
  for (const c of list) {
    const match = String(c).match(/kanban_session=[^;]+/);
    if (match) sessionCookie = match[0];
  }
}

async function api(method, path, { body, auth = true, query, cookie = false } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: 'application/json' };
  if (auth) {
    if (!bearerToken) throw new Error('No bearer token available');
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  if (cookie && sessionCookie) headers.Cookie = sessionCookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  captureCookie(res);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

let mintedTokenId = null;

async function ensureBearer() {
  const email = `smoke-admin-${Date.now()}@localhost.dev`;
  const password = 'smoke-test-password';

  const setup = await api('GET', '/api/auth/setup', { auth: false });
  if (setup?.needsSignup) {
    await api('POST', '/api/auth/signup', {
      auth: false,
      body: { email, password },
    });
    ok('admin_signup', 'created smoke admin');
  } else if (bearerToken) {
    ok('admin_signup', 'admin already exists (using env token)');
    return;
  } else {
    throw new Error(
      'Admin already exists and no KANBAN_API_TOKEN set. Create a token in Harbor → MCP tokens and set KANBAN_API_TOKEN.',
    );
  }

  if (bearerToken) {
    ok('mcp_token', 'using env KANBAN_API_TOKEN');
    return;
  }

  if (!sessionCookie) {
    await api('POST', '/api/auth/login', {
      auth: false,
      body: { email, password },
    });
  }

  const created = await api('POST', '/api/auth/tokens', {
    auth: false,
    cookie: true,
    body: { name: `${TAG} mcp` },
  });
  if (!created?.token) throw new Error('token create missing plaintext');
  bearerToken = created.token;
  mintedTokenId = created.id;
  ok('mcp_token', `created ${created.prefix}…`);
}

async function main() {
  console.log(`Smoke → ${BASE}`);
  console.log(`Tag: ${TAG}\n`);

  const cleanup = { issueIds: [], linkId: null, tokenId: null };

  // ── health (MCP: health) ──────────────────────────────────────────────
  try {
    const health = await api('GET', '/health', { auth: false });
    if (!health?.ok) throw new Error(`unexpected body: ${JSON.stringify(health)}`);
    ok('health', health.service || 'ok');
  } catch (e) {
    fail('health', e);
    console.error('\nAPI not reachable. Start with: bun run docker:up  or  bun run dev:api');
    process.exit(1);
  }

  try {
    await ensureBearer();
  } catch (e) {
    fail('mcp_token', e);
    process.exit(1);
  }

  // ── project_list (MCP: project_list) ──────────────────────────────────
  let project;
  try {
    const projects = await api('GET', '/api/projects');
    if (!Array.isArray(projects) || projects.length === 0) {
      throw new Error('expected at least one project (run bun run db:seed)');
    }
    project = projects.find((p) => p.key === 'KAN') || projects[0];
    ok('project_list', `${projects.length} project(s), using ${project.key}`);
  } catch (e) {
    fail('project_list', e);
    process.exit(1);
  }

  // ── columns / board ───────────────────────────────────────────────────
  let columns;
  let doneColumn;
  try {
    columns = await api('GET', `/api/projects/${project.id}/columns`);
    doneColumn = columns.find((c) => c.isDone) || columns.find((c) => c.name === 'Done');
    const todoColumn = columns.find((c) => c.name === 'To Do');
    if (!doneColumn || !todoColumn) throw new Error('missing To Do / Done columns');

    const board = await api('GET', `/api/projects/${project.id}/board`);
    if (!board?.columns) throw new Error('board missing columns');
    ok('board_get', `${board.columns.length} columns`);

    const painted = await api('PATCH', `/api/columns/${todoColumn.id}`, {
      body: { color: '#7aa2f7' },
    });
    if (painted?.color !== '#7aa2f7') throw new Error('column color not set');
    ok('column_color', painted.color);
  } catch (e) {
    fail('board_get', e);
  }

  // ── create / link / move ──────────────────────────────────────────────
  let blocker;
  let blocked;
  try {
    blocker = await api('POST', `/api/projects/${project.id}/issues`, {
      body: {
        title: `${TAG} blocker`,
        type: 'task',
        priority: 'high',
        humanEffort: 1.5,
        locEffort: 120,
        columnId: columns.find((c) => c.name === 'To Do').id,
      },
    });
    cleanup.issueIds.push(blocker.id);

    blocked = await api('POST', `/api/projects/${project.id}/issues`, {
      body: {
        title: `${TAG} blocked`,
        type: 'task',
        priority: 'medium',
        humanEffort: 3,
        locEffort: 400,
        columnId: columns.find((c) => c.name === 'In Progress').id,
      },
    });
    cleanup.issueIds.push(blocked.id);
    if (blocker.humanEffort !== 1.5 || blocked.locEffort !== 400) {
      throw new Error('effort fields missing on create');
    }
    ok('issue_create', `${blocker.key}, ${blocked.key} (+effort)`);

    const link = await api('POST', `/api/issues/${blocker.id}/links`, {
      body: { targetId: blocked.id },
    });
    cleanup.linkId = link.id;
    ok('link_create', `${blocker.key} blocks ${blocked.key}`);

    const moved = await api('POST', `/api/issues/${blocked.id}/move`, {
      body: { columnId: doneColumn.id },
    });
    const warn = moved?.warnings?.find((w) => w.code === 'OPEN_BLOCKERS');
    if (!warn) throw new Error('expected OPEN_BLOCKERS soft warning');
    ok('issue_move → Done', 'OPEN_BLOCKERS soft warning present');
  } catch (e) {
    fail('create/link/move', e);
  }

  // ── due date + archive / restore ──────────────────────────────────────
  try {
    const issue = await api('POST', `/api/projects/${project.id}/issues`, {
      body: {
        title: `${TAG} due+archive`,
        dueDate: '2026-12-31',
        columnId: columns.find((c) => c.name === 'To Do').id,
      },
    });
    cleanup.issueIds.push(issue.id);
    if (!issue.dueDate?.startsWith('2026-12-31')) {
      throw new Error('dueDate missing on create');
    }

    const cleared = await api('PATCH', `/api/issues/${issue.id}`, {
      body: { dueDate: null },
    });
    if (cleared.dueDate !== null) throw new Error('dueDate not cleared');
    const set = await api('PATCH', `/api/issues/${issue.id}`, {
      body: { dueDate: '2027-01-15' },
    });
    if (!set.dueDate?.startsWith('2027-01-15')) {
      throw new Error('dueDate not updated');
    }
    ok('issue_due_date', 'create + clear + update');

    const archived = await api('PATCH', `/api/issues/${issue.id}`, {
      body: { archived: true },
    });
    if (!archived.archivedAt) throw new Error('archivedAt not set');

    const board = await api('GET', `/api/projects/${project.id}/board`);
    if (board.columns.some((c) => c.issues.some((i) => i.id === issue.id))) {
      throw new Error('archived issue still on board');
    }

    const activeList = await api('GET', `/api/projects/${project.id}/issues`, {
      query: { q: `${TAG} due+archive` },
    });
    if (activeList.items.some((i) => i.id === issue.id)) {
      throw new Error('archived issue in default (active) list');
    }

    const archivedList = await api('GET', `/api/projects/${project.id}/issues`, {
      query: { q: `${TAG} due+archive`, archived: 'true' },
    });
    if (!archivedList.items.some((i) => i.id === issue.id)) {
      throw new Error('archived issue missing from archived=true list');
    }
    ok('issue_archive', 'hidden from board + default list, listed via archived=true');

    const restored = await api('PATCH', `/api/issues/${issue.id}`, {
      body: { archived: false },
    });
    if (restored.archivedAt !== null) {
      throw new Error('archivedAt not cleared on restore');
    }
    const board2 = await api('GET', `/api/projects/${project.id}/board`);
    if (!board2.columns.some((c) => c.issues.some((i) => i.id === issue.id))) {
      throw new Error('restored issue not back on board');
    }
    ok('issue_restore', 'back on board');
  } catch (e) {
    fail('due-date/archive', e);
  }

  // ── MCP client import smoke ───────────────────────────────────────────
  try {
    const { KanbanApiClient } = await import('../apps/mcp/dist/client.js');
    const client = new KanbanApiClient({ baseUrl: BASE, token: bearerToken });
    const health = await client.get('/health', undefined, false);
    if (!health?.ok) throw new Error('mcp client health failed');
    const projects = await client.get('/api/projects');
    if (!Array.isArray(projects)) throw new Error('mcp client projects failed');
    ok('MCP KanbanApiClient', 'health + project_list');
  } catch (e) {
    fail('MCP KanbanApiClient', e);
  }

  // Cleanup
  console.log('\nCleanup');
  for (const id of cleanup.issueIds) {
    try {
      await api('DELETE', `/api/issues/${id}`);
      ok(`delete issue ${id.slice(0, 8)}…`);
    } catch (e) {
      fail(`delete issue ${id}`, e);
    }
  }
  if (mintedTokenId) {
    try {
      await api('DELETE', `/api/auth/tokens/${mintedTokenId}`, { cookie: true });
      ok('revoke smoke token');
    } catch (e) {
      fail('revoke smoke token', e);
    }
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
