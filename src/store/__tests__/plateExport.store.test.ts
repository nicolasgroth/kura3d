/**
 * @file src/store/__tests__/plateExport.store.test.ts
 * @description Exportar con placas (lote P6) con el motor real: la misma pieza en la placa 1 y en la 2 da el mismo
 * STL y los mismos vértices de 3MF respecto de la cama; dos placas en STL dan un ZIP con un archivo por placa; un
 * 3MF con todas las placas (placas reales, no los grupos) con cada pieza dentro de su cama, o un 3MF por placa en
 * ZIP; lo que no tiene placa se excluye con aviso; sin placas los archivos son idénticos a los de siempre; la ida y
 * vuelta del 3MF de escena devuelve cada pieza a su lugar de mundo; en el 3MF con todas las placas cada ítem va en la
 * celda de su placa del laminador y una placa con cama propia de otro tamaño avisa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND } from '../../brand';
import { exportSceneTo3MF, exportSceneToBinarySTL, parseModelFile, stlBrandHeader } from '../../engine';
import { isPrintable, isReference } from '../../core/scene/objectRole';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { saveFileSet } from '../../utils/platformBridge';
import { isKuraScene, restoreKuraScene } from '../kuraSceneRestore';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const lastSaved = () => vi.mocked(saveFileSet).mock.calls.at(-1)![0];
const savedBytes = () => lastSaved()[0].data;
const half = () => store().printerProfile.bedWidthMm / 2;
const t2 = (key: Parameters<typeof t>[1], params: Record<string, string | number>) => t('es', key, params);

/** Triángulos de un STL binario (sin la cabecera). */
const stlTriangles = (bytes: Uint8Array) => Array.from(bytes.subarray(84));

/** Coordenadas [x, y, z] de todos los vértices del modelo de un 3MF. */
function threeMfVertices(bytes: Uint8Array): number[][] {
  const model = strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
  return [...model.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
}

const plateNames = (bytes: Uint8Array) =>
  [...strFromU8(unzipSync(bytes)['Metadata/model_settings.config']).matchAll(/plater_name" value="([^"]*)"/g)].map((m) => m[1]);

/** Todos los vértices de un STL binario dentro de la cama centrada en el origen (X e Y de archivo). */
function stlInsideBed(bytes: Uint8Array, h: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(80, true);
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 3; v++) {
      const at = 84 + i * 50 + 12 + v * 12;
      if (Math.abs(view.getFloat32(at, true)) > h + 1e-3 || Math.abs(view.getFloat32(at + 4, true)) > h + 1e-3) return false;
    }
  }
  return n > 0;
}

describe('exportar con placas', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, projectName: null });
    vi.mocked(saveFileSet).mockClear();
  });

  it('la misma pieza en la placa 1 y en la 2 da el mismo STL y los mismos vértices de 3MF', async () => {
    const a = await addBox(20, [5, 0, -7], { name: 'A' });
    const p2 = store().createPlate()!;
    store().setSelection([a.id]);
    expect(await store().exportModel({ format: 'stl', scope: 'selection', fileName: 'x' })).toBe(true);
    const stl1 = savedBytes();
    expect(await store().exportModel({ format: '3mf', scope: 'selection', fileName: 'x' })).toBe(true);
    const v1 = threeMfVertices(savedBytes());
    expect(store().moveToPlate(p2.id, [a.id])).toBe(1);
    expect(byId(a.id)!.position[0]).toBeGreaterThan(200);
    expect(await store().exportModel({ format: 'stl', scope: 'selection', fileName: 'x' })).toBe(true);
    expect(stlTriangles(savedBytes())).toEqual(stlTriangles(stl1));
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(threeMfVertices(savedBytes())).toEqual(v1);
  });

  it('dos placas en STL: un ZIP con un archivo por placa, cada uno con sus piezas en su cama', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate({ name: 'Placa: dos/«B»' })!;
    await addBox(30, [p2.origin[0] + 50, 0, 0], { name: 'B' });
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'proyecto' })).toBe(true);
    expect(lastSaved()[0].name).toBe('proyecto.zip');
    const files = unzipSync(savedBytes());
    const names = Object.keys(files).sort();
    expect(names).toEqual(['Placa_1.stl', 'Placa_dos_«B».stl'].sort());
    for (const n of names) {
      expect(n).not.toMatch(/[\\/:*?"<>|]/);
      expect(stlInsideBed(files[n], half())).toBe(true);
    }
    expect(store().toasts.some((x) => x.text === t('es', 'export.plates.zipDone', { count: 2, name: 'proyecto.zip' }))).toBe(true);
  });

  it('3MF con todas las placas: las placas reales mandan sobre los grupos y cada pieza queda dentro de su cama', async () => {
    const a = await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    const b = await addBox(20, [p2.origin[0] - 20, 0, 30], { name: 'B' });
    // Dos grupos raíz que no coinciden con las placas: no deben volverse placas del laminador.
    useKuraStore.setState({
      groups: [
        { id: 'g1', name: 'Grupo X', visible: true, locked: false, collapsed: false },
        { id: 'g2', name: 'Grupo Y', visible: true, locked: false, collapsed: false },
      ],
      objects: store().objects.map((o) => ({ ...o, groupRef: o.id === a.id ? 'g1' : 'g2' })),
    });
    expect(byId(b.id)!.plateRef).toBe(p2.id);
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(lastSaved()[0].name).toBe('x.3mf');
    const bytes = savedBytes();
    expect(plateNames(bytes)).toEqual(store().plates.map((p) => p.name));
    for (const [x, y] of threeMfVertices(bytes)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(half());
      expect(Math.abs(y)).toBeLessThanOrEqual(half());
    }
    // Un 3MF por placa (ZIP).
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x', plateMode: 'perPlate' })).toBe(true);
    expect(lastSaved()[0].name).toBe('x.zip');
    expect(Object.keys(unzipSync(savedBytes())).sort()).toEqual(['Placa_1.3mf', 'Placa_2.3mf']);
  });

  it('lo que no tiene placa se excluye con aviso', async () => {
    const a = await addBox(20, [10, 0, 0], { name: 'A' });
    store().createPlate();
    const b = await addBox(20, [-60, 0, 0], { name: 'Suelta' });
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === b.id ? { ...o, plateRef: undefined } : o)) });
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(lastSaved()[0].name).toBe('x.stl');
    const only = exportSceneToBinarySTL([byId(a.id)!], stlBrandHeader(BRAND));
    expect(savedBytes()).toEqual(only);
    expect(store().toasts.some((x) => x.text === t('es', 'export.plates.excluded', { count: 1 }))).toBe(true);
  });

  it('sin placas: los archivos son idénticos a los de siempre', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    await addBox(15, [-40, 0, 25], { name: 'B' });
    const printable = () => store().objects.filter(isPrintable);
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(savedBytes()).toEqual(exportSceneToBinarySTL(printable(), stlBrandHeader(BRAND)));
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const full = store().objects.filter((o) => !isReference(o));
    const bed = { widthMm: store().printerProfile.bedWidthMm, depthMm: store().printerProfile.bedDepthMm };
    expect(savedBytes()).toEqual(exportSceneTo3MF(full, 'mm', undefined, BRAND, { groups: [] }, undefined, undefined, bed));
  });

  it('3MF con todas las placas: cada ítem en la celda de su placa del laminador y aviso por la cama propia', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate({ name: 'Mini' })!;
    await addBox(20, [p2.origin[0] - 20, 0, 30], { name: 'B' });
    store().setPlateBed(p2.id, { profileId: 'bambu-a1-mini', name: 'A1 mini', widthMm: 180, depthMm: 180, heightMm: 180 });
    const b = store().objects.find((o) => o.name === 'B')!;
    const relB = [b.position[0] - store().plates[1].origin[0], b.position[2] - store().plates[1].origin[1]];
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const model = strFromU8(unzipSync(savedBytes())['3D/3dmodel.model']);
    const t = [...model.matchAll(/<item objectid="\d+" transform="([^"]+)"/g)].map((m) => m[1].split(' ').map(Number));
    const { bedWidthMm: w, bedDepthMm: d } = store().printerProfile;
    expect(t).toHaveLength(2);
    expect([t[0][9], t[0][10], t[0][11]]).toEqual([w / 2, d / 2, 0]);
    expect(t[1][9]).toBeCloseTo(1.2 * w + w / 2, 4);
    expect(t[1][10]).toBeCloseTo(d / 2, 4);
    // La pieza de la placa con cama propia queda en la misma posición respecto del centro de su celda.
    const objB = [...model.matchAll(/<object id="\d+"[\s\S]*?<\/object>/g)][1][0];
    const vB = [...objB.matchAll(/<vertex x="([^"]+)"/g)].map((m) => [Number(m[1])]);
    const cx = (Math.min(...vB.map((v) => v[0])) + Math.max(...vB.map((v) => v[0]))) / 2;
    expect(cx).toBeCloseTo(relB[0], 4);
    expect(store().toasts.some((x) => x.text === t2('export.plates.otherBed', { names: '«Mini»', count: 1, w: Math.round(w), d: Math.round(d) }))).toBe(true);
  });

  it('una sola placa en el origen tampoco cambia nada', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    useKuraStore.setState({ plates: [{ id: 'solo', name: 'Placa 1', origin: [0, 0] }], objects: store().objects.map((o) => ({ ...o, plateRef: 'solo' })) });
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(savedBytes()).toEqual(exportSceneToBinarySTL(store().objects.filter(isPrintable), stlBrandHeader(BRAND)));
  });

  it('ida y vuelta del 3MF de escena: cada pieza vuelve a su lugar de mundo', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    const b = await addBox(20, [p2.origin[0] + 15, 0, -5], { name: 'B' });
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const bytes = savedBytes();
    const model = parseModelFile('x.3mf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(isKuraScene(model)).toBe(true);
    const restored = restoreKuraScene(model, (p) => buildSceneObject({ ...p, source: 'imported' }));
    const back = restored.objects.find((o) => o.name === 'B')!;
    expect(back.position[0]).toBeCloseTo(byId(b.id)!.position[0], 6);
    expect(back.position[2]).toBeCloseTo(byId(b.id)!.position[2], 6);
  });
});

describe('export_stl / export_3mf del bus con placas', () => {
  const run = (command: string, params: Record<string, unknown>) =>
    store().executeCommand({ id: 'exp', command: command as never, params }, 'mcp') as Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }>;
  const bytesOf = (res: { result?: Record<string, unknown> }) => Uint8Array.from(atob(String(res.result!.bytesBase64)), (c) => c.charCodeAt(0));

  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('STL con piezas de dos placas pide plateId; con plateId exporta esa placa respecto de su cama', async () => {
    const a = await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    await addBox(20, [p2.origin[0] + 10, 0, 0], { name: 'B' });
    const fail = await run('export_stl', { returnBytes: true });
    expect(fail.ok).toBe(false);
    const ok = await run('export_stl', { returnBytes: true, plateId: p2.id });
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    expect(stlTriangles(bytesOf(ok))).toEqual(stlTriangles(exportSceneToBinarySTL([byId(a.id)!], stlBrandHeader(BRAND))));
    const missing = await run('export_stl', { returnBytes: true, plateId: 'nope' });
    expect(missing.ok).toBe(false);
  });

  it('3MF con dos placas: un archivo con las dos placas', async () => {
    await addBox(20, [10, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    await addBox(20, [p2.origin[0] + 10, 0, 0], { name: 'B' });
    const res = await run('export_3mf', { returnBytes: true });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect(plateNames(bytesOf(res))).toHaveLength(2);
    expect(res.result!.plateCount).toBe(2);
  });
});
