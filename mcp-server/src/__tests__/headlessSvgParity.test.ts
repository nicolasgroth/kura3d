/**
 * @file mcp-server/src/__tests__/headlessSvgParity.test.ts
 * @description El MCP sin interfaz (Node, sin DOM) lee el SVG con la misma semántica que la app:
 * `<g transform>`, `<defs>/<use>`, trazos `fill="none"` y agujeros dan la misma pieza que el SVG
 * aplanado, tanto al importar como al proyectar sobre una superficie.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import * as engine from '../../../src/engine/index';
import { COMPLEX_SVG, FLAT_SVG } from '../../../src/engine/__tests__/svgParityFixtures';
import { KuraHeadlessEngine } from '../headlessEngine.js';

function stats(h: KuraHeadlessEngine, id: string) {
  const obj = h.getObject(id);
  return engine.computeMeshStats(engine.applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale));
}

describe('MCP sin interfaz: misma lectura de SVG que la app', () => {
  it('importar el SVG complejo equivale al aplanado y al motor directo', async () => {
    const h = new KuraHeadlessEngine();
    const complex = await h.importSvg({ svgContent: COMPLEX_SVG, depth: 2, targetWidth: 60, curveSegments: 12 });
    const flat = await h.importSvg({ svgContent: FLAT_SVG, depth: 2, targetWidth: 60, curveSegments: 12 });
    const direct = engine.computeMeshStats(
      await engine.extrudeSvgToMesh({ svgContent: COMPLEX_SVG, name: 'd', depth: 2, targetWidth: 60, curveSegments: 12 })
    );
    const sc = stats(h, complex.id);
    const sf = stats(h, flat.id);
    expect(sc.isManifold).toBe(true);
    expect(sc.volumeMm3).toBeCloseTo(2600, 1);
    expect(sc.volumeMm3).toBeCloseTo(sf.volumeMm3, 3);
    expect(sc.volumeMm3).toBeCloseTo(direct.volumeMm3, 3);
    expect(sc.dimensionsMm[0]).toBeCloseTo(60, 3);
  });

  it('proyectar el SVG complejo equivale a proyectar el aplanado', async () => {
    const results: number[] = [];
    for (const svgContent of [COMPLEX_SVG, FLAT_SVG]) {
      const h = new KuraHeadlessEngine();
      const box = await h.createPrimitive({ primitiveType: 'box', params: { width: 80, height: 80, depth: 80 } });
      await h.projectOnSurface(box.id, {
        kind: 'svg', svgContent, mode: 'emboss', axis: '+y', widthMm: 40, depthMm: 1, colorHex: '#f97316',
      });
      const s = stats(h, box.id);
      expect(s.isManifold).toBe(true);
      results.push(s.volumeMm3);
    }
    expect(results[0]).toBeCloseTo(results[1], 1);
  });
});
