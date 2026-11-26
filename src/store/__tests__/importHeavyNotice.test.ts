/**
 * @file src/store/__tests__/importHeavyNotice.test.ts
 * @description Aviso de modelo pesado al importar: umbral de 1 millón (por pieza y por total), un solo aviso que
 * apunta a la pieza más pesada, el aviso habitual entre 300 000 y 1 millón, y una malla ya avisada no repite.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import type { MeshData, SceneObject } from '../../types/kura';
import { heavyImportNotice } from '../importHeavyNotice';

const mesh = (tris: number) => ({ positions: new Float32Array(0), indices: new Uint32Array(tris * 3) }) as unknown as MeshData;
const unique = (id: string, tris: number) => ({ mesh: mesh(tris), entries: [{ object: { id } as SceneObject }] });

describe('heavyImportNotice', () => {
  it('el umbral «muy pesado» es de 1 000 000 de triángulos', () => {
    expect(OPERATION_DEFAULTS.heavyMesh.hugeTriangles).toBe(1_000_000);
  });

  it('una pieza de 1 000 000 avisa fuerte; de 999 999 solo el aviso habitual', () => {
    expect(heavyImportNotice([unique('a', 1_000_000)])).toMatchObject({ key: 'import.heavy.huge', tris: 1_000_000, id: 'a' });
    expect(heavyImportNotice([unique('b', 999_999)])).toMatchObject({ key: 'import.heavy', id: 'b' });
  });

  it('sin avisar bajo el umbral habitual', () => {
    expect(heavyImportNotice([unique('c', 299_999)])).toBeNull();
    expect(heavyImportNotice([])).toBeNull();
  });

  it('si solo el total pasa el millón, un aviso con el total que apunta a la pieza más pesada', () => {
    const n = heavyImportNotice([unique('x', 400_000), unique('y', 500_000), unique('z', 300_000)]);
    expect(n).toMatchObject({ key: 'import.heavy.total', tris: 1_200_000, id: 'y' });
  });

  it('con varias piezas pesadas sale un solo aviso, el de la más pesada', () => {
    const n = heavyImportNotice([unique('p', 1_100_000), unique('q', 2_500_000)]);
    expect(n).toMatchObject({ key: 'import.heavy.huge', tris: 2_500_000, id: 'q' });
  });

  it('una malla ya avisada no vuelve a avisar', () => {
    const u = unique('r', 1_500_000);
    expect(heavyImportNotice([u])).not.toBeNull();
    expect(heavyImportNotice([u])).toBeNull();
  });
});
