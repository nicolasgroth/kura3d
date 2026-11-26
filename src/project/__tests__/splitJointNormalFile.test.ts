/**
 * @file src/project/__tests__/splitJointNormalFile.test.ts
 * @description Unión guardada de un plano a mano inclinado en el `.kura`: la normal de la cara es opcional (los
 * proyectos anteriores no la traen y siguen leyéndose), se acepta si es un vector finito y se rechaza si no lo es.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { SplitJointRecord } from '../../types/kura';
import { validSplitJointRecord } from '../projectSchema';

const record = (): SplitJointRecord => ({
  label: '1', axis: 'x', position: 0, a: 'A1', b: 'B1', kind: 'connector',
  connector: { type: 'dowel', size: 3, depth: 6, tolerance: 0.25, count: 1 },
  connectorCenters: [[0, 30, 0]], contactAreaMm2: 3600, labelPlacement: null,
});

describe('unión inclinada en el archivo', () => {
  it('acepta la unión sin normal (proyectos anteriores) y con una normal finita', () => {
    expect(validSplitJointRecord(record())).toBe(true);
    expect(validSplitJointRecord({ ...record(), normal: [0.94, 0.34, 0] })).toBe(true);
  });

  it('rechaza una normal que no es un vector finito', () => {
    expect(validSplitJointRecord({ ...record(), normal: [1, 0] })).toBe(false);
    expect(validSplitJointRecord({ ...record(), normal: [Number.NaN, 0, 0] })).toBe(false);
    expect(validSplitJointRecord({ ...record(), normal: 'x' })).toBe(false);
  });
});
