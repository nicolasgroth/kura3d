/**
 * @file src/engine/__tests__/closedMeshesAudit.test.ts
 * @description Auditoría de mallas limpias en operaciones que combinan sólidos que se tocan:
 * relieve desde imagen, molde de dos partes con llaves, corte con conectores y texto 3D. Cada pieza
 * resultante debe tener 0 aristas no pareadas tras soldar vértices a 1e-7 mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MoldOptions } from '../../types/kura';
import { generateReliefFromImage } from '../advancedGeometry';
import { countUnpairedEdges } from '../meshClosure';
import { generateMold } from '../molds';
import { planeCutWithConnectors } from '../operations';
import { createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';

const WELD = 1e-7;

describe('auditoría de aristas no pareadas (soldadura 1e-7 mm)', () => {
  it('relieve desde imagen', () => {
    const w = 32;
    const rgba = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < w * w; i++) {
      const v = (i % w) * 8;
      rgba.set([v, v, v, 255], i * 4);
    }
    const relief = generateReliefFromImage({
      name: 'r', rgba, pixelWidth: w, pixelHeight: w, widthMm: 40, depthMm: 40,
      baseThicknessMm: 2, reliefHeightMm: 3, invert: false, smoothing: 0,
    });
    expect(countUnpairedEdges(relief, WELD)).toBe(0);
  });

  it('molde de dos partes con llaves', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 12, segments: 32 });
    const opts: MoldOptions = {
      mode: 'direct_2part', wallMarginMm: 5, boxWallMm: 3, splitAxis: 'x', pourSpout: true,
      pourSpoutRadiusMm: 3, keyToleranceMm: 0.25, cavityWallMm: 2,
    };
    const parts = await generateMold(makeObject('m', sphere), opts);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    for (const p of parts) expect(countUnpairedEdges(p.mesh, WELD)).toBe(0);
  }, 30_000);

  it('corte con conectores (peg)', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    const res = await planeCutWithConnectors(makeObject('b', box), {
      axis: 'y', offset: 0, connectorType: 'peg', connectorSize: 3, connectorDepth: 5,
      tolerance: 0.25, connectorCount: 2, keepMode: 'both',
    });
    const meshes = [res.positive?.mesh, res.negative?.mesh].filter((m) => m !== undefined);
    expect(meshes.length).toBe(2);
    for (const m of meshes) expect(countUnpairedEdges(m, WELD)).toBe(0);
  });

  it('texto 3D', async () => {
    const text = await createPrimitiveMesh('text', { text: 'KURA 8', fontSize: 12, depth: 3 });
    expect(countUnpairedEdges(text, WELD)).toBe(0);
  });
});
