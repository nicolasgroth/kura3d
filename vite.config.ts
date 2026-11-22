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
    rollupOptions: {
      output: {
        // Divide el bundle web por proveedor para mejorar la carga inicial
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'three-vendor';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/manifold-3d') || id.includes('node_modules/fflate')) {
            return 'geometry-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          return undefined;
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
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
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
