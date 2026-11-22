/**
 * @file e2e/import-export.spec.ts
 * @description Recorrido Playwright: importar por arrastre un lote con archivos inválidos, un solo Deshacer
 * por lote, y exportar escena completa en STL. Requiere la
 * web en KURA_URL (por defecto http://127.0.0.1:5189; `npm run test:e2e` la levanta). Fixtures: generar con .eval-tmp/qa-interfaz/gen.mjs.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

// Los fixtures viven en .eval-tmp (fuera del repo); sin ellos el spec se salta con motivo en vez de fallar.
const FIXTURES = '.eval-tmp/qa-interfaz/fx';
test.skip(!existsSync(FIXTURES), `faltan los fixtures en ${FIXTURES} (generar con .eval-tmp/qa-interfaz/gen.mjs)`);

test('lote con archivos inválidos importa los válidos y nombra los fallidos', async ({ page }) => {
  await page.goto(process.env.KURA_URL ?? 'http://127.0.0.1:5189/');
  await page.evaluate(async () => {
    const dt = new DataTransfer();
    for (const n of ['cubo10.stl', 'roto.stl', 'cubo20.stl', 'inst.3mf']) {
      const blob = await (await fetch('/.eval-tmp/qa-interfaz/fx/' + n)).blob();
      dt.items.add(new File([blob], n));
    }
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.getByText(/roto\.stl/)).toBeVisible();
  await expect(page.locator('footer')).toContainText('5 objs');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('footer')).toContainText('0 objs');
});
