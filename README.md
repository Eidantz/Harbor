<p align="center">
  <img src="docs/assets/harbor-icon.svg" alt="Harbor" width="128" height="128" />
</p>

<h1 align="center">Harbor</h1>

<p align="center">
  Local-first Kanban board with a Cursor MCP server.<br />
  Run the full stack on your machine — UI, API, Postgres, and agent tools.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-you-can-do">Features</a> ·
  <a href="#mcp-for-cursor">MCP</a> ·
  <a href="#development">Development</a>
</p>

---

## What is Harbor?

Harbor is a **single-operator Kanban** that stays on localhost. Use the web UI to manage projects and issues, or drive the same board from Cursor through a stdio MCP server that talks to the Nest API.

```
Cursor ──stdio──► Harbor MCP ──HTTP Bearer──► Nest API ──► Postgres
Browser ─────────────────────► Harbor UI ──/api──► Nest API
```

| Package | Path | Role |
|---------|------|------|
| `@kanban/api` | `apps/api` | NestJS + Prisma + OpenAPI |
| `@kanban/web` | `apps/web` | Harbor UI (Vite + React) |
| `@kanban/mcp` | `apps/mcp` | Cursor stdio MCP |

---

## What you can do

- **Projects & boards** — multiple projects, Columns and List layouts, column colors, reorder, done columns
- **Issues** — create, edit, move, archive/restore, delete; priority, type, due date, effort (hours / LOC)
- **Dependencies** — issue links (`blocks`, `relates_to`, `duplicates`) with cycle checks; blocker summaries via MCP
- **Labels, comments, activity** — label attach/detach, threaded comments, activity history
- **Attachments** — multipart file upload in the issue drawer (UI/API; max 20 MB)
- **Live updates** — board refreshes over SSE when the API or an MCP agent changes data
- **Global search** — `Ctrl/Cmd+K` across projects
- **Cursor MCP** — projects, columns, issues, links, blockers, epics, labels, comments, activity
- **Auth** — first-run admin signup, cookie sessions for the UI, Bearer MCP tokens from Harbor

---

## Quick start

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io), Docker

```bash
git clone git@github.com:Eidantz/Harbor.git
cd Harbor
pnpm install
pnpm setup:env          # copies .env.example → .env and links apps/api/.env
pnpm docker:up          # builds & starts db + api + web
```

| Service | URL |
|---------|-----|
| Harbor UI | http://localhost:3000 |
| API health | http://localhost:3001/health |
| OpenAPI | http://localhost:3001/api/docs |

On a fresh database, open the UI and **create the admin account**. After that, the same screen is sign-in. Seed data includes sample project **KAN**.

Stop the stack with `pnpm docker:down`.

---

## MCP for Cursor

1. Start Harbor (`pnpm docker:up`) and complete admin signup.
2. In the UI: **MCP tokens** → **Create token** (copy it once).
3. Copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) to `.cursor/mcp.json` and paste the token:

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["apps/mcp/dist/index.js"],
      "env": {
        "KANBAN_API_URL": "http://localhost:3001",
        "KANBAN_API_TOKEN": "<paste token from Harbor>"
      }
    }
  }
}
```

4. Build and reload MCP in Cursor:

```bash
pnpm build:mcp
```

Full tool catalog: [`apps/mcp/README.md`](apps/mcp/README.md).

---

## Development

Keep Postgres in Docker; run API and web on the host:

```bash
pnpm setup:env
docker compose up -d db
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev                 # API :3001 + web :3000
```

Useful scripts: `pnpm dev:api`, `pnpm dev:web`, `pnpm db:studio`, `pnpm smoke`.

---

## Auth & privacy

| Client | Mechanism |
|--------|-----------|
| Harbor UI | First-run signup, then login → HTTP-only session cookie |
| MCP / scripts | `Authorization: Bearer <token>` from **MCP tokens** |

- Compose publishes ports on `127.0.0.1` only.
- Real secrets live in `.env` and `.cursor/mcp.json` — both are gitignored. Use `.env.example` and `.cursor/mcp.json.example` as templates.
- Rotate `SESSION_SECRET` and revoke MCP tokens for anything beyond casual local use.

---

## License

[MIT](LICENSE)
