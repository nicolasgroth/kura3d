/**
 * @file src/engine/paint/__tests__/brushSelect.test.ts
 * @description Selección de caras del pincel: la rejilla da lo mismo que la fuerza bruta en mallas
 * aleatorias, solo caras de frente a la cámara (no atraviesa una placa delgada; sin cámara, según la
 * cara más cercana) y solo las conectadas a la cara bajo el puntero (o a la más cercana).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import { selectBrushFaces, selectBrushFacesBruteForce } from '../brushSelect';
import { randomSoup, seededRandom, thinPlate, uvSphere } from './paintTestMeshes';

describe('selectBrushFaces = fuerza bruta', () => {
  it.each([1, 2, 3, 4, 5])('sopa aleatoria (semilla %i), con y sin cámara y escala', (seed) => {
    const rand = seededRandom(seed);
    const mesh = randomSoup(3000, 100, rand);
    for (let k = 0; k < 25; k++) {
      const scale: Vec3 = [0.5 + rand() * 2, 0.5 + rand() * 2, 0.5 + rand() * 2];
      const query = {
        center: [rand() * 100, rand() * 100, rand() * 100] as Vec3,
        radiusMm: 1 + rand() * 20,
        scale,
        eye: k % 3 === 0 ? null : ([rand() * 300 - 100, rand() * 300 - 100, rand() * 300 - 100] as Vec3),
        viewDir: k % 3 === 0 ? ([rand() - 0.5, rand() - 0.5, rand() - 0.5] as Vec3) : null,
      };
      expect(Array.from(selectBrushFaces(mesh, query))).toEqual(Array.from(selectBrushFacesBruteForce(mesh, query)));
    }
  });

  it('esfera con semilla de conexión', () => {
    const mesh = uvSphere(20, 64, 32);
    const seedQuery = { center: [0, 20, 0] as Vec3, radiusMm: 8, scale: [1, 1, 1] as Vec3, eye: [0, 100, 0] as Vec3 };
    const all = selectBrushFaces(mesh, seedQuery);
    expect(all.length).toBeGreaterThan(10);
    const q = { ...seedQuery, seedFace: all[0] };
    expect(Array.from(selectBrushFaces(mesh, q))).toEqual(Array.from(selectBrushFacesBruteForce(mesh, q)));
  });
});

describe('el pincel no atraviesa la pieza', () => {
  const plate = thinPlate(20, 0.6, 20); // caras de 1 mm, 800 triángulos por lado
  const half = plate.indices.length / 6;

  it('sin cámara usa la normal de la cara más cercana; con cámara arriba (o vista ortográfica), solo la superior', () => {
    const base = { center: [0, 0.3, 0] as Vec3, radiusMm: 2, scale: [1, 1, 1] as Vec3 };
    const blind = selectBrushFaces(plate, base);
    expect(blind.length).toBeGreaterThan(0);
    expect(blind.every((t) => t < half)).toBe(true);
    const fromBelow = selectBrushFaces(plate, { ...base, center: [0, -0.3, 0] });
    expect(fromBelow.length).toBeGreaterThan(0);
    expect(fromBelow.every((t) => t >= half)).toBe(true);
    const fromTop = selectBrushFaces(plate, { ...base, eye: [0, 50, 0] });
    expect(fromTop.length).toBeGreaterThan(0);
    expect(fromTop.every((t) => t < half)).toBe(true);
    const ortho = selectBrushFaces(plate, { ...base, viewDir: [0, -1, 0] });
    expect(Array.from(ortho)).toEqual(Array.from(fromTop));
    expect(Array.from(blind)).toEqual(Array.from(fromTop));
  });

  it('con escala que estira el espesor, la cara inferior sigue fuera', () => {
    const q = { center: [0, 0.3, 0] as Vec3, radiusMm: 3, scale: [1, 2, 1] as Vec3, eye: [0, 40, 0] as Vec3 };
    expect(selectBrushFaces(plate, q).every((t) => t < half)).toBe(true);
  });

  it('la semilla limita a la superficie conectada (dos placas paralelas cercanas, ambas de frente)', () => {
    const a = thinPlate(20, 0.4, 10);
    const b = thinPlate(20, 0.4, 10);
    const pos = new Float32Array(a.positions.length * 2);
    pos.set(a.positions);
    pos.set(b.positions.map((v, i) => (i % 3 === 1 ? v - 1 : v)), a.positions.length);
    const nVerts = a.positions.length / 3;
    const idx = new Uint32Array(a.indices.length * 2);
    idx.set(a.indices);
    idx.set(b.indices.map((v) => v + nVerts), a.indices.length);
    const mesh = { positions: pos, indices: idx };
    const q = { center: [0, 0.2, 0] as Vec3, radiusMm: 1.5, scale: [1, 1, 1] as Vec3, eye: [0, 50, 0] as Vec3 };
    const firstPlateTris = a.indices.length / 3;
    // Sin semilla, la más cercana (placa de arriba) define la superficie.
    const nearest = selectBrushFaces(mesh, q);
    expect(nearest.length).toBeGreaterThan(0);
    expect(nearest.every((t) => t < firstPlateTris)).toBe(true);
    // Con semilla en la placa de abajo (también de frente y dentro del radio), solo esa placa.
    const lowerTop = firstPlateTris + 110; // cara superior de la placa de abajo, celda (5,5) junto al centro
    const seeded = selectBrushFaces(mesh, { ...q, seedFace: lowerTop });
    expect(Array.from(seeded)).toContain(lowerTop);
    expect(seeded.every((t) => t >= firstPlateTris)).toBe(true);
    expect(Array.from(seeded)).toEqual(Array.from(selectBrushFacesBruteForce(mesh, { ...q, seedFace: lowerTop })));
  });
});
