/**
 * @file playwright.docs.config.ts
 * @description Configuración del generador de capturas de la documentación pública (`npm run docs:capturas`).
 * Corre solo `e2e/docs/` (la corrida normal de `npm run test:e2e` lo ignora). Ventana 1440×900, tema claro,
 * español. Con `KURA_URL` usa esa web; sin ella levanta Vite en 127.0.0.1:5239.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 5239;
const external = Boolean(process.env.KURA_URL);
process.env.KURA_URL ??= `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: './e2e/docs',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: '.eval-tmp/playwright-docs',
  use: {
    baseURL: process.env.KURA_URL,
    locale: 'es-CL',
    colorScheme: 'light',
    viewport: { width: 1440, height: 900 },
    trace: 'off',
  },
  projects: [{ name: 'docs', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
