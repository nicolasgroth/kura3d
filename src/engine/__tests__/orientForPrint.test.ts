/**
 * @file src/engine/__tests__/orientForPrint.test.ts
 * @description «Orientar para imprimir» con geometría conocida: «T», «Γ», cubo con agujero pasante
 * horizontal, esfera (sin ganadora), cono (base abajo), placa delgada de canto (inestable) y la
 * transformación aplicada (apoyada en la cama, misma forma y volumen). Se verifican valores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { applyTransformToMesh, computeMeshStats, createPrimitiveMesh } from '..';
import { analyzeOrientations, planOrientTransform, type OrientAnalysis, type OrientCandidate } from '../orient';
import { box, cubeWithHole, gamma, input, tUpright } from './orientShapes';

const best = (a: OrientAnalysis) => a.candidates[0];
const current = (a: OrientAnalysis) => a.candidates.find((c) => c.id === a.currentId)!;
const downIs = (c: OrientCandidate, d: [number, number, number]) =>
  Math.abs(c.down[0] - d[0]) < 1e-3 && Math.abs(c.down[1] - d[1]) < 1e-3 && Math.abs(c.down[2] - d[2]) < 1e-3;

describe('analyzeOrientations: «T»', () => {
  const a = analyzeOrientations(input(tUpright()));

  it('de pie (travesaño arriba) necesita soporte: valores medidos', () => {
    const c = current(a);
    // Bajo los brazos del travesaño: 2 × 25 × 10 = 500 mm², columnas de 40 mm → 20 000 mm³.
    expect(c.measures.overhangAreaMm2).toBeCloseTo(500, 3);
    expect(c.measures.supportVolumeMm3).toBeGreaterThan(20_000 * 0.95);
    expect(c.measures.supportVolumeMm3).toBeLessThan(20_000 * 1.05);
    expect(c.measures.contactAreaMm2).toBeCloseTo(100, 3);
    expect(c.measures.heightMm).toBeCloseTo(50, 4);
    expect(c.reasons).toContainEqual({ key: 'current' });
  });

  it('acostada no necesita soporte y gana: base de 1000 mm², 10 mm de alto', () => {
    const b = best(a);
    expect(b.id).not.toBe(a.currentId);
    expect(downIs(b, [0, 0, -1]) || downIs(b, [0, 0, 1])).toBe(true);
    expect(b.measures.overhangAreaMm2).toBe(0);
    expect(b.measures.supportVolumeMm3).toBe(0);
    expect(b.measures.contactAreaMm2).toBeCloseTo(1000, 3);
    expect(b.measures.heightMm).toBeCloseTo(10, 4);
    expect(b.vsCurrent.supportVolumePct).toBe(-100);
    expect(b.vsCurrent.contactFactor).toBeCloseTo(10, 3);
    expect(b.reasons).toEqual(expect.arrayContaining([
      { key: 'noOverhangs' }, { key: 'supportVsCurrent', params: { percent: -100 } }, { key: 'baseVsCurrent', params: { factor: 10 } },
    ]));
    expect(a.currentIsBest).toBe(false);
    expect(a.allEquivalent).toBe(false);
  });

  it('la «T» invertida (travesaño en la cama) tampoco necesita soporte pero queda detrás de la acostada', () => {
    const inv = a.candidates.find((c) => downIs(c, [0, 1, 0]))!;
    expect(inv.measures.supportVolumeMm3).toBe(0);
    expect(inv.measures.contactAreaMm2).toBeCloseTo(600, 3);
    expect(inv.rank).toBeGreaterThan(best(a).rank);
    expect(inv.equivalentToBest).toBe(false);
  });

  it('candidatos deduplicados por dirección', () => {
    const dirs = a.candidates.map((c) => c.down);
    for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) {
      const dot = dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1] + dirs[i][2] * dirs[j][2];
      expect(dot).toBeLessThan(Math.cos((1 * Math.PI) / 180));
    }
  });
});

describe('analyzeOrientations: «Γ»', () => {
  it('el brazo en voladizo: 300 mm² y ~12 000 mm³; la mejor lo elimina', () => {
    const a = analyzeOrientations(input(gamma()));
    const c = current(a);
    expect(c.measures.overhangAreaMm2).toBeCloseTo(300, 3);
    expect(c.measures.supportVolumeMm3).toBeGreaterThan(12_000 * 0.95);
    expect(c.measures.supportVolumeMm3).toBeLessThan(12_000 * 1.05);
    expect(best(a).measures.supportVolumeMm3).toBe(0);
    expect(best(a).vsCurrent.supportVolumePct).toBe(-100);
  });
});

describe('analyzeOrientations: cubo con agujero pasante horizontal', () => {
  const a = analyzeOrientations(input(cubeWithHole()));

  it('horizontal: el techo del agujero (10 × 30) necesita ~3000 mm³ de soporte', () => {
    const c = current(a);
    expect(c.measures.overhangAreaMm2).toBeCloseTo(300, 3);
    expect(c.measures.supportVolumeMm3).toBeGreaterThan(3000 * 0.93);
    expect(c.measures.supportVolumeMm3).toBeLessThan(3000 * 1.07);
    expect(c.measures.contactAreaMm2).toBeCloseTo(900, 3);
  });

  it('gana con el agujero vertical: sin soporte, base 800 mm²; las dos bocas son equivalentes', () => {
    const b = best(a);
    expect(downIs(b, [0, 0, -1]) || downIs(b, [0, 0, 1])).toBe(true);
    expect(b.measures.supportVolumeMm3).toBe(0);
    expect(b.measures.contactAreaMm2).toBeCloseTo(800, 3);
    const eq = a.candidates.filter((c) => c.equivalentToBest);
    expect(eq).toHaveLength(2);
    expect(eq.every((c) => downIs(c, [0, 0, -1]) || downIs(c, [0, 0, 1]))).toBe(true);
  });
});

describe('analyzeOrientations: esfera', () => {
  it('todas equivalentes: no inventa una ganadora y la actual ya sirve', async () => {
    const mesh = await createPrimitiveMesh('sphere', { radius: 20, segments: 48 });
    const a = analyzeOrientations(input(mesh));
    expect(a.allEquivalent).toBe(true);
    expect(a.currentIsBest).toBe(true);
    expect(a.candidates.every((c) => c.equivalentToBest)).toBe(true);
    // Ningún apoyo del casco es estable (facetas diminutas): solo la actual y los ejes.
    expect(a.candidates.every((c) => c.source !== 'hull')).toBe(true);
    // Casquete inferior más allá de 45°: 2πr²(1 − cos 45°) ≈ 736 mm² (malla facetada: ±5 %).
    for (const c of a.candidates) {
      expect(c.measures.overhangAreaMm2).toBeGreaterThan(736 * 0.9);
      expect(c.measures.overhangAreaMm2).toBeLessThan(736 * 1.1);
      expect(c.measures.stable).toBe(false);
    }
  });
});

describe('analyzeOrientations: cono', () => {
  it('cono ancho (r 30, h 20) con la punta abajo: propone la base abajo', async () => {
    const mesh = await createPrimitiveMesh('cone', { radius: 30, height: 20, segments: 32 });
    // Girado 180° sobre X y apoyado: la punta toca la cama.
    const a = analyzeOrientations(input(mesh, [0, 20, 0], [Math.PI, 0, 0]));
    const c = current(a);
    expect(c.measures.stable).toBe(false);
    // Lateral facetado π·r·s ≈ 3398 mm² (32 lados: algo menos).
    expect(c.measures.overhangAreaMm2).toBeGreaterThan(3398 * 0.97);
    expect(c.measures.overhangAreaMm2).toBeLessThan(3398 * 1.0);
    const b = best(a);
    expect(downIs(b, [0, 1, 0])).toBe(true);
    expect(b.measures.supportVolumeMm3).toBe(0);
    expect(b.measures.stable).toBe(true);
    // Base: polígono de 32 lados de radio 30 ≈ 2809 mm².
    expect(b.measures.contactAreaMm2).toBeCloseTo(0.5 * 32 * 900 * Math.sin((2 * Math.PI) / 32), 0);
  });

  it('con la base abajo la actual ya es la mejor', async () => {
    const mesh = await createPrimitiveMesh('cone', { radius: 30, height: 20, segments: 32 });
    const a = analyzeOrientations(input(mesh));
    expect(a.currentIsBest).toBe(true);
    expect(best(a).id).toBe(a.currentId);
  });
});

describe('analyzeOrientations: placa delgada de canto', () => {
  const a = analyzeOrientations(input(box(100, 60, 2)));

  it('de canto es inestable (vuelca con ~1,9°) y la mejor la acuesta', () => {
    const c = current(a);
    expect(c.measures.stable).toBe(false);
    expect(c.measures.tipAngleDeg).toBeCloseTo((Math.atan(1 / 30) * 180) / Math.PI, 2);
    expect(c.reasons.some((r) => r.key === 'unstable')).toBe(true);
    const b = best(a);
    expect(b.measures.stable).toBe(true);
    expect(b.measures.contactAreaMm2).toBeCloseTo(6000, 2);
    expect(b.measures.heightMm).toBeCloseTo(2, 4);
  });

  it('los candidatos del casco son todos estables', () => {
    expect(a.candidates.filter((c) => c.source === 'hull').every((c) => c.measures.stable)).toBe(true);
  });

  it('cama: dice si cabe con el giro sobre la vertical', () => {
    const r = analyzeOrientations(input(box(100, 60, 2)), { bed: { widthMm: 70, depthMm: 120, heightMm: 50, marginMm: 2 } });
    // De canto mide 60 de alto: no cabe en 50. Acostada cabe girada 90° (100 en el fondo).
    expect(current(r).measures.fitsBed).toBe(false);
    expect(current(r).reasons).toContainEqual({ key: 'doesNotFit' });
    const b = best(r);
    expect(b.measures.fitsBed).toBe(true);
    expect(Math.max(...b.measures.footprintMm)).toBeCloseTo(100, 3);
    expect(b.measures.footprintMm[1]).toBeCloseTo(100, 3);
  });
});

describe('planOrientTransform', () => {
  it('aplica la mejor de la «T»: apoyada en Y = 0, centrada, mismas medidas y volumen', () => {
    const mesh = tUpright();
    const src = input(mesh, [40, 0, -10]);
    const a = analyzeOrientations(src);
    const t = planOrientTransform(src, best(a).quaternion, { keepXY: false });
    const world = applyTransformToMesh(mesh as never, t.position, t.rotation, t.scale);
    const s = computeMeshStats(world);
    expect(s.isManifold).toBe(true);
    expect(s.volumeMm3).toBeCloseTo(computeMeshStats(mesh as never).volumeMm3, 3);
    expect(s.volumeMm3).toBeCloseTo(1000 * 10, 3);
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < world.positions.length; i += 3) {
      minX = Math.min(minX, world.positions[i]); maxX = Math.max(maxX, world.positions[i]);
      minY = Math.min(minY, world.positions[i + 1]); maxY = Math.max(maxY, world.positions[i + 1]);
      minZ = Math.min(minZ, world.positions[i + 2]); maxZ = Math.max(maxZ, world.positions[i + 2]);
    }
    expect(minY).toBeCloseTo(0, 4);
    expect(maxY).toBeCloseTo(10, 4);
    expect((minX + maxX) / 2).toBeCloseTo(0, 4);
    expect((minZ + maxZ) / 2).toBeCloseTo(0, 4);
    // Volver a analizar ya orientada: la actual es la mejor.
    const again = analyzeOrientations({ mesh, ...t });
    expect(again.currentIsBest).toBe(true);
  });

  it('keepXY conserva el centro en la cama', () => {
    const mesh = tUpright();
    const src = input(mesh, [40, 0, -10]);
    const t = planOrientTransform(src, best(analyzeOrientations(src)).quaternion, { keepXY: true });
    const world = applyTransformToMesh(mesh as never, t.position, t.rotation, t.scale);
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < world.positions.length; i += 3) { minX = Math.min(minX, world.positions[i]); maxX = Math.max(maxX, world.positions[i]); }
    // Centro X original de la «T» en mundo: 40.
    expect((minX + maxX) / 2).toBeCloseTo(40, 4);
  });
});
