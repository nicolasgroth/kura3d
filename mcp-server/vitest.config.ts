/**
 * @file mcp-server/vitest.config.ts
 * @description Configuración aislada de Vitest para el servidor MCP de Kurra3D Studio,
 * evitando resolver el vite.config.ts de la raíz en jobs CI independientes. Las dependencias
 * del motor compartido (`../src/engine`) se resuelven desde `mcp-server/node_modules` para que
 * la suite corra solo con `npm --prefix mcp-server ci`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const localModule = (name: string) =>
  fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three$/, replacement: `${localModule('three')}/build/three.module.js` },
      { find: /^three\/(.*)$/, replacement: `${localModule('three')}/$1` },
      { find: /^manifold-3d$/, replacement: `${localModule('manifold-3d')}/manifold.js` },
      { find: /^fflate$/, replacement: `${localModule('fflate')}/esm/index.mjs` },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
