/**
 * @file src/engine/__tests__/wasmLeaksOnError.test.ts
 * @description Caminos de error sin fugas WASM: si una operación intermedia de Manifold lanza,
 * los objetos ya creados se liberan. Cubre el ámbito `wasmScope.ts`, el offset interior
 * (`solidOffset.ts`) y la comprobación de llenado del molde (`moldChannels.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { countSealedVoids } from '../moldChannels';
import { convexInwardOffset, distanceFieldOfManifold, inwardOffset } from '../solidOffset';
import { deleteOnThrow, useThenDelete, withWasmScope, WasmScope } from '../wasmScope';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Espía `delete` del prototipo de Manifold y devuelve los objetos liberados. */
function trackDeletes(proto: { delete(): void }): Set<unknown> {
  const deleted = new Set<unknown>();
  const original = proto.delete;
  vi.spyOn(proto, 'delete').mockImplementation(function (this: unknown) {
    deleted.add(this);
    original.call(this);
  });
  return deleted;
}

describe('wasmScope', () => {
  it('libera en orden inverso, también si la función lanza, salvo lo que se conserva', () => {
    const order: string[] = [];
    const handle = (name: string) => ({ delete: () => order.push(name) });
    const kept = handle('kept');
    const result = withWasmScope((scope) => {
      scope.track(handle('a'));
      scope.trackAll([handle('b'), handle('c')]);
      return scope.keep(scope.track(kept));
    });
    expect(result).toBe(kept);
    expect(order).toEqual(['c', 'b', 'a']);

    order.length = 0;
    expect(() => withWasmScope((scope) => {
      scope.track(handle('x'));
      throw new Error('falla');
    })).toThrow('falla');
    expect(order).toEqual(['x']);
  });

  it('useThenDelete siempre libera; deleteOnThrow solo al fallar', () => {
    const h = { delete: vi.fn() };
    expect(useThenDelete(h, () => 1)).toBe(1);
    expect(h.delete).toHaveBeenCalledTimes(1);
    expect(deleteOnThrow(h, () => 2)).toBe(2);
    expect(h.delete).toHaveBeenCalledTimes(1);
    expect(() => deleteOnThrow(h, () => { throw new Error('x'); })).toThrow('x');
    expect(h.delete).toHaveBeenCalledTimes(2);
  });

  it('un delete que falla no impide liberar el resto', () => {
    const scope = new WasmScope();
    const ok = { delete: vi.fn() };
    scope.track(ok);
    scope.track({ delete: () => { throw new Error('ya liberado'); } });
    expect(() => scope.dispose()).not.toThrow();
    expect(ok.delete).toHaveBeenCalledTimes(1);
  });
});

describe('Sin fugas WASM cuando Manifold lanza a mitad de camino', () => {
  it('offset convexo: si trimByPlane lanza, la caja intermedia se libera', async () => {
    const wasm = await initManifoldEngine();
    const solid = wasm.Manifold.cube([10, 10, 10], true);
    const proto = Object.getPrototypeOf(solid) as Manifold;
    const deleted = trackDeletes(proto);
    let pending: unknown = null;
    vi.spyOn(proto, 'trimByPlane').mockImplementation(function (this: unknown) {
      pending = this;
      throw new Error('trim falla');
    });
    try {
      expect(() => convexInwardOffset(wasm, solid, 1)).toThrow('trim falla');
      expect(pending).not.toBeNull();
      expect(deleted.has(pending)).toBe(true);
    } finally {
      vi.restoreAllMocks();
      solid.delete();
    }
  });

  it('offset por level-set: si medir la pared lanza, la cavidad recién extraída se libera', async () => {
    const wasm = await initManifoldEngine();
    // Un toro no es convexo: obliga a la vía de level-set y a medir la pared.
    const big = wasm.Manifold.cylinder(6, 12, 12, 32, true);
    const hole = wasm.Manifold.cylinder(8, 5, 5, 32, true);
    const solid = big.subtract(hole);
    big.delete();
    hole.delete();
    const field = distanceFieldOfManifold(solid);
    // `signMode: 'winding'` salta la comprobación previa de signo (que también usa `signedDistance`):
    // así el fallo llega al medir la pared, después de extraer la cavidad.
    const failing = Object.create(field, {
      signedDistance: { value: () => { throw new Error('sdf falla'); } },
      signMode: { value: 'winding' },
    });
    const proto = Object.getPrototypeOf(solid) as Manifold;
    const deleted = trackDeletes(proto);
    const extracted: unknown[] = [];
    const simplify = proto.simplify;
    vi.spyOn(proto, 'simplify').mockImplementation(function (this: Manifold, tol?: number) {
      const out = simplify.call(this, tol);
      extracted.push(out);
      return out;
    });
    try {
      expect(() => inwardOffset(wasm, solid, 1.5, 20_000, failing)).toThrow('sdf falla');
      expect(extracted.length).toBeGreaterThan(0);
      for (const m of extracted) expect(deleted.has(m)).toBe(true);
    } finally {
      vi.restoreAllMocks();
      solid.delete();
    }
  });

  it('cavidades selladas del molde: si decompose lanza, la caja y el aire se liberan', async () => {
    const wasm = await initManifoldEngine();
    const mold = wasm.Manifold.cube([10, 10, 10], false);
    const proto = Object.getPrototypeOf(mold) as Manifold;
    const deleted = trackDeletes(proto);
    let air: unknown = null;
    vi.spyOn(proto, 'decompose').mockImplementation(function (this: unknown) {
      air = this;
      throw new Error('decompose falla');
    });
    try {
      expect(() => countSealedVoids(wasm, mold, { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 })).toThrow(
        'decompose falla'
      );
      expect(air).not.toBeNull();
      expect(deleted.has(air)).toBe(true);
      // cube + translate + subtract = 3 temporales liberados (además de ninguno del molde)
      expect(deleted.has(mold)).toBe(false);
      expect(deleted.size).toBe(3);
    } finally {
      vi.restoreAllMocks();
      mold.delete();
    }
  });
});
