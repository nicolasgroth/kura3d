/**
 * @file e2e/docs/capturas-paso-cable.spec.ts
 * @description Capturas de la guía «Paso de cable»: el panel abierto desde Insertar con la vista previa sobre la pared
 * de una placa, y la placa con un paso redondo y una ranura tras aplicar las restas. Piezas creadas en la propia app.
 * Escrito sin ejecutar en este lote; lo corre el orquestador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, captura, clicMundo, cmd, sinAvisos } from './helpers';

type P3 = [number, number, number];

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
    r.camera.lookAt(0, 30, 0);
    r.controls?.target?.set?.(0, 30, 0);
    r.controls?.update?.();
  }, pos);
  await page.waitForTimeout(400);
}

const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 15_000 }).toBeNull();

test('paso de cable', async ({ page }) => {
  await abrir(page);
  // Placa de 60 × 60 × 4: la cara +Z (z = 2) es la pared.
  await cmd(page, 'create_primitive', { type: 'box', width: 60, height: 60, depth: 4, name: 'Placa', position: [0, 0, 0], color: '#38bdf8' });
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await camara(page, [45, 55, 110]);

  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Paso de cable/ }).click();
  await expect(page.locator('.kura-cable-panel')).toBeVisible();
  await sinAvisos(page);
  const p = await aPixel(page, [-15, 30, 2]);
  await page.mouse.move(p.x - 8, p.y - 8);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/guia/img/paso-de-cable-01-panel.png' });

  await clicMundo(page, [-15, 30, 2]);
  await libre(page);
  await page.getByTestId('cable-shape-slot').click();
  await clicMundo(page, [15, 30, 2]);
  await libre(page);
  await page.getByTestId('cable-done').click();
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    s.setSelection([]);
    await s.applyHolesOnSolids();
  });
  await libre(page);
  await camara(page, [30, 45, 95]);
  await captura(page, 'paso-de-cable-02-resultado');
});
