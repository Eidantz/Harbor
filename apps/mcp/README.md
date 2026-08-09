# @kanban/mcp

Stdio MCP server for the local Kanban board. Talks **HTTP only** to the Nest API (`KANBAN_API_URL`) with `Authorization: Bearer $KANBAN_API_TOKEN`.

## Setup

1. Run the API (e.g. `bun run docker:up` or `bun run dev:api`) on `http://localhost:3001`.
2. In Harbor → **MCP tokens** → create a token and copy the plaintext.
3. Build:

```bash
bun run build:mcp
```

4. Register the stdio server in any MCP client (Claude Desktop / Claude Code, Cursor, etc.) — paste the token:

```json
"harbor": {
  "command": "node",
  "args": ["apps/mcp/dist/index.js"],
  "env": {
    "KANBAN_API_URL": "http://localhost:3001",
    "KANBAN_API_TOKEN": "<token from Harbor MCP tokens>"
  }
}
```

Use an absolute path to `dist/index.js` when the client does not start in the repo root. See the root README for client-specific config locations.

Dev (hot reload):

```bash
KANBAN_API_URL=http://localhost:3001 KANBAN_API_TOKEN=<token> bun run dev:mcp
```

## Response shape

Every tool returns JSON text:

- Success: `{ "ok": true, "data": ... }`
- Failure: `{ "ok": false, "error": { "code": "...", "message": "...", "details?": ... } }`

## Tool catalog

| Tool | Purpose |
|------|---------|
| `health` | API reachability |
| `project_list` / `project_get` | Projects |
| `project_create` / `project_update` | Create/update (`theme`, `boardLayout`, `listFields`) |
| `project_delete` | Delete a project and everything in it (irreversible — confirm with the user) |
| `column_list` | Columns (`isDone`, `color`) |
| `column_create` / `column_update` / `column_delete` / `column_reorder` | Column CRUD + accent color |
| `board_get` | Columns + ordered issues (archived excluded) |
| `issue_list` | Filtered/paginated issues; `archived: "false"` (default) / `"true"` / `"all"` |
| `issue_get` | Full detail incl. `blockers`, `humanEffort`, `locEffort`, `dueDate`, `archivedAt` |
| `issue_create` / `issue_update` | Create/patch (priority, humanEffort hours, locEffort LOC, dueDate ISO date); `issue_update` also takes `archived: true/false` to archive/restore |
| `issue_move` | Column + rank; soft-warn on open blockers into done column |
| `issue_delete` | Permanently delete issue (prefer `archived: true` when in doubt) |
| `subtask_list` / `subtask_create` | Subtasks |
| `fetch_blockers` | Blockers summary by id or key |
| `link_list` / `link_create` / `link_delete` | Issue links: `blocks` (cycle-checked), `relates_to` (symmetric), `duplicates` |
| `epic_list` / `epic_get` / `epic_create` / `epic_update` / `epic_delete` | Epics (assign via `issue_create`/`issue_update` `epicId`, top-level only) |
| `label_*` | Labels |
| `comment_list` / `comment_add` | Comments |
| `activity_list` | Activity |

List tools accept optional `limit` (1–200) and `offset`. Use string `"null"` for unset `parentId` filters.

File attachments are not exposed as MCP tools (multipart upload); use the Harbor UI or the HTTP API directly.

Sprints do not exist in Harbor — work lives on board columns only.

## Auth env

| Variable | Default | Role |
|----------|---------|------|
| `KANBAN_API_URL` | `http://localhost:3001` | API base |
| `KANBAN_API_TOKEN` | — (required) | Bearer from Harbor → MCP tokens |
