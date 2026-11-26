/**
 * @file e2e/reales-ui-dividir.spec.ts
 * @description Vista previa de Dividir: con un plan de 8 celdas de las que solo 6 tienen material
 * (`plan.occupancy.cells`), el visor rotula 6 piezas, no 8. Usa un plan sintético en el store.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-dividir`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test('los rótulos de la vista previa son las piezas reales (celdas ocupadas), no todas las celdas', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    const s = (window as any).__s;
    const pieces: any[] = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const min = [i * 60 - 60, j * 60, k * 60 - 60];
      pieces.push({
        code: `${'AB'[i]}${j + 1}${'ab'[k]}`, cell: [i, j, k], bounds: { min, max: [min[0] + 60, min[1] + 60, min[2] + 60] },
        sizeMm: [60, 60, 60], rotated: false, printRotation: [0, 0, 0], diagonal: false, bedMarginMm: 5,
      });
    }
    const cells = pieces.filter((p) => !(p.cell[1] === 1 && p.cell[2] === 1)).map((p) => p.cell);
    s.setState({
      splitLabels: true,
      splitPlanPreview: {
        ...s.getState().splitPlanPreview,
        status: 'ready',
        plan: {
          bounds: { min: [-60, 0, -60], max: [60, 120, 60] }, usableMm: [200, 200, 200], counts: { x: 2, y: 2, z: 2 },
          planes: [], pieces, fitsWithoutCuts: false, connector: null, elapsedMs: 1,
          occupancy: { exact: true, cells, pieces: 6, joints: 7, jointsPerPlane: [], pieceSizesMm: [] },
        },
      },
    });
  });
  const tags = page.locator('[data-testid="split-label-layer"] .kura-split-piece-tag');
  await expect(tags).toHaveCount(6);
  const texts = await tags.allTextContents();
  expect(texts.join(' ')).not.toMatch(/A2b|B2b/);
});
