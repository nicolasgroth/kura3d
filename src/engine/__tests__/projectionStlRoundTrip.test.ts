/**
 * @file src/engine/__tests__/projectionStlRoundTrip.test.ts
 * @description QA ronda 5: relieve, grabado e incrustación de texto con tildes y de un SVG con
 * agujeros sobre esfera, cilindro, toro, cono y esfera ahuecada, con ida y vuelta REAL por STL binario
 * (exportar, releer, soldar por posición): 0 aristas no pareadas, malla manifold y volumen coherente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SurfaceProjectionMode, SurfaceProjectionOptions } from '../../types/kura';
import { hollowMeshDetailed } from '../hollow';
import { readSTL } from '../io/stl';
import { exportMeshToBinarySTL } from '../io/stl';
import { countUnpairedEdges } from '../meshClosure';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';

/** Marco con dos agujeros (evenodd) y un anillo suelto: obliga a respetar los huecos. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path fill-rule="evenodd" d="M5 5 H95 V60 H5 Z M20 15 H45 V50 H20 Z M55 15 H80 V50 H55 Z"/>
  <path fill-rule="evenodd" d="M50 90 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 M50 90 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0"/>
</svg>`;

const TARGETS: Array<[string, () => Promise<MeshData>, number]> = [
  ['esfera', () => createPrimitiveMesh('sphere', { radius: 25, segments: 64 }), 16],
  ['cilindro', () => createPrimitiveMesh('cylinder', { radius: 18, height: 45, segments: 64 }), 16],
  ['toro', () => createPrimitiveMesh('torus', { outerRadius: 28, tubeRadius: 10, segments: 64 }), 8],
  ['cono', () => createPrimitiveMesh('cone', { radius: 25, height: 50, segments: 64 }), 12],
  [
    'esfera hueca',
    async () => {
      const s = makeObject('s', await createPrimitiveMesh('sphere', { radius: 25, segments: 64 }));
      return (await hollowMeshDetailed(s, { enabled: true, wallThickness: 3 })).mesh;
    },
    14,
  ],
];
const MODES: SurfaceProjectionMode[] = ['emboss', 'deboss', 'flush_inlay'];

describe('proyección sobre curvas con ida y vuelta por STL', () => {
  for (const [name, make, width] of TARGETS) {
    for (const kind of ['text', 'svg'] as const) {
      for (const mode of MODES) {
        it(`${kind} ${mode} sobre ${name}`, async () => {
          const opts: SurfaceProjectionOptions = {
            kind, mode, axis: '+z', widthMm: width, depthMm: 0.8, colorHex: '#22c55e',
            text: kind === 'text' ? 'Ñandú Ésa' : undefined,
            svgContent: kind === 'svg' ? SVG : undefined,
          };
          const base = await make();
          const target = makeObject('t', base, { position: [0, 0, 0] });
          let mesh: MeshData | undefined;
          try {
            mesh = (await projectGraphicOntoSurface(target, opts)).mesh;
          } catch (e) {
            // Un error tipado es aceptable solo si dice por qué; lo registramos para el informe.
            console.info(`QA5-PROJ ${kind} ${mode} ${name}: error ${(e as { code?: string }).code ?? (e as Error).message}`);
            throw e;
          }
          const back = readSTL(exportMeshToBinarySTL(mesh).buffer as ArrayBuffer).parts[0].mesh;
          const unpaired = countUnpairedEdges(back);
          const stats = computeMeshStats(back);
          const v0 = computeMeshStats(base).volumeMm3;
          console.info(`QA5-PROJ ${kind} ${mode} ${name}: unpaired=${unpaired} manifold=${stats.isManifold} dV=${(stats.volumeMm3 - v0).toFixed(1)}`);
          expect(unpaired).toBe(0);
          expect(stats.isManifold).toBe(true);
          if (mode === 'emboss') expect(stats.volumeMm3).toBeGreaterThan(v0);
          if (mode === 'deboss') expect(stats.volumeMm3).toBeLessThan(v0);
        }, 60_000);
      }
    }
  }
});
