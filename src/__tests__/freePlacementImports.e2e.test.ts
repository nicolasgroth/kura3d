/**
 * @file src/__tests__/freePlacementImports.e2e.test.ts
 * @description Litofanía/cortador desde imagen, SVG y molde nacen en espacio libre, sin solapar
 * la pieza que ya estaba en la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { footprintOf, sceneFootprints } from '../core/scene/freeSpot';
import { useKuraStore } from '../store/useKuraStore';
import type { SceneObject } from '../types/kura';

const fp = (o: SceneObject) => footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
const overlap = (a: ReturnType<typeof fp>, b: ReturnType<typeof fp>) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe('colocación libre de imágenes, SVG y moldes', () => {
  beforeEach(() => {
    useKuraStore.setState({ objects: [], selectedIds: [] });
  });

  it('el relieve desde imagen no se apila sobre una pieza existente', async () => {
    const cube = await useKuraStore.getState().createPrimitive('box', { width: 30, height: 30, depth: 30 });
    const w = 8;
    const rgba = new Uint8ClampedArray(w * w * 4).fill(200);
    const relief = await useKuraStore.getState().generateImageRelief({
      name: 'R', rgba, pixelWidth: w, pixelHeight: w, widthMm: 40, depthMm: 40,
      baseThicknessMm: 1, reliefHeightMm: 2, invert: false, smoothing: 0,
    });
    expect(relief).not.toBeNull();
    expect(overlap(fp(relief!), fp(cube!))).toBe(false);
    expect(sceneFootprints(useKuraStore.getState().objects)).toHaveLength(2);
  });

  it('las piezas del molde quedan juntas y fuera de la pieza original', async () => {
    const master = await useKuraStore.getState().createPrimitive('cylinder', { radius: 10, height: 20, segments: 24 });
    const parts = await useKuraStore.getState().generateMoldForObject(master!.id, {
      mode: 'direct_2part', wallMarginMm: 5, boxWallMm: 3, splitAxis: 'x', pourSpout: false,
      pourSpoutRadiusMm: 4, keyToleranceMm: 0.25, cavityWallMm: 3,
    });
    expect(parts.length).toBeGreaterThan(1);
    const stored = useKuraStore.getState().objects.filter((o) => o.source === 'mold');
    expect(stored.length).toBe(parts.length);
    for (const p of stored) expect(overlap(fp(p), fp(master!))).toBe(false);
  });
});
