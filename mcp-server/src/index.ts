/**
 * @file mcp-server/src/index.ts
 * @description Punto de entrada del servidor MCP open-source de Kurra3D Studio sobre StdioServerTransport.
 * Inicia el puente WebSocket local (`127.0.0.1:17432`) y el motor autónomo Headless,
 * registrando todos los logs exclusivamente en `stderr` para mantener `stdout` limpio para JSON-RPC.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { KuraBridgeServer, type KuraBridgeOptions } from './bridge.js';
import { KuraHeadlessEngine } from './headlessEngine.js';
import { registerKuraTools } from './tools.js';

/** Crea e inicializa una instancia configurada del servidor MCP de Kurra3D Studio. */
export function createKuraMcpServer(
  options?: { bridgePort?: number } & Omit<KuraBridgeOptions, 'port'>
) {
  const { bridgePort, ...rest } = options ?? {};
  const bridge = new KuraBridgeServer({ ...rest, port: bridgePort });
  const headless = new KuraHeadlessEngine();

  const server = new McpServer(
    {
      name: 'kura3d-mcp-server',
      version: '0.5.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  registerKuraTools(server, { bridge, headless });
  return { server, bridge, headless };
}

async function main(): Promise<void> {
  // CLI (`--read-only`, `--token-file`, `--export-dir`, …) tiene prioridad sobre las variables KURA_*
  const { server, bridge } = createKuraMcpServer({ argv: process.argv.slice(2) });

  // Inicia el puente WebSocket sin bloquear ni abortar si otro proceso ya ocupa el puerto
  await bridge.start();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[Kurra3D-MCP] Servidor MCP listo en transporte stdio (Nicolás Groth, MIT).');

  const shutdown = async () => {
    console.error('[Kurra3D-MCP] Cerrando servidor MCP y puente WebSocket...');
    await server.close();
    await bridge.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

// Ejecuta automáticamente únicamente cuando se invoca como proceso CLI principal
const isMainEntry =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'));

if (isMainEntry) {
  main().catch((err) => {
    console.error('[Kurra3D-MCP] Error fatal al iniciar:', err);
    process.exit(1);
  });
}
