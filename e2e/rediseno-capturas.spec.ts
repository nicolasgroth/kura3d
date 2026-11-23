/**
 * @file e2e/rediseno-capturas.spec.ts
 * @description Capturas de verificación del rediseño de barras (no comprueba nada: deja imágenes en
 * `.eval-tmp/rediseno/` a 1440×900, 1280×800, 1024×768 y 390×844, tema claro y oscuro, español e inglés).
 * Se salta salvo con `REDISENO_CAPTURAS=1`. Ejecuta con
 * `REDISENO_CAPTURAS=1 KURA_URL=… npx playwright test e2e/rediseno-capturas.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/rediseno';
const SIZES = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [390, 844],
] as const;

test.skip(!process.env.REDISENO_CAPTURAS, 'Solo bajo pedido (REDISENO_CAPTURAS=1).');

for (const lang of ['es', 'en'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`capturas ${lang} ${scheme}`, async ({ browser }) => {
      test.setTimeout(240_000);
      for (const [w, h] of SIZES) {
        // Contexto nuevo por tamaño: sin borradores de la captura anterior.
        const context = await browser.newContext({ locale: 'es-CL', colorScheme: scheme, viewport: { width: w, height: h } });
        const page = await context.newPage();
        await abrir(page);
        await page.evaluate(async (l) => {
          const s = (window as any).__s.getState();
          s.setLanguage(l);
          s.createStarterCube();
        }, lang);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SHOTS}/${w}-${lang}-${scheme}.png` });
        await context.close();
      }
    });
  }
}
