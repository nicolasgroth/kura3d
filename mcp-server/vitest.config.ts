/**
 * @file mcp-server/vitest.config.ts
 * @description Configuración aislada de Vitest para el servidor MCP de Kura3D,
 * evitando resolver el vite.config.ts de la raíz en jobs CI independientes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
