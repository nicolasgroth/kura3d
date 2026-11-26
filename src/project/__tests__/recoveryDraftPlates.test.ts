/**
 * @file src/project/__tests__/recoveryDraftPlates.test.ts
 * @description El borrador de recuperación valida placas y `restPose` con el mismo rigor que el `.kura`: rechaza las
 * mismas placas malformadas y poses fuera de forma, sanea igual (ids repetidos, referencias rotas) y, como al abrir
 * un archivo, repara un nombre de placa vacío con uno por defecto sin perder la placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { TRANSFORM_LIMITS } from '../../engine/operationLimits';
import { MAX_PLATES } from '../../core/scene/plates';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { BRAND } from '../../brand';
import { decodeProject, encodeProjectImage, type ProjectDocument } from '../projectCodec';
import { ProjectCodecError } from '../projectSchema';
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
const rest = { position: [10, 20, 30] as [number, number, number], rotation: [0, 1, 0] as [number, number, number] };
const doc = (): ProjectDocument => ({
  objects: [obj('a', { plateRef: 'p1', restPose: rest }), obj('b', { plateRef: 'p2' })], selectedIds: [], past: [], future: [],
  plates: PLATES, layout: 'assembly',
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0,
});

type Scene = { plates: Record<string, unknown>[]; objects: Record<string, unknown>[]; layout?: unknown };

/** Arma el borrador tras editar su escena actual (como si llegara dañado del almacenamiento). */
async function assembleEdited(edit: (scene: Scene) => void) {
  const { manifest, blocks } = await splitDocument(doc());
  const copy = JSON.parse(JSON.stringify(manifest));
  edit(copy.current as Scene);
  return () => assembleDocument(copy, new Map([...blocks].map(([k, b]) => [k, b.words])));
}

const malformedPlates: [string, (s: Scene) => void][] = [
  ['campo desconocido', (c) => { c.plates[0].color = '#fff'; }],
  ['prototipo en la placa', (c) => { c.plates[0] = JSON.parse('{"__proto__":{"x":1},"id":"p1","name":"a","origin":[0,0]}'); }],
  ['origen de tres valores', (c) => { c.plates[0].origin = [0, 0, 0]; }],
  ['origen fuera de los límites', (c) => { c.plates[0].origin = [1e9, 0]; }],
  ['origen no numérico', (c) => { c.plates[0].origin = ['0', 0]; }],
  ['cama negativa', (c) => { (c.plates[1].bed as Record<string, unknown>).widthMm = -5; }],
  ['cama gigante', (c) => { (c.plates[1].bed as Record<string, unknown>).depthMm = 1e7; }],
  ['campo extra en la cama', (c) => { (c.plates[1].bed as Record<string, unknown>).nozzle = 0.4; }],
  ['nombre larguísimo', (c) => { c.plates[0].name = 'x'.repeat(500); }],
  ['id vacío', (c) => { c.plates[0].id = ''; }],
  ['locked no booleano', (c) => { c.plates[0].locked = 'sí'; }],
  ['placas que no son lista', (c) => { (c as unknown as Record<string, unknown>).plates = { p1: {} }; }],
  ['demasiadas placas', (c) => { c.plates = Array.from({ length: MAX_PLATES + 1 }, (_, i) => ({ id: `p${i}`, name: 'p', origin: [i, 0] })); }],
];

const malformedPoses: [string, (s: Scene) => void][] = [
  ['modo de vista desconocido', (c) => { c.layout = 'free'; }],
  ['posición de dos valores', (c) => { c.objects[0].restPose = { position: [1, 2], rotation: [0, 0, 0] }; }],
  ['campo extra en la pose', (c) => { c.objects[0].restPose = { ...rest, extra: 1 }; }],
  ['posición fuera de los límites', (c) => { c.objects[0].restPose = { position: [TRANSFORM_LIMITS.maxAbsCoordinate * 2, 0, 0], rotation: [0, 0, 0] }; }],
  ['rotación no numérica', (c) => { c.objects[0].restPose = { position: [0, 0, 0], rotation: ['0', 0, 0] }; }],
];

describe('borrador de recuperación: placas y poses malformadas', () => {
  it.each(malformedPlates)('rechaza una placa malformada: %s', async (_label, edit) => {
    expect(await assembleEdited(edit)).toThrowError(expect.objectContaining({ code: expect.stringMatching(/invalid|too-large/) }));
  });

  it.each(malformedPoses)('rechaza una pose malformada: %s', async (_label, edit) => {
    expect(await assembleEdited(edit)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });

  it('ida y vuelta conserva placas, poses y modo armado', async () => {
    const back = (await assembleEdited(() => {}))();
    expect(back.plates).toEqual(PLATES);
    expect(back.layout).toBe('assembly');
    expect(back.objects[0].restPose).toEqual(rest);
  });

  it('placas con id repetido se reducen a la primera, como en el .kura', async () => {
    const back = (await assembleEdited((c) => { c.plates.push({ ...c.plates[0], name: 'copia' }); }))();
    expect(back.plates!.map((p) => p.name)).toEqual(['Placa 1', 'Cabeza']);
  });
});

describe('nombre de placa vacío al abrir', () => {
  it('el borrador lo repara con un nombre por defecto y conserva la placa y sus piezas', async () => {
    const back = (await assembleEdited((c) => { c.plates[1].name = '  '; }))();
    expect(back.plates!.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(back.plates![1].name.trim()).not.toBe('');
    expect(back.objects.map((o) => o.plateRef)).toEqual(['p1', 'p2']);
  });

  it('el .kura lo repara igual', () => {
    const bytes = repackKura(encodeProjectImage(doc()), 4, (m) => { (m.current as unknown as Scene).plates[0].name = ''; });
    const back = decodeProject(bytes);
    expect(back.plates!.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(back.plates![0].name).not.toBe('');
  });
});

describe('mensajes de error del códec', () => {
  it('nombran la marca vigente (BRAND), no un literal', () => {
    for (const code of ['invalid', 'unsupported', 'too-large'] as const) {
      expect(new ProjectCodecError(code).message).toContain(BRAND.name);
    }
  });
});
