/**
 * @file e2e/ux-cierre-pincel-primer-trazo.spec.ts
 * @description Pincel: el primer arrastre tras elegir Pintar sobre una malla importada ya pinta caras. El trazo
 * empieza sobre la cara superior comprobando que el puntero cae sobre el lienzo y no sobre una tarjeta flotante
 * del visor: un arrastre que empieza sobre el panel del pincel no pinta (así se explicó el "primer trazo perdido").
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { stlCubes } from './ux-escena-helpers';
import { abrir, aPixel } from './ux-movil-helpers';

for (const intento of [1, 2]) {
  test(`el primer arrastre con el pincel pinta caras (intento ${intento})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrir(page);
    await page.evaluate((texto) => {
      const dt = new DataTransfer();
      dt.items.add(new File([texto], 'cubo.stl'));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, stlCubes([[0, 0, 0]], 40));
    await page.waitForFunction(() => (window as any).__s.getState().objects.length === 1, null, { timeout: 60000 });
    await page.getByRole('button', { name: 'Pintar', exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('paint');
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
    // Un punto del cubo libre de tarjetas flotantes (el panel del pincel puede tapar parte del objeto
    // encuadrado): se prueban el centro de cada cara y se elige el primero que cae sobre el lienzo.
    const candidatos: Array<[number, number, number]> = [[0, 20, 20], [20, 20, 0], [0, 40, 0], [-20, 20, 0], [0, 20, -20]];
    let punto = { x: 0, y: 0 };
    await expect.poll(async () => {
      const previo = punto;
      punto = await aPixel(page, candidatos[0]);
      return Math.hypot(punto.x - previo.x, punto.y - previo.y) < 0.5;
    }).toBe(true);
    let sobreLienzo = false;
    for (const c of candidatos) {
      punto = await aPixel(page, c);
      sobreLienzo = (await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [punto.x, punto.y])) === 'CANVAS';
      if (sobreLienzo) break;
    }
    expect(sobreLienzo, 'algún punto del cubo debe caer sobre el lienzo').toBe(true);
    await page.mouse.move(punto.x - 8, punto.y);
    await page.mouse.down();
    await page.mouse.move(punto.x, punto.y, { steps: 4 });
    await page.mouse.move(punto.x + 8, punto.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => {
      const o = (window as any).__s.getState().objects[0];
      const base = String(o.color).toLowerCase();
      return (o.mesh.faceColors ?? []).filter((c: string) => c.toLowerCase() !== base).length;
    }), { message: 'el primer trazo debe pintar caras' }).toBeGreaterThan(0);
  });
}
