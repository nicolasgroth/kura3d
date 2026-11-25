/**
 * @file src/engine/split/__tests__/splitMagnetRays.test.ts
 * @description Imanes en uniones: la escalera de cantidades arma las mallas de rayos de las dos piezas una sola vez
 * por unión (no una copia de la malla por peldaño), y el resultado no cambia: con poco material bajo el alojamiento,
 * ningún peldaño cabe y se avisa SPLIT_MAGNET_NO_ROOM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold } from 'manifold-3d';
import { describe, expect, it } from 'vitest';
import type { EngineWarning } from '../../engineErrors';
import { placeMagnets } from '../splitMagnet';
import type { SplitConnectorOptions } from '../splitTypes';

/**
 * Pieza simulada: un triángulo grande a 1 mm del plano de corte (poco material bajo el alojamiento: ningún
 * peldaño cabe). Cuenta cuántas veces se copia su malla.
 */
function thinPiece(z: number) {
  const piece = { calls: 0, m: {} as Manifold };
  const vertProperties = new Float32Array([-100, -100, z, 100, -100, z, 0, 100, z]);
  piece.m = { getMesh: () => { piece.calls++; return { vertProperties, numProp: 3, triVerts: new Uint32Array([0, 1, 2]) }; } } as unknown as Manifold;
  return piece;
}

const island = { area: () => 400, offset: () => ({ isEmpty: () => false, delete: () => undefined }) } as unknown as CrossSection;

describe('placeMagnets', () => {
  it('mallas de rayos una vez por unión, aunque se prueben varios peldaños', () => {
    const low = thinPiece(-1), high = thinPiece(1);
    const c = { type: 'dowel', size: 3, depth: 3, tolerance: 0.1, count: 4, magnet: { shape: 'round', sizeMm: 6, heightMm: 3, clearanceMm: 0.2, depthClearanceMm: 0, hidden: false } } as SplitConnectorOptions;
    const warnings: EngineWarning[] = [];
    let tried = 0;
    const res = placeMagnets(
      { low: { m: low.m }, high: { m: high.m }, axis: 'z' }, [island], c,
      (rung) => { tried++; return { centers: Array.from({ length: rung.count }, () => [0, 0, 0] as [number, number, number]), caps: [] }; },
      () => undefined, warnings, { label: 'u', a: 'A', b: 'B' },
    );
    expect(tried).toBe(4);
    expect(low.calls).toBe(1);
    expect(high.calls).toBe(1);
    expect(res.used).toBeNull();
    expect(warnings.map((w) => w.code)).toEqual(['SPLIT_MAGNET_NO_ROOM']);
  });
});
