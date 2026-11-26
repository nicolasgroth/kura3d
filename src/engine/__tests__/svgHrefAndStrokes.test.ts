/**
 * @file src/engine/__tests__/svgHrefAndStrokes.test.ts
 * @description SVG 2: `<use href="#id">` (sin `xlink:`) se resuelve igual que `xlink:href`; un SVG
 * que solo tiene trazos sin relleno da un error propio (`SVG_STROKES_ONLY`) con un mensaje que dice
 * qué hacer, en vez del genérico "no se encontraron contornos".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { extractSvgElementGroups, extrudeSvgToMesh } from '../advancedGeometry';
import { isEngineError, localizeEngineError } from '../engineErrors';
import { initManifoldEngine } from '../manifoldKernel';

const USE_SVG2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><rect id="sq" width="10" height="10"/></defs>
  <use href="#sq" x="20" y="30"/>
</svg>`;

const STROKES_ONLY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10 10 L90 10 L90 90" fill="none" stroke="#000" stroke-width="2"/>
  <line x1="0" y1="0" x2="50" y2="50" stroke="black"/>
</svg>`;

describe('SVG: href de SVG 2 y archivos solo de trazos', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('<use href="#id"> sin xlink da el contorno del elemento referido', () => {
    const groups = extractSvgElementGroups(USE_SVG2, 12);
    expect(groups).toHaveLength(1);
    const xs = groups[0][0].map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(20, 6);
    expect(Math.max(...xs)).toBeCloseTo(30, 6);
  });

  it('solo trazos sin relleno → SVG_STROKES_ONLY con mensaje específico', async () => {
    let error: unknown;
    try {
      await extrudeSvgToMesh({ svgContent: STROKES_ONLY, name: 's', depth: 2, targetWidth: 20, curveSegments: 12 });
    } catch (err) {
      error = err;
    }
    expect(isEngineError(error) && error.code).toBe('SVG_STROKES_ONLY');
    expect(localizeEngineError('es', error as never)).toMatch(/solo tiene líneas sin relleno/);
  });

  it('un SVG vacío sigue dando SVG_NO_CONTOURS', async () => {
    await expect(
      extrudeSvgToMesh({ svgContent: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', name: 'e', depth: 2, targetWidth: 20, curveSegments: 12 }),
    ).rejects.toSatisfy((err: unknown) => isEngineError(err) && err.code === 'SVG_NO_CONTOURS');
  });
});
