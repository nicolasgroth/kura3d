/**
 * @file e2e/ux6-inspector-reparar.spec.ts
 * @description Inspector tras reparar: con el inspector desplazado, pulsar «Reparar malla» en el aviso de
 * importación deja a la vista el rótulo «Malla» con el estado ya actualizado («Cerrada»), sin saltos
 * (desplazamiento mínimo). Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-inspector-reparar.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux6';

/** Cubo de 30 mm sin la cara superior (malla abierta con 4 bordes libres). */
function cuboAbierto(): string {
  const h = 15;
  const L = ['solid abierto'];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const tri of [[a, b, c], [a, c, d]]) {
      L.push('facet normal 0 0 0', 'outer loop');
      for (const v of tri) L.push(`vertex ${v[0]} ${v[1]} ${v[2]}`);
      L.push('endloop', 'endfacet');
    }
  };
  const p = (x: number, y: number, z: number) => [x * h, y * h, z * h];
  quad(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1));
  quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1));
  quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
  quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1));
  L.push('endsolid abierto');
  return L.join('\n');
}

const enVista = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="mesh-status"]');
    const sc = document.querySelector('#kura-inspector-panel .kura-scroll-area');
    if (!el || !sc) return null;
    const a = el.getBoundingClientRect();
    const b = sc.getBoundingClientRect();
    return { visible: a.top >= b.top - 1 && a.top + 20 <= b.bottom + 1, scrollTop: sc.scrollTop };
  });

test('tras «Reparar malla» desde el aviso, el estado de la malla queda a la vista', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await importarStl(page, 'abierto.stl', cuboAbierto());
  const aviso = page.locator('.kura-toast', { hasText: 'tiene la malla abierta' }).first();
  await expect(aviso).toBeVisible({ timeout: 30000 });
  const status = page.getByTestId('mesh-status');
  await expect(status).toContainText('Abierta');
  // El usuario baja hasta el final del inspector.
  await page.evaluate(() => {
    const sc = document.querySelector('#kura-inspector-panel .kura-scroll-area')!;
    sc.scrollTop = sc.scrollHeight;
  });
  await page.waitForTimeout(200);
  await aviso.getByRole('button', { name: 'Reparar malla' }).click();
  await expect(status).toContainText('Cerrada', { timeout: 30000 });
  await expect.poll(async () => (await enVista(page))?.visible).toBe(true);
  await page.screenshot({ path: `${SHOTS}/inspector-tras-reparar-1440.png` });
});
