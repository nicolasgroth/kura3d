/**
 * @file src/engine/__tests__/measureGeometry.test.ts
 * @description Distancia con componentes en ejes del usuario, ángulos, áreas de región y totales de
 * cubo, esfera y cilindro contra el valor analítico, e imán a vértices, puntos medios y centros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../types/kura';
import { angleAtVertex, angleBetweenFaces, faceNormal, measureDistance, measureRegionArea, surfaceArea } from '../measure/measureGeometry';
import { snapOnFace } from '../measure/measureSnap';
import { createPrimitiveMesh } from '../primitives';

const REGION_DEG = 35;

/** Primer triángulo cuya normal se parece a `n`. */
function faceWithNormal(mesh: MeshData, n: Vec3): number {
  for (let f = 0; f < mesh.indices.length / 3; f++) {
    const fn = faceNormal(mesh, f);
    if (fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] > 0.999) return f;
  }
  throw new Error('no face');
}

describe('measureDistance', () => {
  it('diagonal de cara de un cubo de 40 y componentes en ejes del usuario', () => {
    const d = measureDistance([-20, 0, 20], [20, 40, 20]);
    expect(d.distanceMm).toBeCloseTo(56.5685, 3);
    // Interno Δ(x, y, z) = (40, 40, 0) → usuario (ΔX, ΔY, ΔZ) = (40, −0, 40).
    expect(d.deltaUser[0]).toBe(40);
    expect(d.deltaUser[1] === 0).toBe(true);
    expect(d.deltaUser[2]).toBe(40);
  });

  it('ΔY del usuario es hacia el fondo (−z interno)', () => {
    expect(measureDistance([0, 0, 0], [0, 0, -10]).deltaUser).toEqual([0, 10, 0]);
  });
});

describe('ángulos', () => {
  it('tres puntos', () => {
    expect(angleAtVertex([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90, 9);
    expect(angleAtVertex([1, 0, 0], [0, 0, 0], [1, 1, 0])).toBeCloseTo(45, 9);
    expect(angleAtVertex([1, 0, 0], [0, 0, 0], [-1, 0, 0])).toBeCloseTo(180, 9);
    expect(angleAtVertex([0, 0, 0], [0, 0, 0], [1, 0, 0])).toBe(0);
  });

  it('dos caras: un cubo da 90° entre caras vecinas y 180° de normales opuestas', () => {
    expect(angleBetweenFaces([0, 1, 0], [1, 0, 0]).dihedralDeg).toBeCloseTo(90, 9);
    expect(angleBetweenFaces([0, 1, 0], [0, -1, 0]).betweenNormalsDeg).toBeCloseTo(180, 9);
    const r = angleBetweenFaces([0, 1, 0], [Math.SQRT1_2, Math.SQRT1_2, 0]);
    expect(r.betweenNormalsDeg).toBeCloseTo(45, 9);
    expect(r.dihedralDeg).toBeCloseTo(135, 9);
  });
});

describe('áreas', () => {
  it('cubo de 40: cara 1600 mm² y total 9600 mm²', async () => {
    const cube = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    const top = measureRegionArea(cube, faceWithNormal(cube, [0, 1, 0]), REGION_DEG);
    expect(top.areaMm2).toBeCloseTo(1600, 6);
    expect(top.normal[1]).toBeCloseTo(1, 6);
    expect(top.centroid[1]).toBeCloseTo(40, 6);
    expect(surfaceArea(cube)).toBeCloseTo(9600, 6);
  });

  it('esfera: 4 π r² ±1 % (la región suave es toda la esfera)', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 20, segments: 96 });
    const analytic = 4 * Math.PI * 400;
    expect(Math.abs(surfaceArea(sphere) - analytic) / analytic).toBeLessThan(0.01);
    const region = measureRegionArea(sphere, 0, REGION_DEG);
    expect(region.areaMm2).toBeCloseTo(surfaceArea(sphere), 3);
  });

  it('cilindro: tapa π r², manto 2 π r h ±0,5 %', async () => {
    const r = 15, h = 30;
    const cyl = await createPrimitiveMesh('cylinder', { radius: r, height: h, segments: 128 });
    const top = measureRegionArea(cyl, faceWithNormal(cyl, [0, 1, 0]), REGION_DEG);
    expect(Math.abs(top.areaMm2 - Math.PI * r * r) / (Math.PI * r * r)).toBeLessThan(0.005);
    const side = measureRegionArea(cyl, faceWithNormal(cyl, [1, 0, 0]), REGION_DEG);
    expect(Math.abs(side.areaMm2 - 2 * Math.PI * r * h) / (2 * Math.PI * r * h)).toBeLessThan(0.005);
    const total = 2 * Math.PI * r * r + 2 * Math.PI * r * h;
    expect(Math.abs(surfaceArea(cyl) - total) / total).toBeLessThan(0.005);
  });

  it('semilla fuera de rango: área 0', async () => {
    const cube = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    expect(measureRegionArea(cube, 999, REGION_DEG).areaMm2).toBe(0);
  });
});

describe('snapOnFace', () => {
  it('imán a vértice, punto medio, centro de cara o el punto tocado', async () => {
    const cube = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    const f = faceWithNormal(cube, [0, 1, 0]);
    expect(snapOnFace(cube, f, [19.5, 40, 19.5], 2)).toEqual({ point: [20, 40, 20], kind: expect.stringMatching(/vertex/) });
    const center = snapOnFace(cube, f, [0.5, 40, 0.3], 2);
    expect(['face-center', 'edge-mid']).toContain(center.kind);
    const far = snapOnFace(cube, f, [7, 40, 11], 0.5);
    expect(far).toEqual({ point: [7, 40, 11], kind: 'surface' });
  });

  it('centro de cara de la cara plana completa', async () => {
    const cube = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    const f = faceWithNormal(cube, [1, 0, 0]);
    const s = snapOnFace(cube, f, [20, 21, 1], 3);
    expect(s.kind).toBe('face-center');
    expect(s.point[0]).toBeCloseTo(20, 6);
    expect(s.point[1]).toBeCloseTo(20, 6);
    expect(s.point[2]).toBeCloseTo(0, 6);
  });
});
