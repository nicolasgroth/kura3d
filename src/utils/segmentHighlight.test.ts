/**
 * @file src/utils/segmentHighlight.test.ts
 * @description Pruebas de región por triángulo y contorno de región.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import type { DetectedStructureRegion } from '../types/kura';
import { buildRegionOverlay, regionIdForFace } from './segmentHighlight';

const region = (id: string, faceIndices: number[]) => ({ id, faceIndices }) as DetectedStructureRegion;

describe('segmentHighlight', () => {
  it('encuentra la región de un triángulo', () => {
    const regions = [region('a', [0, 1]), region('b', [2])];
    expect(regionIdForFace(regions, 1)).toBe('a');
    expect(regionIdForFace(regions, 2)).toBe('b');
    expect(regionIdForFace(regions, 9)).toBeNull();
  });

  it('contorno: un cuadrado de dos triángulos tiene 4 aristas de borde', () => {
    const p = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
    const i = [0, 1, 2, 0, 2, 3];
    const o = buildRegionOverlay(p, i, [0, 1]);
    expect(o.fill.length).toBe(18);
    expect(o.outline.length / 6).toBe(4);
    expect(buildRegionOverlay(p, i, [0]).outline.length / 6).toBe(3);
  });
});
