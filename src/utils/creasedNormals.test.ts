/**
 * @file src/utils/creasedNormals.test.ts
 * @description Pruebas de normales con pliegue: cubo vivo, esfera suave, orden de triángulos y costo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import { computeCreasedMesh, getCreasedMesh } from './creasedNormals';

function cube(): { p: Float32Array; i: Uint32Array } {
  const p = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]);
  const i = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]);
  return { p, i };
}

function uvSphere(seg: number, rings: number): { p: Float32Array; i: Uint32Array } {
  const verts: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * Math.PI * 2;
      verts.push(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * seg + s;
      const b = r * seg + ((s + 1) % seg);
      const c = (r + 1) * seg + s;
      const d = (r + 1) * seg + ((s + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  }
  return { p: new Float32Array(verts), i: new Uint32Array(idx) };
}

describe('creasedNormals', () => {
  it('cubo: aristas vivas (24 vértices, normales alineadas a los ejes)', () => {
    const { p, i } = cube();
    const m = computeCreasedMesh(p, i);
    expect(m.positions.length / 3).toBe(24);
    expect(m.indices.length).toBe(i.length);
    for (let v = 0; v < 24; v++) {
      const n = [m.normals[v * 3], m.normals[v * 3 + 1], m.normals[v * 3 + 2]].map(Math.abs);
      expect(Math.max(...n)).toBeCloseTo(1, 5);
    }
  });

  it('esfera: se mantiene suave (sin duplicar vértices)', () => {
    const { p, i } = uvSphere(32, 16);
    const m = computeCreasedMesh(p, i);
    // Los polos se sueldan por posición; el total no crece por pliegues.
    expect(m.positions.length / 3).toBeLessThanOrEqual(p.length / 3 + 2);
    for (let v = 0; v < m.positions.length / 3; v += 17) {
      const px = m.positions[v * 3];
      const py = m.positions[v * 3 + 1];
      const pz = m.positions[v * 3 + 2];
      const dot = px * m.normals[v * 3] + py * m.normals[v * 3 + 1] + pz * m.normals[v * 3 + 2];
      expect(dot).toBeGreaterThan(0.97);
    }
  });

  it('caché por identidad del buffer', () => {
    const { p, i } = cube();
    expect(getCreasedMesh(p, i)).toBe(getCreasedMesh(p, i));
  });

  it('esfera de ~200 mil triángulos: mide el tiempo', () => {
    const { p, i } = uvSphere(316, 316);
    const t0 = performance.now();
    const m = computeCreasedMesh(p, i);
    const ms = performance.now() - t0;
    console.log(`creased ${i.length / 3} tris -> ${m.positions.length / 3} verts en ${ms.toFixed(0)} ms`);
    expect(m.indices.length).toBe(i.length);
  });
});
