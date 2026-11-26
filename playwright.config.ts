/**
 * @file playwright.config.ts
 * @description Configuración mínima de las pruebas e2e (`npm run test:e2e`): Chromium, specs en `e2e/`.
 * Si viene `KURA_URL` usa esa web; si no, levanta Vite en 127.0.0.1:5290 y lo publica en `KURA_URL`
 * para los specs (que leen esa variable). Ventana 1280×720 (la de los specs, que usan coordenadas de pantalla).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 5290;
const external = Boolean(process.env.KURA_URL);
process.env.KURA_URL ??= `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: './e2e',
  // El generador de capturas de la documentación (e2e/docs/) tiene su propia config: `npm run docs:capturas`.
  testIgnore: ['docs/**'],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: '.eval-tmp/playwright-results',
  use: {
    baseURL: process.env.KURA_URL,
    // Sin preferencia guardada la app sigue el idioma del navegador: los specs en español lo fijan aquí.
    locale: 'es-CL',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
