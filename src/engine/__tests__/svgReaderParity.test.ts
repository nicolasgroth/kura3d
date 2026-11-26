/**
 * @file src/engine/__tests__/svgReaderParity.test.ts
 * @description Una sola semántica SVG en todos los caminos: un SVG con `<g transform>`,
 * `<defs>/<use>`, un trazo `fill="none"` y un agujero da los mismos contornos haya o no
 * `DOMParser` en el entorno (hilo principal frente a Worker/Node), y la misma pieza al
 * importarlo (contornos leídos aparte) y al proyectarlo sobre una superficie.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { SurfaceProjectionOptions, SvgImportOptions } from '../../types/kura';
import { extractSvgElementGroups, extrudeSvgToMesh } from '../advancedGeometry';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';
import { COMPLEX_SVG, FLAT_SVG, groupsArea, groupsBounds } from './svgParityFixtures';

const IMPORT: SvgImportOptions = { svgContent: COMPLEX_SVG, name: 'p', depth: 2, targetWidth: 60, curveSegments: 12 };

const globalScope = globalThis as { DOMParser?: unknown };
const originalDomParser = globalScope.DOMParser;

afterEach(() => {
  if (originalDomParser === undefined) delete globalScope.DOMParser;
  else globalScope.DOMParser = originalDomParser;
});

describe('Lector SVG único (importación, proyección y MCP sin interfaz)', () => {
  it('aplica transform de <g>, resuelve <use> de <defs>, ignora fill="none" y conserva el agujero', () => {
    const groups = extractSvgElementGroups(COMPLEX_SVG, 12);
    expect(groups).toHaveLength(2);
    const [minX, minY, maxX, maxY] = groupsBounds(groups);
    expect(minX).toBeCloseTo(20, 6);
    expect(maxX).toBeCloseTo(80, 6);
    expect(minY).toBeCloseTo(-40, 6);
    expect(maxY).toBeCloseTo(0, 6);
    // 40×40 − 20×20 (agujero) + 10×10 (use)
    expect(groupsArea(groups)).toBeCloseTo(1300, 6);
  });

  it('da los mismos contornos con y sin DOMParser del entorno (hilo principal frente a Worker/Node)', () => {
    delete globalScope.DOMParser;
    const withoutDom = extractSvgElementGroups(COMPLEX_SVG, 12);
    globalScope.DOMParser = class {
      parseFromString(): never {
        throw new Error('el lector no debe depender del DOMParser del entorno');
      }
    };
    const withDom = extractSvgElementGroups(COMPLEX_SVG, 12);
    expect(withDom).toEqual(withoutDom);
    expect(globalScope.DOMParser).toBeDefined();
  });

  it('respeta fill="none" dado por <style> con clase y por style en línea', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>/* c */ .hueco, .otro { fill: none; }</style>
      <rect class="hueco" width="50" height="50"/><rect style="stroke:#000; fill:none" width="50" height="50"/>
      <rect x="60" width="10" height="10" style="fill:#123"/></svg>`;
    const groups = extractSvgElementGroups(svg, 12);
    expect(groups).toHaveLength(1);
    expect(groupsBounds(groups)).toEqual([60, -10, 70, -0]);
  });

  it('XML mal formado no deja contornos y la extrusión lanza SVG_NO_CONTOURS', async () => {
    expect(extractSvgElementGroups('<svg><g><rect width="1" height="1"></svg>', 12)).toEqual([]);
    await expect(extrudeSvgToMesh({ ...IMPORT, svgContent: '<svg><g></svg>' })).rejects.toMatchObject({ code: 'SVG_NO_CONTOURS' });
  });

  it('importar con contornos ya leídos y sin ellos produce la misma pieza que el SVG aplanado', async () => {
    const preParsed = await extrudeSvgToMesh(IMPORT, extractSvgElementGroups(COMPLEX_SVG, 12));
    const direct = await extrudeSvgToMesh(IMPORT);
    const flat = await extrudeSvgToMesh({ ...IMPORT, svgContent: FLAT_SVG });
    const [a, b, c] = [preParsed, direct, flat].map(computeMeshStats);
    for (const s of [a, b, c]) expect(s.isManifold).toBe(true);
    expect(a.volumeMm3).toBeCloseTo(c.volumeMm3, 3);
    expect(b.volumeMm3).toBeCloseTo(c.volumeMm3, 3);
    // 1300 mm² a escala 60/60 por 2 mm de profundidad
    expect(c.volumeMm3).toBeCloseTo(2600, 1);
    expect(a.dimensionsMm[0]).toBeCloseTo(60, 3);
    expect(b.dimensionsMm).toEqual(c.dimensionsMm);
  });

  it('la proyección sobre superficie lee el SVG igual que la importación', async () => {
    const box = await createPrimitiveMesh('box', { width: 80, height: 20, depth: 80 });
    const opts: SurfaceProjectionOptions = {
      kind: 'svg', svgContent: COMPLEX_SVG, mode: 'emboss', axis: '+y', widthMm: 40, depthMm: 1, colorHex: '#f97316',
    };
    const complex = await projectGraphicOntoSurface(makeObject('b', box), opts);
    const flat = await projectGraphicOntoSurface(makeObject('b', box), { ...opts, svgContent: FLAT_SVG });
    const sc = computeMeshStats(complex.mesh);
    const sf = computeMeshStats(flat.mesh);
    expect(sc.isManifold).toBe(true);
    expect(sc.volumeMm3).toBeCloseTo(sf.volumeMm3, 1);
    expect(sc.dimensionsMm[0]).toBeCloseTo(sf.dimensionsMm[0], 3);
    expect(sc.dimensionsMm[2]).toBeCloseTo(sf.dimensionsMm[2], 3);
  });
});
