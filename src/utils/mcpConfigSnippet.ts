/**
 * @file src/utils/mcpConfigSnippet.ts
 * @description Genera el JSON de configuración del servidor MCP para copiar en un cliente MCP y el comando de
 * registro para Claude Code. La ruta del servidor es absoluta cuando se conoce el repositorio y, si no, un
 * marcador `<REPO_PATH>` visible (un cliente MCP no puede resolver una ruta relativa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpConfig } from '../types/kura';

export const MCP_REPO_PLACEHOLDER = '<REPO_PATH>';
const SERVER_RELATIVE = 'mcp-server/dist/index.js';
export const MCP_REPO_PATH_KEY = 'kura3d-mcp-repo-path';

/** Quita comillas, saltos de línea y barras finales de la ruta escrita por el usuario. */
export function normalizeRepoPath(raw: string): string {
  return raw.replace(/[\r\n"'`]/g, '').trim().replace(/[\\/]+$/, '');
}

/** Ruta absoluta del servidor si hay repositorio conocido; si no, el marcador. */
export function mcpServerPath(repoPath: string): string {
  const repo = normalizeRepoPath(repoPath);
  if (!repo) return `${MCP_REPO_PLACEHOLDER}/${SERVER_RELATIVE}`;
  const sep = repo.includes('\\') && !repo.includes('/') ? '\\' : '/';
  return `${repo}${sep}${SERVER_RELATIVE.replace(/\//g, sep)}`;
}

type SnippetConfig = Pick<McpConfig, 'port' | 'authToken' | 'readOnly'>;

function envFor(config: SnippetConfig, token: string): Record<string, string> {
  const env: Record<string, string> = { KURA_BRIDGE_PORT: String(config.port), KURA_BRIDGE_TOKEN: token };
  if (config.readOnly) env.KURA_BRIDGE_READ_ONLY = 'true';
  return env;
}

/** JSON `mcpServers` listo para copiar. `token` permite mostrarlo enmascarado en pantalla. */
export function buildMcpSnippet(config: SnippetConfig, repoPath: string, token: string = config.authToken): string {
  return JSON.stringify(
    {
      mcpServers: {
        kura3d: {
          command: 'node',
          args: [mcpServerPath(repoPath)],
          env: envFor(config, token),
        },
      },
    },
    null,
    2,
  );
}

/** Comando de Claude Code que registra el servidor (con `<TOKEN>` como marcador, nunca el token real). */
export function buildClaudeAddCommand(config: SnippetConfig, repoPath: string): string {
  const envFlags = Object.entries(envFor(config, '<TOKEN>')).map(([key, value]) => `-e ${key}=${value}`);
  return `claude mcp add kura3d ${envFlags.join(' ')} -- node "${mcpServerPath(repoPath)}"`;
}

export const MCP_BUILD_COMMAND = 'npm run mcp:build';
