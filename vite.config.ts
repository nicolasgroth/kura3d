/**
 * @file vite.config.ts
 * @description Configuración de Vite para Kura3D (compatible con despliegue Web y Tauri v2).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Detección del host en modo desarrollo de Tauri
const tauriDevHost = process.env.TAURI_DEV_HOST;

// Mediciones de tiempo (`*.perf.test.ts`, umbrales en ms): el proyecto `perf` solo existe con KURA_PERF=1
// (`npm run test:perf`), así `npm test` y `npx vitest run` no dependen de la carga de la máquina.
const perfProjects = process.env.KURA_PERF
  ? [{ extends: true, test: { name: 'perf', environment: 'node' as const, include: ['src/**/*.perf.test.ts'] } }]
  : [];

/** Divide el bundle web por proveedor para mejorar la carga inicial (`null`: lo decide Rolldown). */
function vendorChunk(id: string): string | null {
  const path = id.replaceAll('\\', '/');
  if (path.includes('node_modules/three') || path.includes('node_modules/@react-three')) return 'three-vendor';
  if (path.includes('node_modules/react') || path.includes('node_modules/zustand')) return 'react-vendor';
  if (path.includes('node_modules/manifold-3d') || path.includes('node_modules/fflate')) return 'geometry-vendor';
  if (path.includes('node_modules/lucide-react')) return 'icons-vendor';
  return null;
}

export default defineConfig({
  plugins: [react()],

  // Evita que Vite limpie la consola de errores de Rust en modo Tauri
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    // Los worktrees de agentes y los temporales de QA no deben recargar la app en desarrollo.
    watch: { ignored: ['**/.claude/**', '**/.eval-tmp/**', '**/.playwright-mcp/**', '**/src-tauri/target/**'] },
    host: tauriDevHost || false,
    hmr: tauriDevHost
      ? {
          protocol: 'ws',
          host: tauriDevHost,
          port: 5174,
        }
      : undefined,
  },

  // Optimización para WebAssembly (manifold-3d) y build moderno ESNext
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },

  // Los Workers ya se crean con `type: 'module'`; en formato ES pueden cargar trozos diferidos
  // (p. ej. opentype.js y la fuente del texto 3D solo al crear el primer texto).
  worker: {
    format: 'es',
  },

  build: {
    target: 'esnext',
    sourcemap: true,
    // Vite 8 empaqueta con Rolldown: `rollupOptions` pasa a `rolldownOptions` y `manualChunks`
    // (obsoleto) a `codeSplitting.groups`, con la misma división por proveedor de antes.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: vendorChunk, debugName: 'vendors' }],
        },
      },
    },
  },

  // Configuración para pruebas unitarias con Vitest
  // Unitarias (*.test.ts) en Node; componentes React (*.test.tsx) en jsdom con Testing Library.
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'], exclude: ['**/node_modules/**', '**/*.perf.test.ts'] },
      },
      ...perfProjects,
      {
        extends: true,
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setupComponents.ts'],
        },
      },
    ],
  },
});
