/**
 * @file src/engine/__tests__/hollowSelfIntersecting.test.ts
 * @description Ahuecar una sola cáscara cerrada que se cruza a sí misma (prisma de un pentagrama: las
 * caras laterales atraviesan el interior y el pentágono central tiene número de vueltas 2), la causa real
 * de que un busto de terceros "reparado" (una cáscara, 325 k triángulos) diera una cavidad de 0,2 mm³ y
 * "Ahuecado aplicado" con el volumen intacto. El signo por pseudo-normales se contradice ahí; el campo debe
 * detectarlo y usar el número de vueltas, y el ahuecado debe quitar volumen coherente con la pared o fallar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { computeMeshStats } from '../index';
import { hollowMeshDetailed } from '../hollow';
import { assertHollowEffective, hollowMaxWallMm } from '../hollowVerify';
import { buildMeshDistanceField } from '../meshDistance';
import { countSignConflicts, consistentSignField } from '../distanceSignCheck';
import { estimateHollowWall } from '../solidOffset';
import { initManifoldEngine } from '../manifoldKernel';
import { makeObject } from './geometryTestUtils';

const R = 40; // radio de las puntas
const H = 30; // altura del prisma
const T = 2; // pared

/** Prisma de un pentagrama {5/2}: una cáscara manifold (tapas en abanico) que se autointerseca. */
function pentagramPrism(): MeshData {
  const star = [0, 2, 4, 1, 3].map((k) => {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
  const pos: number[] = [];
  for (const z of [0, H]) {
    pos.push(0, z, 0);
    for (const [x, y] of star) pos.push(x, z, y);
  }
  const idx: number[] = [];
  const top = 6; // centro de la tapa superior
  for (let i = 0; i < 5; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % 5);
    // Tapa inferior (normal −Y) y superior (+Y); y es la altura, el plano es XZ.
    idx.push(0, a, b);
    idx.push(top, top + b, top + a);
    // Lateral: quad (a, b, b', a') con normal saliente
    idx.push(a, top + a, top + b, a, top + b, b);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), normals: new Float32Array(pos.length) };
}

/** Área del pentagrama relleno (unión): 10 triángulos centro–punta–vértice interior. */
const rInner = (R * Math.cos((2 * Math.PI) / 5)) / Math.cos(Math.PI / 5);
const starArea = 5 * R * rInner * Math.sin(Math.PI / 5);
const starPerimeter = 10 * Math.hypot(R - rInner * Math.cos(Math.PI / 5), rInner * Math.sin(Math.PI / 5));
const unionVolume = starArea * H;

describe('ahuecar una cáscara autointersecada', () => {
  beforeAll(async () => {
    await initManifoldEngine();
  });

  it('el campo detecta el signo contradictorio y el número de vueltas lo corrige', () => {
    const field = buildMeshDistanceField(pentagramPrism());
    expect(countSignConflicts(field)).toBeGreaterThanOrEqual(2);
    const fixed = consistentSignField(field);
    expect(fixed.signMode).toBe('winding');
    expect(countSignConflicts(fixed.withSignMode('winding'))).toBeGreaterThanOrEqual(2); // la detección sigue viendo la malla
    // Centro del pentágono (número de vueltas 2): dentro en la unión
    expect(fixed.signedDistance(0, H / 2, 0)).toBeGreaterThan(0);
    expect(fixed.signedDistance(0, H / 2, R * 1.5)).toBeLessThan(0);
  });

  it('una malla sana no cambia de criterio (sin coste extra)', () => {
    const cube: MeshData = {
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10]),
      indices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
    };
    const field = buildMeshDistanceField(cube);
    expect(countSignConflicts(field)).toBe(0);
    expect(consistentSignField(field)).toBe(field);
  });

  it('quita la cavidad de la unión: volumen y pared coherentes con lo pedido', async () => {
    const res = await hollowMeshDetailed(makeObject('star', pentagramPrism()), { enabled: true, wallThickness: T });
    const after = computeMeshStats(res.mesh);
    // Las caras que cruzan el interior (lados del pentágono central) quedan como nervios de 2t: la
    // cavidad es la estrella erosionada menos esas bandas, con altura H − 2t.
    const internalLength = 5 * 2 * rInner * Math.sin(Math.PI / 5);
    const eroded = starArea - starPerimeter * T;
    const minCavity = (eroded - 2 * T * internalLength) * (H - 2 * T);
    expect(res.cavityVolumeMm3).toBeGreaterThan(0.95 * minCavity);
    expect(res.cavityVolumeMm3).toBeLessThan((eroded + 5 * T * T * 3.1) * (H - 2 * T));
    expect(res.wall.minMm).toBeGreaterThan(T * 0.98);
    expect(res.wall.meanMm).toBeLessThan(estimateHollowWall([2 * R, H, 2 * R], T).maxWallMm + 0.1);
    // El volumen final baja lo que mide la cavidad (respecto de la malla tal como se lee, con solapes)
    const before = computeMeshStats(pentagramPrism()).volumeMm3;
    expect(before - after.volumeMm3).toBeCloseTo(res.cavityVolumeMm3, -1);
    expect(after.volumeMm3).toBeLessThan(unionVolume);
    expect(res.warnings.map((w) => w.code)).toContain('HOLLOW_SELF_INTERSECTING');
  }, 60_000);
});

describe('verificación posterior del ahuecado', () => {
  const wall = (meanMm: number) => ({ minMm: meanMm - 0.1, maxMm: meanMm + 0.1, meanMm, samples: 10 });

  it('cavidad casi nula con pared lejísimos (caso del busto real) → HOLLOW_INEFFECTIVE', () => {
    expect(() =>
      assertHollowEffective({ thickness: 2.2, volumeBefore: 741934, volumeAfter: 741934, cavityVolume: 0.19, wall: wall(30), expectedMaxWallMm: 2.4 })
    ).toThrow(expect.objectContaining({ code: 'HOLLOW_INEFFECTIVE' }));
  });

  it('cavidad real que la resta no quitó (volumen igual) → HOLLOW_INEFFECTIVE', () => {
    expect(() =>
      assertHollowEffective({ thickness: 2.2, volumeBefore: 741934, volumeAfter: 741934, cavityVolume: 429658, wall: wall(2.7), expectedMaxWallMm: 2.4 })
    ).toThrow(expect.objectContaining({ code: 'HOLLOW_INEFFECTIVE' }));
  });

  it('ahuecado coherente pasa', () => {
    expect(() =>
      assertHollowEffective({ thickness: 2.2, volumeBefore: 741934, volumeAfter: 312276, cavityVolume: 429658, wall: wall(2.3), expectedMaxWallMm: 2.4 })
    ).not.toThrow();
  });

  it('la pared máxima del aviso es la misma cifra que muestra el panel', () => {
    const size = [180, 160, 220];
    expect(hollowMaxWallMm(size, 2.2)).toBe(Math.round(estimateHollowWall(size, 2.2).maxWallMm * 10) / 10);
  });
});
