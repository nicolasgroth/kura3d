/**
 * @file e2e/gen-ui-colocacion.spec.ts
 * @description Texto 3D, SVG, imagen→3D, rosca y molde caen en un hueco libre sin solaparse con otros objetos
 * y quedan dentro del visor (mismo camino de colocación y encuadre que las primitivas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, cajas, solapes } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';

for (const gen of ['texto', 'svg', 'imagen', 'rosca', 'molde'] as const) {
  test(`${gen}: no se solapa con la caja`, async ({ page }) => {
    await abrir(page);
    await page.evaluate(async () => {
      const s = (window as any).__s.getState();
      await s.createPrimitive('box', { width: 40, height: 40, depth: 40 }, { placement: 'free' });
    });
    const antes = (await cajas(page)).length;
    await page.evaluate(
      async ({ g, svg }) => {
        const s = (window as any).__s.getState();
        if (g === 'texto') await s.createPrimitive('text', { text: 'HOLA', fontSize: 18, height: 6 }, { placement: 'free' });
        if (g === 'svg') await s.importSvgModel({ svgContent: svg, name: 'c', depth: 5, targetWidth: 40, curveSegments: 12 });
        if (g === 'imagen') {
          const w = 32;
          const h = 32;
          const rgba = new Uint8ClampedArray(w * h * 4).fill(200);
          await s.generateImageRelief({ name: 'r', rgba, pixelWidth: w, pixelHeight: h, widthMm: 50, depthMm: 50, baseThicknessMm: 1.2, reliefHeightMm: 3, invert: false, smoothing: 1, shapeMode: 'flat', cylinderRadiusMm: 42, arcDegrees: 180, threshold: 128, cutterWallMm: 1.4 });
        }
        if (g === 'rosca') await s.createThreadObject({ kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20, clearanceMm: 0.2, includeHead: true });
        if (g === 'molde') {
          const id = s.objects[0].id;
          await s.generateMoldForObject(id, { mode: 'silicone_master', wallMarginMm: 6, boxWallMm: 3, splitAxis: 'x', pourSpout: true, pourSpoutRadiusMm: 5, keyToleranceMm: 0.25, cavityWallMm: 3 });
        }
      },
      { g: gen, svg: SVG },
    );
    await page.waitForTimeout(800);
    const boxes = await cajas(page);
    expect(boxes.length).toBeGreaterThan(antes);
    const sol = solapes(boxes);
    expect(sol, sol.join(' | ')).toEqual([]);
  });
}
