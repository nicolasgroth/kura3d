/**
 * @file src/project/projectRoleMigration.test.ts
 * @description `.kura` v3: escribe `role` (y la opacidad propia de una referencia), lee v1/v2 migrando
 * `isHole` → `role` en escena e historial, rechaza mezclas inválidas y una versión más nueva.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../engine/primitives';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type ObjectRole, type SceneObject } from '../types/kura';
import { COMPRESSED_FORMAT_VERSION, decodeProject, encodeProjectImage, type ProjectDocument } from './projectCodec';
import { ROLE_FORMAT_VERSION } from './projectRoleMigration';
import { repackKura, toLegacyKura } from './__tests__/legacyKura';

const mesh: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
};

const obj = (id: string, role: ObjectRole, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#38bdf8', role, visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
});

const doc = (objects: SceneObject[], past: SceneObject[][] = []): ProjectDocument => ({
  objects, selectedIds: [], past: past.map((o) => ({ objects: o, selectedIds: [] })), future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
});

const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);

describe('.kura v3: rol del objeto', () => {
  it('escribe la versión 3 con role y conserva la referencia y su opacidad', () => {
    const scene = [obj('s', 'solid'), obj('n', 'negative'), obj('r', 'reference', { referenceOpacity: 0.5 })];
    const bytes = encodeProjectImage(doc(scene, [[obj('r', 'reference')]]));
    expect(versionOf(bytes)).toBe(ROLE_FORMAT_VERSION);
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain('isHole');
    const back = decodeProject(bytes);
    expect(back.objects.map((o) => o.role)).toEqual(['solid', 'negative', 'reference']);
    expect(back.objects[2].referenceOpacity).toBe(0.5);
    expect(back.past[0].objects[0].role).toBe('reference');
  });

  it.each([1, 2] as const)('abre un v%i migrando isHole → role en escena e historial', (version) => {
    const legacy = toLegacyKura(encodeProjectImage(doc([obj('s', 'solid'), obj('n', 'negative')], [[obj('n', 'negative')]])), version);
    expect(versionOf(legacy)).toBe(version);
    expect(new TextDecoder().decode(legacy)).toContain('"isHole":true');
    const back = decodeProject(legacy);
    expect(back.objects.map((o) => o.role)).toEqual(['solid', 'negative']);
    expect(back.past[0].objects[0].role).toBe('negative');
    expect(back.objects.every((o) => !('isHole' in o))).toBe(true);
    // Al volver a guardar queda en v3.
    expect(versionOf(encodeProjectImage(back))).toBe(ROLE_FORMAT_VERSION);
  });

  it('rechaza un v2 con role, un v3 con isHole y un rol desconocido', () => {
    const v3 = encodeProjectImage(doc([obj('r', 'reference')]));
    expect(() => decodeProject(repackKura(v3, 2))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const withHole = repackKura(v3, 3, (m) => { m.current.objects[0].isHole = false; });
    expect(() => decodeProject(withHole)).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const unknown = repackKura(v3, 3, (m) => { m.current.objects[0].role = 'ghost'; });
    expect(() => decodeProject(unknown)).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const opacity = repackKura(v3, 3, (m) => { m.current.objects[0].referenceOpacity = 0.01; });
    expect(() => decodeProject(opacity)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });

  it('un archivo de una versión más nueva dice "versión no soportada" (no lee mal la referencia)', () => {
    // Es lo que hace un lector v2 con un archivo v3: la versión no está entre las que sabe leer.
    // Las versiones 4 (placas) y 5 (datos del proyecto) ya se leen: la desconocida es la que viene después de la 5.
    const future = repackKura(encodeProjectImage(doc([obj('r', 'reference')])), COMPRESSED_FORMAT_VERSION + 1);
    expect(() => decodeProject(future)).toThrowError(expect.objectContaining({ code: 'unsupported' }));
  });
});
