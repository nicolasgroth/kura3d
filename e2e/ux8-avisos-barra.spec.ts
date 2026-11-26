/**
 * @file e2e/ux8-avisos-barra.spec.ts
 * @description Lote ux8: los avisos no tapan paneles ni controles del visor (apilado acotado), la barra de
 * herramientas tiene exactamente una herramienta pulsada y ninguna apagada, y a 1024 px el chip de la cama y el
 * pie caben sin scroll horizontal. Ejecuta con `KURA_URL=… npx playwright test e2e/ux8-avisos-barra.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

async function conCaja(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, {});
    s.setSelection([obj.id]);
  });
}

async function avisos(page: Page, n: number) {
  await page.evaluate((count) => {
    const s = (window as any).__s.getState();
    for (let i = 0; i < count; i += 1) s.addToast(`Aviso de prueba número ${i + 1} con texto algo largo para ocupar`, 'error');
  }, n);
}

const caja = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

const solapa = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [w, h] of [[1280, 720], [1440, 900]] as const) {
  test(`los avisos no tapan el panel derecho ni los controles del visor (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await abrir(page);
    await conCaja(page);
    await avisos(page, 5);
    const pila = page.locator('.kura-toast-stack');
    await expect(pila).toBeVisible();
    await page.screenshot({ path: `.eval-tmp/ux8-avisos-${w}.png` });
    const rp = await caja(page, '.kura-toast-stack');
    // Apilado acotado: como mucho 2 avisos visibles y el resto plegado en «N aviso(s) más».
    await expect(page.locator('.kura-toast')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /avisos más/ })).toBeVisible();
    // Abajo a la izquierda del visor: no toca el panel derecho, el cubo de vista ni la mitad derecha del visor.
    const visor = await caja(page, '.kura-viewport-wrap');
    expect(rp.x + rp.w).toBeLessThan(visor.x + visor.w / 2);
    expect(rp.y).toBeGreaterThan(visor.y + visor.h * 0.4);
    for (const sel of ['#kura-inspector-panel', '.kura-tool-rail', '.kura-hud-top-stack']) {
      if (await page.locator(sel).count()) {
        const r = await caja(page, sel);
        expect(solapa(rp, r), `la pila solapa ${sel}`).toBe(false);
      }
    }
  });
}

test('barra de herramientas: exactamente una pulsada y ninguna apagada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrir(page);
  const pulsadas = () => page.locator('#kura-tool-rail button[aria-pressed="true"]');
  // Escena vacía: solo Seleccionar, aunque el modo interno sea «mover».
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).toHaveAccessibleName(/Seleccionar|Select/);
  await conCaja(page);
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).toHaveAccessibleName(/Mover|Move/);
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).not.toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(() => (window as any).__s.getState().deleteObjects((window as any).__s.getState().objects.map((o: any) => o.id)));
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).not.toHaveAttribute('aria-disabled', 'true');
});

test('a 1024 px el pie con una cama de nombre largo cabe: sin scroll horizontal ni recortes contra el borde', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await abrir(page);
  await conCaja(page);
  await page.evaluate(() => (window as any).__s.getState().setPrinterProfile('free-studio'));
  await expect(page.locator('.kura-measures-printer')).toContainText('Estudio 3D Libre');
  const r = await page.evaluate(() => {
    const pie = document.querySelector('footer.kura-statusbar') as HTMLElement;
    const ultimo = [...pie.querySelectorAll('.kura-statusbar-group:last-child > *')].pop() as HTMLElement;
    return {
      desborda: document.documentElement.scrollWidth > window.innerWidth,
      pieDesborda: pie.scrollWidth > pie.clientWidth + 1,
      derecha: ultimo.getBoundingClientRect().right,
      ancho: window.innerWidth,
    };
  });
  expect(r.desborda).toBe(false);
  expect(r.pieDesborda).toBe(false);
  expect(r.derecha).toBeLessThanOrEqual(r.ancho);
  // El chip lleva el nombre completo en el tooltip aunque se acorte.
  await expect(page.locator('.kura-measures-trigger')).toHaveAttribute('title', /Estudio 3D Libre \(Sin límites de cama\)/);
  await page.screenshot({ path: '.eval-tmp/ux8-1024.png' });
});

test('árbol de escena: con 95 nombres de prefijo común cada fila conserva su final y el nombre completo en el tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const o = await s.createPrimitive('box', { width: 10, height: 10, depth: 10 }, {});
    s.updateObjectMeta(o.id, { name: '1_Tapa_Lateral_Izquierda_Soporte_Interior_0042' });
  });
  const nombre = page.locator('.kura-scene-name.kura-mid-ellipsis').first();
  await expect(nombre).toHaveAttribute('title', '1_Tapa_Lateral_Izquierda_Soporte_Interior_0042');
  await expect(nombre.locator('.kura-mid-tail')).toBeVisible();
  const visible = await nombre.locator('.kura-mid-tail').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const fila = el.closest('[role="treeitem"], li, .kura-scene-item') as HTMLElement;
    return r.right <= fila.getBoundingClientRect().right + 1;
  });
  expect(visible).toBe(true);
});
