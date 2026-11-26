/**
 * @file src/project/__tests__/projectLayout.test.ts
 * @description `.kura` con las dos poses: `restPose` y `layout` = 'assembly' obligan a la versión 4 (también si solo
 * están en el historial), la ida y vuelta las conserva, un v3 que las trae se rechaza y valores fuera de forma o
 * de límites se rechazan (validación estricta). Sin poses ni modo armado sigue la versión 3.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { TRANSFORM_LIMITS } from '../../engine/operationLimits';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../../types/kura';
import { decodeProject, encodeProjectImage, PLATES_FORMAT_VERSION, type ProjectDocument } from '../projectCodec';
import { ROLE_FORMAT_VERSION } from '../projectRoleMigration';
import { repackKura } from './legacyKura';

const mesh: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
};
const obj = (id: string, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#808080', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
});
const doc = (objects: SceneObject[], extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
  objects, selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0, ...extra,
});
const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
const rest = { position: [10, 20, 30] as [number, number, number], rotation: [0, 1, 0] as [number, number, number] };
type Manifest = { current: { objects: Array<Record<string, unknown>>; layout?: unknown } };

describe('.kura con dos poses', () => {
  it('sin restPose ni modo armado sigue en v3 (layout "print" no cuenta)', () => {
    const bytes = encodeProjectImage(doc([obj('a')], { layout: 'print' }));
    expect(versionOf(bytes)).toBe(ROLE_FORMAT_VERSION);
    expect(new TextDecoder().decode(bytes)).not.toMatch(/layout|restPose/);
  });

  it('restPose y modo armado se escriben en v4 y vuelven iguales', () => {
    const original = doc([obj('a', { restPose: rest }), obj('b')], { layout: 'assembly' });
    const bytes = encodeProjectImage(original);
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back.layout).toBe('assembly');
    expect(back.objects[0].restPose).toEqual(rest);
    expect(back.objects[1].restPose).toBeUndefined();
  });

  it('poses solo en el historial también obligan a v4', () => {
    const past = { objects: [obj('a', { restPose: rest })], selectedIds: [], layout: 'assembly' as const };
    const bytes = encodeProjectImage(doc([obj('a')], { past: [past] }));
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back.layout).toBeUndefined();
    expect(back.past[0].layout).toBe('assembly');
    expect(back.past[0].objects[0].restPose).toEqual(rest);
  });

  it('un v3 que trae restPose o layout se rechaza', () => {
    const v4 = encodeProjectImage(doc([obj('a', { restPose: rest })], { layout: 'assembly' }));
    expect(() => decodeProject(repackKura(v4, 3))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const onlyLayout = repackKura(v4, 3, (m) => { delete (m as unknown as Manifest).current.objects[0].restPose; });
    expect(() => decodeProject(onlyLayout)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });

  it('valores fuera de forma o de límites se rechazan', () => {
    const v4 = encodeProjectImage(doc([obj('a', { restPose: rest })], { layout: 'assembly' }));
    const bad = (edit: (m: Manifest) => void) => () => decodeProject(repackKura(v4, PLATES_FORMAT_VERSION, (m) => edit(m as unknown as Manifest)));
    expect(bad((m) => { m.current.layout = 'free'; })).toThrowError(expect.objectContaining({ code: 'invalid' }));
    expect(bad((m) => { m.current.objects[0].restPose = { position: [1, 2] , rotation: [0, 0, 0] }; })).toThrowError(expect.objectContaining({ code: 'invalid' }));
    expect(bad((m) => { m.current.objects[0].restPose = { ...rest, extra: 1 }; })).toThrowError(expect.objectContaining({ code: 'invalid' }));
    expect(bad((m) => {
      m.current.objects[0].restPose = { position: [TRANSFORM_LIMITS.maxAbsCoordinate * 2, 0, 0], rotation: [0, 0, 0] };
    })).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });
});
