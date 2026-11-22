/**
 * @file src/project/projectLimits.test.ts
 * @description El .kura valida position/rotation/scale con los límites compartidos de
 * transformación al codificar y decodificar, guardar con una selección huérfana la filtra en vez de
 * fallar, y el error de códec trae la causa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { TRANSFORM_LIMITS } from '../engine/operationLimits';
import { computeMeshStats } from '../engine/primitives';
import { captureProject, useKuraStore } from '../store/useKuraStore';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject, type Vec3 } from '../types/kura';
import { decodeProject, encodeProject, type ProjectDocument } from './projectCodec';
import { ProjectCodecError } from './projectSchema';

const mesh: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
};

function doc(patch: Partial<SceneObject> = {}): ProjectDocument {
  const obj: SceneObject = {
    id: 'a', name: 'a', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#38bdf8', isHole: false, visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...patch,
  };
  return {
    objects: [obj], selectedIds: [], past: [], future: [], unitSystem: 'mm',
    printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
    sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
  };
}

const over = TRANSFORM_LIMITS.maxAbsCoordinate * 10;

describe('Límites de transformación en .kura', () => {
  it.each<[string, Partial<SceneObject>]>([
    ['posición fuera de rango', { position: [over, 0, 0] as Vec3 }],
    ['rotación fuera de rango', { rotation: [0, TRANSFORM_LIMITS.maxAbsRotation * 2, 0] as Vec3 }],
    ['escala bajo el mínimo', { scale: [TRANSFORM_LIMITS.minScale / 10, 1, 1] as Vec3 }],
    ['escala sobre el máximo', { scale: [1, TRANSFORM_LIMITS.maxScale * 2, 1] as Vec3 }],
  ])('rechaza %s al codificar con la causa', (_label, patch) => {
    let error: unknown;
    try { encodeProject(doc(patch)); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(ProjectCodecError);
    expect((error as ProjectCodecError).detail).toMatch(/"a"/);
  });

  it('acepta escala negativa dentro del rango (espejo)', () => {
    const decoded = decodeProject(encodeProject(doc({ scale: [-1, 1, 2] })));
    expect(decoded.objects[0].scale).toEqual([-1, 1, 2]);
  });
});

describe('Guardar con selección huérfana', () => {
  it('captureProject filtra ids inexistentes y duplicados en vez de abortar', () => {
    const base = doc();
    useKuraStore.setState({
      objects: base.objects,
      selectedIds: ['a', 'fantasma', 'a'],
      past: [{ objects: [], selectedIds: ['fantasma'] }],
      future: [],
    });
    const captured = captureProject(useKuraStore.getState());
    expect(captured.selectedIds).toEqual(['a']);
    expect(captured.past[0].selectedIds).toEqual([]);
    expect(() => encodeProject(captured)).not.toThrow();
  });
});
