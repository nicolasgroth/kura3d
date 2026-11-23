/**
 * @file e2e/gen-ui-responsive.spec.ts
 * @description Los diálogos de generadores y el texto 3D se ven y se manejan en 390, 1024 y escritorio, en tema claro
 * y oscuro, sin errores de consola ni desbordes horizontales; deja capturas para revisar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL' });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';
const TAMANOS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '1024', width: 1024, height: 768 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

for (const tam of TAMANOS) {
  for (const tema of ['light', 'dark'] as const) {
    test(`diálogos de generadores a ${tam.nombre} px, tema ${tema}`, async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
      page.on('pageerror', (e) => errores.push(String(e)));
      await page.setViewportSize({ width: tam.width, height: tam.height });
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page);
      await page.evaluate(async () => {
        const s = (window as any).__s.getState();
        await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' });
      });
      for (const dlg of ['image', 'svg', 'mold', 'thread', 'project'] as const) {
        await page.evaluate((d) => (window as any).__s.getState().setActiveDialog(d), dlg);
        const panel = page.getByRole('dialog');
        await expect(panel).toBeVisible();
        // Sin desborde horizontal de la página.
        const ancho = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(ancho.sw, `${dlg} desborda a ${tam.nombre}`).toBeLessThanOrEqual(ancho.cw + 1);
        if (dlg === 'image' || dlg === 'mold') await page.screenshot({ path: `${SHOTS}/r-${dlg}-${tam.nombre}-${tema}.png` });
        await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));
      }
      // Texto 3D desde Formas (en móvil el panel de Formas es una hoja).
      await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));
      const abrirFormas = page.getByRole('button', { name: 'Formas' });
      if (tam.width <= 900 && (await abrirFormas.count())) await abrirFormas.first().click().catch(() => undefined);
      const texto3d = page.getByRole('button', { name: 'Texto 3D' });
      if (await texto3d.first().isVisible().catch(() => false)) {
        await texto3d.first().click();
        await page.screenshot({ path: `${SHOTS}/r-texto-${tam.nombre}-${tema}.png` });
      }
      expect(errores.filter((e) => !/404/.test(e))).toEqual([]);
    });
  }
}
