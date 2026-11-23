/**
 * @file src/engine/__tests__/boundaryEdgesUnified.test.ts
 * @description El aviso de importación y el inspector cuentan las aristas abiertas con la misma definición
 * (`repair/boundaryEdges.ts`): una malla con un hueco, un triángulo duplicado, un triángulo degenerado y
 * una costura sin soldar daba 13 en el aviso y 8 en el inspector en un modelo real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { countOpenEdges, finishMesh } from '../io/meshBuffers';
import { diagnoseMesh } from '../repair';
import { countBoundaryEdges } from '../repair/boundaryEdges';
import { cubeGeometry } from './ioFixtures';

/** Cubo sin un triángulo (hueco de 3 aristas), con un triángulo repetido y uno degenerado, y la cara
 *  superior con vértices propios en la misma posición (costura sin soldar). */
function messyCube() {
  const { v, t } = cubeGeometry(10);
  const verts = v.map((p) => [...p]);
  const tris = t.slice(1).map((tri) => [...tri]); // falta [0, 2, 1]
  // Cara superior (y = s: vértices 2, 3, 6, 7) con copias de sus vértices
  const copy = new Map<number, number>();
  for (const k of [2, 3, 6, 7]) {
    copy.set(k, verts.length);
    verts.push([...v[k]]);
  }
  for (const tri of tris) if (tri.every((k) => copy.has(k))) for (let i = 0; i < 3; i++) tri[i] = copy.get(tri[i])!;
  tris.push([...tris[1]]); // triángulo repetido ([4, 5, 6], lejos del hueco)
  tris.push([4, 4, 5]); // degenerado
  return { positions: Float32Array.from(verts.flat()), indices: Uint32Array.from(tris.flat()) };
}

describe('aristas abiertas: una sola definición', () => {
  it('aviso de importación e inspector dan la misma cifra', () => {
    const { positions, indices } = messyCube();
    const imported = finishMesh(positions, indices).openEdges;
    const inspector = diagnoseMesh({ positions, indices }).boundaryEdges;
    expect(imported).toBe(3);
    expect(inspector).toBe(imported);
    expect(countBoundaryEdges(positions, indices)).toBe(imported);
    // El conteo anterior (sin soldar, contando aristas de 1 o 3+ triángulos) daba otra cifra
    expect(countOpenEdges(indices, positions.length / 3)).toBeGreaterThan(imported);
  });

  it('cubo cerrado: 0 en ambos', () => {
    const { v, t } = cubeGeometry(10);
    const positions = Float32Array.from(v.flat());
    const indices = Uint32Array.from(t.flat());
    expect(finishMesh(positions, indices).openEdges).toBe(0);
    expect(diagnoseMesh({ positions, indices }).boundaryEdges).toBe(0);
  });
});
