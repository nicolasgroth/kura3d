/**
 * @file src/engine/__tests__/projectionCurvedClosure.test.ts
 * @description Proyección sobre superficies curvas: relieve, grabado e incrustación de texto y de
 * SVG sobre esfera, cilindro y toro deben dejar 0 aristas no pareadas (soldando por posición como
 * lo hace un STL) y una malla manifold, o un error tipado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SurfaceProjectionMode, SurfaceProjectionOptions } from '../../types/kura';
import { countUnpairedEdges } from '../meshClosure';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10 10 H90 V90 H10 Z M30 30 V70 H70 V30 Z"/>
  <circle cx="50" cy="50" r="12"/>
</svg>`;

const TARGETS: Array<[string, () => Promise<MeshData>, number]> = [
  ['esfera', () => createPrimitiveMesh('sphere', { radius: 20, segments: 64 }), 14],
  ['cilindro', () => createPrimitiveMesh('cylinder', { radius: 15, height: 40, segments: 64 }), 14],
  ['toro', () => createPrimitiveMesh('torus', { outerRadius: 25, tubeRadius: 8, segments: 64 }), 8],
];
const MODES: SurfaceProjectionMode[] = ['emboss', 'deboss', 'flush_inlay'];

describe('proyección sobre superficies curvas: cierre de la malla', () => {
  for (const [name, make, width] of TARGETS) {
    for (const kind of ['text', 'svg'] as const) {
      for (const mode of MODES) {
        it(`${kind} ${mode} sobre ${name}: 0 aristas no pareadas`, async () => {
          const opts: SurfaceProjectionOptions = {
            kind, mode, axis: '+z', widthMm: width, depthMm: 0.8, colorHex: '#f97316',
            text: kind === 'text' ? 'KU' : undefined,
            svgContent: kind === 'svg' ? SVG : undefined,
          };
          const target = makeObject('t', await make(), { position: [0, 0, 0] });
          // Todos estos casos caben en la pieza: deben producir malla (no basta un error tipado).
          const { mesh } = await projectGraphicOntoSurface(target, opts);
          expect(countUnpairedEdges(mesh)).toBe(0);
          expect(computeMeshStats(mesh).isManifold).toBe(true);
          expect(mesh.faceColors?.some((c) => c === '#f97316')).toBe(true);
        }, 60_000);
      }
    }
  }
});
