/**
 * @file mcp-server/src/projectInfoTools.ts
 * @description Herramientas MCP de los datos del proyecto: `kura_get_project_info` (lectura) y
 * `kura_set_project_info` (escritura: descripción, notas y autor). Con la app conectada van por el Command Bus
 * (`get_project_info` / `set_project_info`: marca el proyecto como modificado, no es un paso de deshacer); sin
 * interfaz, por el mismo esquema y la misma limpieza, en memoria mientras corre el servidor (`headlessProjectInfo.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PROJECT_INFO_LIMITS as L } from '../../src/project/projectInfo';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export function registerProjectInfoTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_get_project_info',
    {
      title: 'Get project info',
      description:
        'Reads the project info: name (null without a saved project), description, notes, author (empty when not set), ' +
        'createdAt and modifiedAt (ISO 8601 UTC or null) and workSeconds. Read-only. Without the app (headless) the info ' +
        'lives in memory while the server runs: name null, no dates, workSeconds 0 (mode: "headless"). The name, ' +
        'description and author travel in exported 3MF files as the standard Title, Description and Designer metadata.',
      inputSchema: {},
    },
    async () => dispatchWithFallback(ctx, 'get_project_info', {}, () => ctx.headless.projectInfo.get()),
  );

  server.registerTool(
    'kura_set_project_info',
    {
      title: 'Set project info',
      description:
        'Writes the project description, notes and/or author (at least one). Plain text without control characters; ' +
        'an empty string clears the field. Marks the project as modified; it is not an undo step and does not change ' +
        'dates (the app keeps them). Returns the same fields as kura_get_project_info plus changed (false when nothing ' +
        'changed). Unknown fields fail with invalid-params; busy while the project is being opened or saved. Headless: ' +
        'kept in memory while the server runs. Blocked in read-only mode.',
      inputSchema: {
        description: z.string().max(L.description).optional().describe(`One line, up to ${L.description} characters.`),
        notes: z.string().max(L.notes).optional().describe(`Several lines allowed, up to ${L.notes} characters.`),
        author: z.string().max(L.author).optional().describe(`One line, up to ${L.author} characters.`),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'set_project_info', { ...args }, () => ctx.headless.projectInfo.set({ ...args })),
  );
}
