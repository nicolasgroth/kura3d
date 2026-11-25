/**
 * @file src/project/__tests__/projectPlates.test.ts
 * @description Placas en el `.kura`: sin placas se sigue escribiendo la versión 3 (la abre una versión anterior),
 * con placas (en la escena o en el historial) la 4; ida y vuelta de v3 y v4, saneo de referencias rotas sin
 * perder la pieza, rechazo de campos de placas en archivos anteriores a v4 y de placas malformadas, índice de
 * placa virtual de Dividir acotado (archivo malicioso) y el borrador de recuperación con placas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { MAX_PLATES } from '../../core/scene/plates';
import { MAX_SPLIT_PLATES } from '../../core/scene/splitGroups';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { decodeProject, encodeProject, PLATES_FORMAT_VERSION, type ProjectDocument } from '../projectCodec';
import { ROLE_FORMAT_VERSION } from '../projectRoleMigration';
import { assembleDocument, splitDocument } from '../recoveryDraftFormat';
import { repackKura } from './legacyKura';

const mesh: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
};
const obj = (id: string, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#808080', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
});
const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Cabeza', origin: [260, 0], bed: { profileId: 'mini', name: 'Mini', widthMm: 180, depthMm: 180, heightMm: 180, marginMm: 3 }, locked: true },
];
const doc = (objects: SceneObject[], extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
  objects, selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0, ...extra,
});
const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
const withPlates = () => doc([obj('a', { plateRef: 'p1' }), obj('b', { plateRef: 'p2' }), obj('ref', { role: 'reference' })], { plates: PLATES });

describe('versión del .kura según las placas', () => {
  it('un proyecto sin placas se sigue escribiendo en v3 y vuelve igual', () => {
    const plain = doc([obj('a'), obj('b')]);
    const bytes = encodeProject(plain);
    expect(versionOf(bytes)).toBe(ROLE_FORMAT_VERSION);
    expect(new TextDecoder().decode(bytes)).not.toMatch(/plate/);
    expect(decodeProject(bytes)).toEqual(plain);
  });

  it('con placas se escribe v4 y la ida y vuelta conserva placas, camas y plateRef', () => {
    const original = withPlates();
    const bytes = encodeProject(original);
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back).toEqual(original);
    expect(encodeProject(back)).toEqual(bytes);
  });

  it('placas solo en el historial también obligan a v4 (una versión anterior no las entendería)', () => {
    const past = { objects: [obj('a', { plateRef: 'p1' })], selectedIds: [], plates: [PLATES[0]] };
    const bytes = encodeProject(doc([obj('a')], { past: [past] }));
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back.plates).toBeUndefined();
    expect(back.past[0].plates).toEqual([PLATES[0]]);
  });

  it('un v3 que trae placas o plateRef se rechaza (validación estricta por versión)', () => {
    const v4 = encodeProject(withPlates());
    expect(() => decodeProject(repackKura(v4, 3))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const onlyRef = repackKura(v4, 3, (m) => { delete (m.current as Record<string, unknown>).plates; });
    expect(() => decodeProject(onlyRef)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });

  it('una versión más nueva que la 4 dice "no soportada"', () => {
    const future = repackKura(encodeProject(withPlates()), PLATES_FORMAT_VERSION + 1);
    expect(() => decodeProject(future)).toThrowError(expect.objectContaining({ code: 'unsupported' }));
  });
});

describe('saneo de placas al abrir', () => {
  it('un plateRef a una placa inexistente pasa a la placa por defecto sin perder la pieza', () => {
    const bytes = encodeProject(doc([obj('a', { plateRef: 'fantasma' }), obj('b', { plateRef: 'p2' })], { plates: PLATES }));
    const back = decodeProject(bytes);
    expect(back.objects.map((o) => [o.id, o.plateRef])).toEqual([['a', 'p1'], ['b', 'p2']]);
  });

  it('un plateRef sin ninguna placa se quita y la pieza queda', () => {
    const bytes = encodeProject(doc([obj('a', { plateRef: 'fantasma' })]));
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back.objects).toHaveLength(1);
    expect('plateRef' in back.objects[0]).toBe(false);
    expect(back.plates).toBeUndefined();
  });

  it('placas con id repetido se reducen a la primera', () => {
    const bytes = repackKura(encodeProject(withPlates()), 4, (m) => {
      const current = m.current as unknown as { plates: ScenePlate[] };
      current.plates.push({ ...current.plates[0], name: 'copia' });
    });
    expect(decodeProject(bytes).plates!.map((p) => p.name)).toEqual(['Placa 1', 'Cabeza']);
  });

  type Plates = { plates: Record<string, unknown>[] };
  const malformed: [string, (p: Plates) => void, 'invalid' | 'too-large'][] = [
    ['campo desconocido', (c) => { c.plates[0].color = '#fff'; }, 'invalid'],
    ['prototipo en la placa', (c) => { c.plates[0] = JSON.parse('{"__proto__":{"x":1},"id":"p1","name":"a","origin":[0,0]}'); }, 'invalid'],
    ['origen de tres valores', (c) => { c.plates[0].origin = [0, 0, 0]; }, 'invalid'],
    ['origen fuera de los límites', (c) => { c.plates[0].origin = [1e9, 0]; }, 'invalid'],
    ['origen no numérico', (c) => { c.plates[0].origin = ['0', 0]; }, 'invalid'],
    ['cama negativa', (c) => { (c.plates[1].bed as Record<string, unknown>).widthMm = -5; }, 'invalid'],
    ['cama gigante', (c) => { (c.plates[1].bed as Record<string, unknown>).depthMm = 1e7; }, 'invalid'],
    ['campo extra en la cama', (c) => { (c.plates[1].bed as Record<string, unknown>).nozzle = 0.4; }, 'invalid'],
    ['nombre larguísimo', (c) => { c.plates[0].name = 'x'.repeat(500); }, 'invalid'],
    ['id vacío', (c) => { c.plates[0].id = ''; }, 'invalid'],
    ['locked no booleano', (c) => { c.plates[0].locked = 'sí'; }, 'invalid'],
    ['placas que no son lista', (c) => { (c as unknown as Record<string, unknown>).plates = { p1: {} }; }, 'invalid'],
    ['demasiadas placas', (c) => { c.plates = Array.from({ length: MAX_PLATES + 1 }, (_, i) => ({ id: `p${i}`, name: 'p', origin: [i, 0] })); }, 'too-large'],
  ];
  it.each(malformed)('rechaza una placa malformada: %s', (_label, edit, code) => {
    const bytes = repackKura(encodeProject(withPlates()), 4, (m) => edit(m.current as unknown as Plates));
    expect(() => decodeProject(bytes)).toThrowError(expect.objectContaining({ code }));
  });
});

describe('índice de placa virtual de Dividir', () => {
  const splitPart = (plate: number) => obj('s', {
    metadata: {
      split: {
        groupId: 'g', code: 'A1', cell: [0, 0, 0], assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
        print: { position: [0, 0, 0], rotation: [0, 0, 0], plate, downFace: '-y' }, jointLabels: [],
      },
    },
  } as Partial<SceneObject>);

  it('un índice dentro del tope abre bien', () => {
    expect(decodeProject(encodeProject(doc([splitPart(MAX_SPLIT_PLATES - 1)]))).objects[0].metadata?.split?.print.plate).toBe(MAX_SPLIT_PLATES - 1);
  });

  it('un archivo malicioso con un índice de placa enorme se rechaza', () => {
    for (const plate of [MAX_SPLIT_PLATES, 2 ** 31, Number.MAX_SAFE_INTEGER]) {
      const bytes = repackKura(encodeProject(doc([splitPart(0)])), ROLE_FORMAT_VERSION, (m) => {
        const objects = (m.current as unknown as { objects: Array<{ metadata: { split: { print: { plate: number } } } }> }).objects;
        objects[0].metadata.split.print.plate = plate;
      });
      expect(() => decodeProject(bytes)).toThrowError(expect.objectContaining({ code: 'invalid' }));
    }
  });
});

describe('borrador de recuperación con placas', () => {
  it('conserva placas y plateRef, y sanea referencias rotas', async () => {
    const original = doc([obj('a', { plateRef: 'p2' }), obj('b', { plateRef: 'rota' })], { plates: PLATES });
    const { manifest, blocks } = await splitDocument(original);
    const back = assembleDocument(JSON.parse(JSON.stringify(manifest)), new Map([...blocks].map(([k, b]) => [k, b.words])));
    expect(back.plates).toEqual(PLATES);
    expect(back.objects.map((o) => o.plateRef)).toEqual(['p2', 'p1']);
  });
});
