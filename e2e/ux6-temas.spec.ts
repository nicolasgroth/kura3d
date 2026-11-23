/**
 * @file e2e/ux6-temas.spec.ts
 * @description Recorrido visual del lote ux6 en 1440, 1024 y 390 px, tema claro y oscuro: barra compacta,
 * vista sin cama, panel de Medir y diálogo de unidades, sin errores en la consola del navegador. Guarda
 * capturas en `.eval-tmp/ux6/`. Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-temas.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux6';

for (const scheme of ['light', 'dark'] as const) {
  for (const width of [1440, 1024, 390]) {
    test(`ux6 en ${width} px, tema ${scheme}, sin errores de consola`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await abrir(page);
      await page.evaluate((s) => (window as any).__s.getState().setColorScheme(s), scheme);
      await page.evaluate(() => (window as any).__s.getState().setLeftSidebarMode('compact'));
      await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
      await expect(page.getByText(/mide 0,9 mm en su lado mayor/).first()).toBeVisible({ timeout: 30000 });
      await page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first().getByRole('button', { name: 'Otra unidad…' }).click();
      const dialog = page.getByRole('dialog', { name: '¿En qué unidad está este modelo?' });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/tema-${scheme}-${width}-unidades.png` });
      await page.getByTestId('unit-apply').click();
      await expect(dialog).toBeHidden();
      await page.evaluate(() => (window as any).__s.getState().toggleShowBed());
      await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${SHOTS}/tema-${scheme}-${width}-sincama-medir.png` });
      const box = await page.locator('.kura-app').boundingBox();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}
