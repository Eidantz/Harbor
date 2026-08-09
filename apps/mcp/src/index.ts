#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClientFromEnv } from './client.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
  const api = createClientFromEnv();

  const server = new McpServer(
    {
      name: 'kanban',
      version: '0.1.0',
    },
    {
      instructions:
        'Local Kanban board MCP. Tools map 1:1 to the Nest API. ' +
        'All responses are JSON: { ok: true, data } or { ok: false, error: { code, message, details? } }. ' +
        'Links support type "blocks" only. Prefer fetch_blockers or issue_get.blockers for blocker summaries; link_* for mutations. ' +
        'Epics are outside the board; use epic_* tools and issue_create/update epicId (top-level only). ' +
        'Moving an issue to Done may include soft OPEN_BLOCKERS warnings.',
    },
  );

  registerTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[kanban-mcp] ready (API: ${api.apiBaseUrl})`,
  );
}

main().catch((err) => {
  console.error('[kanban-mcp] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
