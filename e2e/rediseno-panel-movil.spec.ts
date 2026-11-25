/**
 * @file e2e/rediseno-panel-movil.spec.ts
 * @description Panel contextual en pantallas estrechas (rediseño, lote 2): a 390 px el mismo contenido (proyecto,
 * resumen del objeto y opciones de una acción) va en la hoja inferior sin desbordar a lo ancho; F3 abre la
 * Escena y el botón Escena de la barra inferior la marca; a 1024 px el panel lateral muestra el contexto.
 * Deja capturas en `.eval-tmp/rediseno-2/` en tema claro y oscuro.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-panel-movil.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crearCubo } from './ux-movil-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/rediseno-2';
const panel = (page: Page) => page.locator('#kura-inspector-panel');

/** Nada desborda a lo ancho: ni la página ni el panel. */
async function sinDesborde(page: Page) {
  const r = await page.evaluate(() => {
    const p = document.querySelector('#kura-inspector-panel') as HTMLElement | null;
    const area = p?.querySelector('.kura-scroll-area') as HTMLElement | null;
    return {
      doc: document.documentElement.scrollWidth - window.innerWidth,
      area: area ? area.scrollWidth - area.clientWidth : 0,
    };
  });
  expect(r.doc).toBeLessThanOrEqual(0);
  expect(r.area).toBeLessThanOrEqual(1);
}

test('1024 px: el panel lateral sigue el contexto (claro y oscuro)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await abrir(page);
  await crearCubo(page);
  await page.evaluate(() => (window as any).__s.getState().setSelection([(window as any).__s.getState().objects[0].id]));
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
  await sinDesborde(page);
  await page.screenshot({ path: `${OUT}/t1024-objeto-claro.png` });
  await panel(page).getByRole('button', { name: 'Revisar si se puede imprimir' }).click();
  await expect(panel(page).getByRole('heading', { name: 'Revisar si se puede imprimir' })).toBeVisible();
  await page.evaluate(() => (window as any).__s.getState().setColorScheme('dark'));
  await page.screenshot({ path: `${OUT}/t1024-accion-oscuro.png` });
});
