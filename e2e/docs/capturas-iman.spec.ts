/**
 * @file e2e/docs/capturas-iman.spec.ts
 * @description Capturas de la guía «Alojamiento de imán»: el panel abierto desde Insertar con la vista previa del
 * hueco sobre la cara superior de un cubo, y el cubo con dos huecos (arriba y en un costado) tras aplicar las restas.
 * Piezas creadas en la propia app, nunca modelos de terceros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, captura, clicMundo, cmd, sinAvisos } from './helpers';

type P3 = [number, number, number];

/** Punto de mundo (Y arriba) a píxel de la página. */
async function aPixel(page: Page, p: P3): Promise<{ x: number; y: number }> {
  return page.evaluate((pt) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const v = new cam.position.constructor(pt[0], pt[1], pt[2]).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, p);
}

async function camara(page: Page, pos: P3): Promise<void> {
  await page.evaluate((c) => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(c[0], c[1], c[2]);
    r.camera.lookAt(0, 15, 0);
    r.controls?.target?.set?.(0, 15, 0);
    r.controls?.update?.();
  }, pos);
  await page.waitForTimeout(400);
}

const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 15_000 }).toBeNull();

test('alojamiento de imán', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Tapa', position: [0, 0, 0], color: '#38bdf8' });
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await camara(page, [60, 70, 80]);

  // 1) Panel abierto desde Insertar, con la vista previa del hueco en la cara superior.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toBeVisible();
  await sinAvisos(page);
  const top = await aPixel(page, [0, 30, 0]);
  await page.mouse.move(top.x - 8, top.y - 8);
  await page.mouse.move(top.x, top.y, { steps: 4 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/guia/img/alojamiento-de-iman-01-panel.png' });

  // 2) Dos huecos (arriba y en el costado +X), restas aplicadas.
  await clicMundo(page, [0, 30, 0]);
  await libre(page);
  await camara(page, [110, 30, 20]);
  await clicMundo(page, [15, 15, 0]);
  await libre(page);
  await page.getByTestId('panel-back').click();
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    s.setSelection([]);
    await s.applyHolesOnSolids();
  });
  await libre(page);
  await camara(page, [55, 60, 45]);
  await captura(page, 'alojamiento-de-iman-02-resultado');
});
