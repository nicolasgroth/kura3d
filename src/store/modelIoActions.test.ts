/**
 * @file src/store/modelIoActions.test.ts
 * @description Pruebas de las acciones de importación/exportación del store: colocación original
 * vs. conjunto apoyado, aviso de malla abierta, OBJ con su MTL en el mismo lote y exportación
 * única con nombre del proyecto, alcance y propagación de errores de guardado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cubeMeshXml, modelXml, pack3mf, translate } from '../engine/__tests__/ioFixtures';
import { FileSaveError, saveFileSet } from '../utils/platformBridge';
import { useKuraStore } from './useKuraStore';

vi.mock('../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/platformBridge')>()),
  saveFileSet: vi.fn(),
}));

const get = useKuraStore.getState;
let empty: ReturnType<typeof get>;

const assembly = () => pack3mf({
  '3D/3dmodel.model': modelXml(
    `<object id="1" name="Base">${cubeMeshXml(10)}</object><object id="2" name="Torre">${cubeMeshXml(4)}</object>`,
    `<item objectid="1" transform="${translate(100, 80, 20)}"/><item objectid="2" transform="${translate(103, 83, 30)}"/>`,
  ),
});
const file = (name: string, data: ArrayBuffer | string) => ({
  name,
  read: async () => (typeof data === 'string' ? new TextEncoder().encode(data).buffer as ArrayBuffer : data),
});

beforeAll(async () => {
  await get().initEngine();
  empty = get();
});

beforeEach(() => {
  vi.mocked(saveFileSet).mockReset();
  useKuraStore.setState(empty, true);
});

describe('importación desde el store', () => {
  it('conserva la posición y altura originales cuando se pide', async () => {
    expect(await get().importModelFiles([file('conjunto.3mf', assembly())], { placement: 'original' })).toBe(true);
    const [base, torre] = get().objects;
    expect(base.position).toEqual([105, 20, -85]);
    expect(torre.position).toEqual([105, 30, -85]);
  });

  it('por defecto apoya el conjunto en la cama sin perder posiciones relativas', async () => {
    expect(get().importPlacementMode).toBe('bed');
    await get().importModelFiles([file('conjunto.3mf', assembly())]);
    const [base, torre] = get().objects;
    expect(base.position[1]).toBeCloseTo(0, 6);
    expect(torre.position[1] - base.position[1]).toBeCloseTo(10, 6);
    expect(torre.position[0] - base.position[0]).toBeCloseTo(0, 6);
  });

  it('avisa cuando una pieza tiene la malla abierta', async () => {
    await get().importModelFiles([file('plano.obj', 'v 0 0 0\nv 3 0 0\nv 0 3 0\nf 1 2 3\n')]);
    expect(get().toasts.some((toast) => toast.kind === 'info' && toast.text.includes('plano'))).toBe(true);
  });

  it('el aviso de malla abierta ofrece «Reparar malla» y repara ese objeto', async () => {
    const repairObjectMesh = vi.fn(async () => null);
    useKuraStore.setState({ repairObjectMesh });
    await get().importModelFiles([file('plano.obj', 'v 0 0 0\nv 3 0 0\nv 0 3 0\nf 1 2 3\n')]);
    const toast = get().toasts.find((item) => item.kind === 'info' && item.text.includes('plano'));
    expect(toast?.action?.label).toBe('Reparar malla');
    toast!.action!.run();
    expect(repairObjectMesh).toHaveBeenCalledExactlyOnceWith(get().objects[0].id);
  });

  it('con varias piezas abiertas el aviso no ofrece una reparación ambigua', async () => {
    const tri = 'v 0 0 0\nv 3 0 0\nv 0 3 0\nf 1 2 3\n';
    await get().importModelFiles([file('a.obj', tri), file('b.obj', tri)]);
    const toast = get().toasts.find((item) => item.kind === 'info' && item.text.includes('a'));
    expect(toast).toBeTruthy();
    expect(get().toasts.filter((item) => item.action?.label === 'Reparar malla')).toHaveLength(0);
  });

  it('aplica los colores del MTL que acompaña al OBJ en el mismo lote', async () => {
    const obj = 'mtllib colores.mtl\no Pieza\nv 0 0 0\nv 3 0 0\nv 0 3 0\nv 0 0 3\nusemtl rojo\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4\n';
    await get().importModelFiles([file('pieza.obj', obj), file('colores.mtl', 'newmtl rojo\nKd 1 0 0\n')]);
    expect(get().objects).toHaveLength(1);
    expect(get().objects[0].color).toBe('#ff0000');
  });
});

describe('exportación desde el store', () => {
  beforeEach(async () => {
    await get().createPrimitive('box', { width: 10, height: 10, depth: 10 });
    await get().createPrimitive('sphere', { radius: 5 });
    useKuraStore.setState({ projectName: 'Soporte cámara.kura' });
  });

  it('usa el nombre del proyecto y exporta OBJ con su MTL', async () => {
    vi.mocked(saveFileSet).mockResolvedValue(true);
    expect(await get().exportModel({ format: 'obj', scope: 'scene' })).toBe(true);
    const entries = vi.mocked(saveFileSet).mock.calls[0][0];
    expect(entries.map((e) => e.name)).toEqual(['Soporte_cámara.obj', 'Soporte_cámara.mtl']);
    expect(new TextDecoder().decode(entries[0].data)).toContain('mtllib Soporte_cámara.mtl');
  });

  it('proyecto sin nombre: la escena se exporta con el nombre visible del proyecto, no uno genérico', async () => {
    vi.mocked(saveFileSet).mockResolvedValue(true);
    useKuraStore.setState({ projectName: null, language: 'es' });
    expect(await get().exportModel({ format: 'stl', scope: 'scene' })).toBe(true);
    const [entry] = vi.mocked(saveFileSet).mock.calls.at(-1)![0];
    expect(entry.name).toBe('Escena_sin_título.stl');
  });

  it('exporta solo la selección cuando se pide y respeta el nombre elegido', async () => {
    vi.mocked(saveFileSet).mockResolvedValue(true);
    const [box] = get().objects;
    useKuraStore.setState({ selectedIds: [box.id] });
    await get().exportModel({ format: 'stl', scope: 'selection', fileName: 'tapa/v2' });
    const [entry] = vi.mocked(saveFileSet).mock.calls[0][0];
    expect(entry.name).toBe('tapa_v2.stl');
    expect(new DataView(entry.data.buffer, entry.data.byteOffset).getUint32(80, true)).toBe(box.stats.triangles);
  });

  it('un grupo: un archivo con todo (por defecto) o un ZIP con un archivo por objeto', async () => {
    vi.mocked(saveFileSet).mockResolvedValue(true);
    const [box, sphere] = get().objects;
    get().groupObjects([box.id, sphere.id], 'Base');
    await get().exportModel({ format: 'stl', scope: 'selection', fileName: 'base' });
    expect(vi.mocked(saveFileSet).mock.calls[0][0].map((e) => e.name)).toEqual(['base.stl']);
    await get().exportModel({ format: 'stl', scope: 'selection', fileName: 'base', perObject: true });
    const [zip] = vi.mocked(saveFileSet).mock.calls[1][0];
    expect(zip.name).toBe('base.zip');
    const text = new TextDecoder('latin1').decode(zip.data);
    expect(text).toMatch(/_Base_-_/);
  });

  it('informa el fallo de guardado y devuelve false', async () => {
    vi.mocked(saveFileSet).mockRejectedValue(new FileSaveError('Soporte_cámara.3mf', new Error('disco lleno')));
    expect(await get().exportModel({ format: '3mf', scope: 'scene' })).toBe(false);
    expect(get().toasts.some((toast) => toast.kind === 'error' && toast.text.includes('disco lleno'))).toBe(true);
  });
});
