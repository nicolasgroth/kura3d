/**
 * @file src/engine/__tests__/fitToBed.test.ts
 * @description Pruebas de "Ajustar a la impresora": factores calculados a mano, caja que cabe girada
 * pero no derecha, pieza que no cabe en ninguna orientación, bloques, márgenes, transformación previa
 * y la transformación aplicada (dentro de la cama, malla cerrada, volumen = V·s³).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { applyTransformToMesh, computeMeshStats } from '..';
import { analyzeFitToBed, measureFitBlock, planFitTransforms } from '../fitToBed';
import { FIT_ORIENTATIONS } from '../fitToBed/fitOrientations';
import type { FitBodyInput } from '../fitToBed';
import type { MeshData, Vec3 } from '../../types/kura';

/** Caja cerrada con tamaño en ejes del USUARIO (X, Y fondo, Z altura), centrada en el origen local. */
function boxUser(x: number, y: number, z: number): MeshData {
  // Interno: x = X, y = Z (altura), z = Y (fondo).
  const [hx, hy, hz] = [x / 2, z / 2, y / 2];
  const p = [
    -hx, -hy, -hz, hx, -hy, -hz, hx, hy, -hz, -hx, hy, -hz,
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
  ];
  const i = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3];
  return { positions: new Float32Array(p), indices: new Uint32Array(i), normals: new Float32Array(p.length) } as MeshData;
}

function body(id: string, mesh: MeshData, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): FitBodyInput & { mesh: MeshData } {
  return { id, mesh, position, rotation, scale };
}

const bed256 = { widthMm: 256, depthMm: 256, heightMm: 256, marginMm: 5 };

describe('measureFitBlock', () => {
  it('usa la caja mundial (rotación y escala aplicadas), no la local', () => {
    // Caja 100 × 50 × 20 (usuario) girada 90° sobre la vertical y escalada ×2 en su X local.
    const b = body('a', boxUser(100, 50, 20), [0, 0, 0], [0, Math.PI / 2, 0], [2, 1, 1]);
    const size = measureFitBlock([b]).sizeMm;
    // Local X (200 tras escalar) queda en el fondo (Y del usuario); Y local (50) pasa a X.
    expect(size[0]).toBeCloseTo(50, 4);
    expect(size[1]).toBeCloseTo(200, 4);
    expect(size[2]).toBeCloseTo(20, 4);
  });

  it('mide varios objetos como un bloque', () => {
    const a = body('a', boxUser(100, 40, 30), [-100, 15, 0]);
    const b = body('b', boxUser(100, 40, 60), [100, 30, 0]);
    expect(measureFitBlock([a, b]).sizeMm.map((v) => +v.toFixed(4))).toEqual([300, 40, 60]);
  });
});

describe('analyzeFitToBed', () => {
  it('solo escalar: factor exacto calculado a mano', () => {
    const r = analyzeFitToBed([body('a', boxUser(300, 100, 50))], bed256);
    expect(r.fitsAsIs).toBe(false);
    const scale = r.alternatives.find((a) => a.kind === 'scale')!;
    // (256 − 2·5) / 300 = 0,82
    expect(scale.factor).toBeCloseTo(0.82, 4);
    expect(scale.factor).toBeLessThanOrEqual(0.82);
    expect(scale.sizeMm[0]).toBeLessThanOrEqual(246);
    expect(scale.orientation.index).toBe(0);
    expect(scale.warnings.map((w) => w.code)).toEqual([]);
  });

  it('cabe girada sobre Z sin cambiar la cara apoyada', () => {
    const bed = { widthMm: 300, depthMm: 200, heightMm: 150, marginMm: 5 };
    const r = analyzeFitToBed([body('a', boxUser(100, 250, 50))], bed);
    const rotate = r.alternatives.find((a) => a.kind === 'rotate')!;
    expect(rotate.available).toBe(true);
    expect(rotate.factor).toBe(1);
    expect(rotate.changesDownFace).toBe(false);
    expect(rotate.orientation.steps).toEqual([{ axis: 'z', deg: 90 }]);
    expect(rotate.sizeMm.map((v) => +v.toFixed(3))).toEqual([250, 100, 50]);
    expect(r.alternatives.find((a) => a.kind === 'split')!.available).toBe(false);
    expect(r.alternatives.find((a) => a.kind === 'rotateScale')!.reason).toBe('sameAsRotate');
  });

  it('cabe solo acostada: informa la cara que queda abajo', () => {
    const bed = { widthMm: 300, depthMm: 200, heightMm: 150, marginMm: 5 };
    const r = analyzeFitToBed([body('a', boxUser(100, 50, 200))], bed);
    const scale = r.alternatives.find((a) => a.kind === 'scale')!;
    expect(scale.factor).toBeCloseTo(0.7, 4); // 140 / 200
    const rotate = r.alternatives.find((a) => a.kind === 'rotate')!;
    expect(rotate.available).toBe(true);
    expect(rotate.changesDownFace).toBe(true);
    expect(rotate.orientation.downFace).not.toBe('-z');
    expect(rotate.sizeMm[2]).toBeLessThanOrEqual(140);
    expect(rotate.warnings.map((w) => w.code)).toContain('FIT_DOWN_FACE_CHANGED');
  });

  it('no cabe en ninguna orientación: girar no disponible, girar y escalar da el mayor factor, dividir disponible', () => {
    const bed = { widthMm: 300, depthMm: 200, heightMm: 150, marginMm: 5 };
    const r = analyzeFitToBed([body('a', boxUser(400, 250, 100))], bed);
    expect(r.alternatives.find((a) => a.kind === 'rotate')!.available).toBe(false);
    const rs = r.alternatives.find((a) => a.kind === 'rotateScale')!;
    // Mejor: 400 → X (290), 250 → Y (190), 100 → Z (140): min(0,725; 0,76; 1,4) = 0,725 (orientación actual)
    expect(rs.factor).toBeCloseTo(0.725, 4);
    const scale = r.alternatives.find((a) => a.kind === 'scale')!;
    expect(scale.factor).toBeCloseTo(0.725, 4);
    // La mejor orientación es la actual: girar y escalar no aporta nada y se marca como igual a escalar.
    expect(rs).toMatchObject({ available: false, reason: 'sameAsScale' });
    expect(scale.recommended).toBe(true);
    expect(r.alternatives.find((a) => a.kind === 'split')!.available).toBe(true);
    expect(scale.warnings.map((w) => w.code)).toContain('FIT_THIN_WALLS');
  });

  it('girar y escalar mejora el factor frente a solo escalar', () => {
    const bed = { widthMm: 300, depthMm: 200, heightMm: 150, marginMm: 5 };
    const r = analyzeFitToBed([body('a', boxUser(100, 400, 100))], bed);
    expect(r.alternatives.find((a) => a.kind === 'scale')!.factor).toBeCloseTo(190 / 400, 4);
    const rs = r.alternatives.find((a) => a.kind === 'rotateScale')!;
    expect(rs.factor).toBeCloseTo(290 / 400, 4);
    expect(rs.changesDownFace).toBe(false);
  });

  it('escala bajo la mínima: aviso y Dividir recomendado', () => {
    const r = analyzeFitToBed([body('a', boxUser(1000, 1000, 1000))], bed256);
    const split = r.alternatives.find((a) => a.kind === 'split')!;
    expect(split.recommended).toBe(true);
    expect(r.alternatives.find((a) => a.kind === 'scale')!.warnings.map((w) => w.code)).toContain('FIT_BELOW_MIN_SCALE');
  });

  it('el margen cambia el factor exactamente', () => {
    const at = (marginMm: number) =>
      analyzeFitToBed([body('a', boxUser(300, 100, 50))], { ...bed256, marginMm }).alternatives[0].factor;
    expect(at(0)).toBe(Math.floor((256 / 300) * 10_000) / 10_000);
    expect(at(10)).toBe(Math.floor((236 / 300) * 10_000) / 10_000);
  });

  it('ya cabe: no propone cambios', () => {
    const r = analyzeFitToBed([body('a', boxUser(100, 100, 100))], bed256);
    expect(r.fitsAsIs).toBe(true);
    expect(r.alternatives.every((a) => !a.available)).toBe(true);
  });

  it('rechaza camas sin espacio útil', () => {
    expect(() => analyzeFitToBed([body('a', boxUser(10, 10, 10))], { ...bed256, marginMm: 200 })).toThrow();
  });
});

describe('planFitTransforms', () => {
  it('cada orientación deja el tamaño previsto', () => {
    const mesh = boxUser(120, 60, 30);
    for (const o of FIT_ORIENTATIONS) {
      const b = body('a', mesh, [0, 15, 0]);
      const out = planFitTransforms([b], { orientationIndex: o.index, factor: 1 })['a'];
      const world = computeMeshStats(applyTransformToMesh(mesh, out.position, out.rotation, out.scale));
      const expected = analyzeFitToBed([b], { widthMm: 1000, depthMm: 1000, heightMm: 1000, marginMm: 0 });
      void expected;
      const dimsUser = [world.dimensionsMm[0], world.dimensionsMm[2], world.dimensionsMm[1]].map((v) => Math.round(v));
      expect(dimsUser.slice().sort((a, b) => a - b)).toEqual([30, 60, 120]);
    }
  });

  it('girar y escalar: queda dentro de la cama, apoyado y centrado; volumen V·s³ y malla cerrada', () => {
    const bed = { widthMm: 300, depthMm: 200, heightMm: 150, marginMm: 5 };
    const mesh = boxUser(400, 250, 100);
    const b = body('a', mesh, [40, 60, 10], [0, 0.3, 0]);
    const r = analyzeFitToBed([b], bed);
    const rs = r.alternatives.find((a) => a.kind === 'rotateScale')!;
    const out = planFitTransforms([b], { orientationIndex: rs.orientation.index, factor: rs.factor })['a'];
    const placed = applyTransformToMesh(mesh, out.position, out.rotation, out.scale);
    const stats = computeMeshStats(placed);
    const orig = computeMeshStats(applyTransformToMesh(mesh, b.position, b.rotation, b.scale));
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeCloseTo(orig.volumeMm3 * rs.factor ** 3, 0);
    let minY = Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    for (let i = 0; i < placed.positions.length; i += 3) {
      minX = Math.min(minX, placed.positions[i]); maxX = Math.max(maxX, placed.positions[i]);
      minY = Math.min(minY, placed.positions[i + 1]); maxY = Math.max(maxY, placed.positions[i + 1]);
      minZ = Math.min(minZ, placed.positions[i + 2]); maxZ = Math.max(maxZ, placed.positions[i + 2]);
    }
    expect(minY).toBeCloseTo(0, 3);
    expect(maxY).toBeLessThanOrEqual(140 + 1e-3);
    expect(maxX - minX).toBeLessThanOrEqual(290 + 1e-3);
    expect(maxZ - minZ).toBeLessThanOrEqual(190 + 1e-3);
    expect((minX + maxX) / 2).toBeCloseTo(0, 3);
    expect((minZ + maxZ) / 2).toBeCloseTo(0, 3);
  });

  it('un bloque conserva la posición relativa de sus objetos', () => {
    const a = body('a', boxUser(100, 40, 30), [-100, 15, 0]);
    const c = body('c', boxUser(100, 40, 30), [100, 15, 0]);
    const out = planFitTransforms([a, c], { orientationIndex: 0, factor: 0.5 });
    expect(out.c.position[0] - out.a.position[0]).toBeCloseTo(100, 4);
    expect(out.a.scale).toEqual([0.5, 0.5, 0.5]);
  });
});
