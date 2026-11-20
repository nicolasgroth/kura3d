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

  build: {
    target: 'esnext',
    sourcemap: true,
  },

  // Configuración para pruebas unitarias con Vitest
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
