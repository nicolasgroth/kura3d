/**
 * @file src/store/__tests__/platesRoundTrip3mf.store.test.ts
 * @description P7: el 3MF de escena exportado por la app con placas reales vuelve con sus placas (nombre, origen y cama
 * propia) y cada pieza en la suya; metadatos de placas hostiles (demasiadas, índices fuera de rango, camas inválidas)
 * descartan los metadatos; una importación con placas de un laminador ofrece «Convertir en placas» y la acción las
 * vuelve placas reales en un paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseModelFile } from '../../engine';
import { parseKuraSceneMeta } from '../../engine/io/kuraSceneMeta';
import { MAX_PLATES } from '../../core/scene/plates';
import { overlappingPlates } from '../../core/scene/plateOverlap';
import { projectBed } from '../../core/scene/activePlateBed';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { saveFileSet } from '../../utils/platformBridge';
import { historyTimeline } from '../historyLabels';
import { isKuraScene, restoreKuraScene } from '../kuraSceneRestore';
import { isPlateGroupName } from '../plateGroupNames';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const savedBytes = () => vi.mocked(saveFileSet).mock.calls.at(-1)![0][0].data;
const toBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('3MF de escena con placas reales (P7)', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, projectName: null });
    vi.mocked(saveFileSet).mockClear();
  });

  it('ida y vuelta: vuelven las placas con su cama y cada pieza en la suya, en su lugar de mundo', async () => {
    const a = await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate({ name: 'Cabeza' })!;
    const b = await addBox(20, [p2.origin[0] + 15, 0, -5], { name: 'B' });
    store().setPlateBed(p2.id, { profileId: 'bambu-a1-mini', name: 'A1 mini', widthMm: 180, depthMm: 180, heightMm: 180 });
    const plates = store().plates;
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const model = parseModelFile('x.3mf', toBuffer(savedBytes()));
    expect(isKuraScene(model)).toBe(true);
    const restored = restoreKuraScene(model, (p) => buildSceneObject({ ...p, source: 'imported' }), [0, 0, 0], false, true);
    expect(restored.plates.map((p) => ({ name: p.name, origin: p.origin, bed: p.bed }))).toEqual(plates.map((p) => ({ name: p.name, origin: p.origin, bed: p.bed })));
    const backA = restored.objects.find((o) => o.name === 'A')!;
    const backB = restored.objects.find((o) => o.name === 'B')!;
    expect(backA.plateRef).toBe(restored.plates[0].id);
    expect(backB.plateRef).toBe(restored.plates[1].id);
    expect(backB.position[0]).toBeCloseTo(byId(b.id)!.position[0], 6);
    expect(backA.position[0]).toBeCloseTo(byId(a.id)!.position[0], 6);
    // Sin pedirlo (escena ocupada), las placas no vuelven y las piezas quedan sin placa.
    const plain = restoreKuraScene(model, (p) => buildSceneObject({ ...p, source: 'imported' }));
    expect(plain.plates).toEqual([]);
    expect(plain.objects.every((o) => o.plateRef === undefined)).toBe(true);
  });

  it('abrir el 3MF en una escena vacía con el store real restaura las placas en el mismo paso de importar', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    await addBox(20, [p2.origin[0], 0, 0], { name: 'B' });
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const bytes = savedBytes();
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print' });
    const ok = await store().importModelFiles([{ name: 'x.3mf', size: bytes.byteLength, read: async () => toBuffer(bytes) }]);
    expect(ok).toBe(true);
    expect(store().plates).toHaveLength(2);
    expect(store().objects.find((o) => o.name === 'B')!.plateRef).toBe(store().plates[1].id);
    store().undo();
    expect(store().plates).toEqual([]);
    expect(store().objects).toEqual([]);
  });
});

describe('metadatos de placas hostiles', () => {
  const valid = () => ({
    namespace: 'urn:kura:3mf:scene:1',
    objects: [{ objectId: '2', name: 'a', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', visible: true, locked: false, vertices: 3, triangles: 1, plate: 0 }],
    groups: [] as unknown[],
    plates: [{ name: 'Placa 1', origin: [0, 0], bed: { name: 'Mini', widthMm: 180, depthMm: 180, heightMm: 180 } }] as unknown[],
  });
  const parse = (v: unknown) => parseKuraSceneMeta(JSON.stringify(v), 10);

  it('acepta lo válido', () => {
    const meta = parse(valid())!;
    expect(meta.plates).toHaveLength(1);
    expect(meta.objects[0].plate).toBe(0);
  });

  it.each([
    ['índice de placa fuera de rango', (v: ReturnType<typeof valid>) => { v.objects[0].plate = 3; }],
    ['índice de placa negativo', (v: ReturnType<typeof valid>) => { v.objects[0].plate = -1; }],
    ['índice no entero', (v: ReturnType<typeof valid>) => { v.objects[0].plate = 0.5; }],
    ['demasiadas placas', (v: ReturnType<typeof valid>) => { v.plates = Array.from({ length: MAX_PLATES + 1 }, () => ({ name: 'p', origin: [0, 0] })); }],
    ['placas que no son lista', (v: ReturnType<typeof valid>) => { (v as Record<string, unknown>).plates = { a: 1 }; }],
    ['origen fuera de límites', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: 'p', origin: [1e12, 0] }; }],
    ['nombre vacío', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: ' ', origin: [0, 0] }; }],
    ['cama de 0 mm', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: 'p', origin: [0, 0], bed: { name: 'x', widthMm: 0, depthMm: 1, heightMm: 1 } }; }],
    ['cama de más de 10 m', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: 'p', origin: [0, 0], bed: { name: 'x', widthMm: 10_001, depthMm: 1, heightMm: 1 } }; }],
    ['cama con texto', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: 'p', origin: [0, 0], bed: { name: 'x', widthMm: '1', depthMm: 1, heightMm: 1 } }; }],
    ['perfil larguísimo', (v: ReturnType<typeof valid>) => { v.plates[0] = { name: 'p', origin: [0, 0], bed: { profileId: 'x'.repeat(65), name: 'x', widthMm: 1, depthMm: 1, heightMm: 1 } }; }],
  ])('descarta los metadatos: %s', (_label, edit) => {
    const v = valid();
    edit(v);
    expect(parse(v)).toBeNull();
  });

  it('recorta nombres largos de placa y de cama', () => {
    const v = valid();
    v.plates[0] = { name: 'n'.repeat(500), origin: [0, 0], bed: { name: 'b'.repeat(500), widthMm: 100, depthMm: 100, heightMm: 100 } };
    const p = parse(v)!.plates![0];
    expect(p.name).toHaveLength(80);
    expect(p.bed!.name).toHaveLength(80);
  });
});

describe('convertir grupos en placas en el store (P7)', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('reconoce nombres de placa en los 6 idiomas y el «Plate_N» de los laminadores', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) expect(isPlateGroupName(t(lang, 'importReal.plateName', { n: 7 }))).toBe(true);
    expect(isPlateGroupName('Plate_3')).toBe(true);
    expect(isPlateGroupName('Cuerpo')).toBe(false);
    expect(isPlateGroupName('Placa 1 copia')).toBe(false);
  });

  it('grupos «Placa N» de un proyecto importado: placas reales en un paso, con su nombre en el historial', async () => {
    const a = await addBox(20, [0, 0, 0], { name: 'A' });
    const b = await addBox(20, [300, 0, 0], { name: 'B' });
    const c = await addBox(20, [330, 0, 0], { name: 'C' });
    const name = (n: number) => t('es', 'importReal.plateName', { n });
    useKuraStore.setState({
      groups: [
        { id: 'g1', name: name(1), visible: true, locked: false, collapsed: false },
        { id: 'g2', name: name(2), visible: true, locked: false, collapsed: false },
      ],
      objects: store().objects.map((o) => ({ ...o, groupRef: o.id === a.id ? 'g1' : 'g2' })),
      selectedIds: [],
    });
    const steps = store().past.length;
    const result = store().convertGroupsToPlates()!;
    expect(result.created).toHaveLength(2);
    expect(store().past.length).toBe(steps + 1);
    expect(store().plates.map((p) => p.name)).toEqual([name(1), name(2)]);
    expect(overlappingPlates(store().plates, projectBed(store()))).toEqual([]);
    expect(byId(b.id)!.plateRef).toBe(store().plates[1].id);
    expect(byId(c.id)!.position[0] - byId(b.id)!.position[0]).toBeCloseTo(30);
    // Los grupos «Placa N» del importador se disuelven: la placa ya lleva ese nombre.
    expect(store().groups).toEqual([]);
    expect(store().objects.every((o) => o.groupRef === undefined)).toBe(true);
    const labels = historyTimeline('es', store(), 50).entries.map((e) => e.label);
    expect(labels).toContain(t('es', 'plates.history.convert', { count: 2 }));
    store().undo();
    expect(store().plates).toEqual([]);
    expect(byId(b.id)!.position[0]).toBeCloseTo(300);
    expect(store().groups.map((g) => g.name)).toEqual([name(1), name(2)]);
    expect(byId(a.id)!.groupRef).toBe('g1');
  });

  it('un grupo del usuario no se disuelve al convertirlo; uno de placa sí, y con `dissolve` también el de nombre propio', async () => {
    const a = await addBox(20, [0, 0, 0], { name: 'A' });
    const b = await addBox(20, [300, 0, 0], { name: 'B' });
    const grp = (id: string, name: string) => ({ id, name, visible: true, locked: false, collapsed: false });
    useKuraStore.setState({
      groups: [grp('g1', 'Mi cuerpo'), grp('g2', t('es', 'importReal.plateName', { n: 2 }))],
      objects: store().objects.map((o) => ({ ...o, groupRef: o.id === a.id ? 'g1' : 'g2' })), selectedIds: [],
    });
    store().convertGroupsToPlates(['g1', 'g2']);
    expect(store().groups.map((g) => g.id)).toEqual(['g1']);
    expect(byId(a.id)!.groupRef).toBe('g1');
    expect(byId(b.id)!.groupRef).toBeUndefined();
    store().undo();
    store().convertGroupsToPlates(['g1'], { dissolve: true });
    expect(store().groups.map((g) => g.id)).toEqual(['g2']);
    expect(byId(a.id)!.groupRef).toBeUndefined();
  });

  it('en Armado no convierte y lo dice', async () => {
    await addBox(20, [0, 0, 0], { name: 'A' });
    useKuraStore.setState({ layout: 'assembly' });
    expect(store().convertGroupsToPlates(['x'])).toBeNull();
    expect(store().toasts.some((x) => x.text === t('es', 'plates.convert.assembly'))).toBe(true);
  });
});
