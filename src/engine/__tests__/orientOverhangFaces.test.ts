/**
 * @file src/engine/__tests__/orientOverhangFaces.test.ts
 * @description Triángulos en voladizo por candidato: coinciden con el área que mide el análisis (misma regla), la
 * «T» de pie los tiene bajo el travesaño y acostada no, y el tope de triángulos se respeta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { analyzeOrientations, orientOverhangFaces, OVERHANG_FACES_MAX } from '../orient';
import { input, tUpright } from './orientShapes';

function triangleArea(mesh: { positions: ArrayLike<number>; indices: ArrayLike<number> }, t: number): number {
  const p = mesh.positions, i = mesh.indices;
  const [a, b, c] = [i[t * 3] * 3, i[t * 3 + 1] * 3, i[t * 3 + 2] * 3];
  const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
  const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
  return Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
}

describe('orientOverhangFaces', () => {
  const mesh = tUpright();
  const obj = input(mesh);
  const analysis = analyzeOrientations(obj);

  it('suma el mismo área en voladizo que mide el análisis, para cada candidato', () => {
    for (const c of analysis.candidates) {
      const res = orientOverhangFaces({ obj, quaternion: c.quaternion });
      const area = res.triangles.reduce((s, t) => s + triangleArea(mesh, t), 0);
      expect(area, c.id).toBeCloseTo(c.measures.overhangAreaMm2, 3);
      expect(res.truncated).toBe(false);
    }
  });

  it('la «T» de pie tiene triángulos bajo el travesaño y la mejor orientación no tiene ninguno', () => {
    const current = analysis.candidates.find((c) => c.id === analysis.currentId)!;
    expect(orientOverhangFaces({ obj, quaternion: current.quaternion }).triangles.length).toBeGreaterThan(0);
    expect(orientOverhangFaces({ obj, quaternion: analysis.candidates[0].quaternion }).triangles.length).toBe(0);
  });

  it('un umbral más estricto o más laxo cambia el conjunto sin salirse del tope', () => {
    const q = analysis.candidates.find((c) => c.id === analysis.currentId)!.quaternion;
    const strict = orientOverhangFaces({ obj, quaternion: q, overhangAngleDeg: 30 }).triangles.length;
    const lax = orientOverhangFaces({ obj, quaternion: q, overhangAngleDeg: 70 }).triangles.length;
    expect(strict).toBeGreaterThanOrEqual(lax);
    expect(strict).toBeLessThanOrEqual(OVERHANG_FACES_MAX);
  });
});
