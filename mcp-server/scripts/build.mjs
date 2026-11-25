/**
 * @file mcp-server/scripts/build.mjs
 * @description Empaqueta el servidor MCP de Kurra3D Studio junto con el motor geométrico compartido
 * (`src/engine/**` de la app) en `dist/index.js` mediante esbuild. Las dependencias npm
 * (manifold-3d con su WASM, three, fflate, SDK MCP, ws, zod) quedan externas y se resuelven
 * en tiempo de ejecución desde `mcp-server/node_modules`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await rm(resolve(root, 'dist'), { recursive: true, force: true });

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  legalComments: 'inline',
  logLevel: 'warning',
});

console.error('[Kurra3D-MCP] dist/index.js generado con el motor compartido de src/engine.');
