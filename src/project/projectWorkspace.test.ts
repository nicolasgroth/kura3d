import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportSceneTo3MF, exportSceneToBinarySTL } from '../engine';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import { decodeProject } from './projectCodec';
import { openProjectFile, saveProjectFile } from './projectFiles';

vi.mock('./projectFiles', () => ({ openProjectFile: vi.fn(), saveProjectFile: vi.fn() }));

describe('local project workspace', () => {
  const get = useKuraStore.getState;
  let emptyBaseline: ReturnType<typeof get>;
  let baseline: ReturnType<typeof get>;

  async function requestedBytes() {
    const data = vi.mocked(saveProjectFile).mock.lastCall![1];
    return typeof data === 'function' ? await data() : data;
  }

  beforeAll(async () => {
    await get().initEngine();
    emptyBaseline = get();
    await get().createStarterCube();
    baseline = get();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    useKuraStore.setState(baseline, true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts clean with no objects and adds the example in one reversible operation', async () => {
    expect(emptyBaseline.engineReady).toBe(true);
    expect(emptyBaseline.objects).toEqual([]);
    expect(isProjectDirty(emptyBaseline)).toBe(false);
    useKuraStore.setState(emptyBaseline, true);
    await get().createStarterCube();
    expect(get().objects).toHaveLength(1);
    expect(get().objects[0].stats.dimensionsMm).toEqual([30, 30, 30]);
    expect(get().past).toHaveLength(1);
    get().undo();
    expect(get().objects).toEqual([]);
  });

  it('imports multiple model files together and leaves no partial result after a file error', async () => {
    const bytes = new Uint8Array(exportSceneToBinarySTL(baseline.objects));
    const model = (name: string) => ({ name, read: async () => bytes.buffer });
    useKuraStore.setState(emptyBaseline, true);

    expect(await get().importModelFiles([
      model('base.stl'), { name: 'roto.stl', read: async () => { throw new Error('No legible'); } },
    ])).toBe(false);
    expect(get().objects).toEqual([]);
    expect(get().past).toEqual([]);
    expect(await get().importModelFiles([model('base.stl'), model('tapa.STL')])).toBe(true);
    expect(get().objects).toHaveLength(2);
    expect(get().selectedIds).toHaveLength(2);
    expect(get().past).toHaveLength(1);
    get().undo();
    expect(get().objects).toEqual([]);
  });

  it('keeps objects, selection and history intact when a batch includes unusable geometry', async () => {
    const valid = new Uint8Array(exportSceneToBinarySTL(baseline.objects));
    const nonFinite = valid.slice();
    new DataView(nonFinite.buffer).setFloat32(96, Number.NaN, true);
    const degenerate = new Uint8Array(134);
    new DataView(degenerate.buffer).setUint32(80, 1, true);

    for (const malformed of [nonFinite, degenerate]) {
      expect(await get().importModelFiles([
        { name: 'base.stl', read: async () => valid.buffer },
        { name: 'roto.stl', read: async () => malformed.buffer },
      ])).toBe(false);
      expect(get().objects).toBe(baseline.objects);
      expect(get().selectedIds).toBe(baseline.selectedIds);
      expect(get().past).toBe(baseline.past);
      expect(get().future).toBe(baseline.future);
    }
  });

  it('accepts an open OBJ surface and a 3MF in the same reversible batch', async () => {
    const obj = new TextEncoder().encode('v 0 0 0\nv 3 0 0\nv 0 3 0\nf 1 2 3\n');
    const threeMf = new Uint8Array(exportSceneTo3MF(baseline.objects, 'mm', 'generic'));
    useKuraStore.setState(emptyBaseline, true);

    expect(await get().importModelFiles([
      { name: 'plano.OBJ', read: async () => obj.buffer },
      { name: 'cubo.3mf', read: async () => threeMf.buffer },
    ])).toBe(true);
    expect(get().objects.map((object) => object.stats.triangles)).toEqual([1, 12]);
    get().undo();
    expect(get().objects).toEqual([]);
  });

  it('saves and reopens the scene with a redo step, metadata, selection and units', async () => {
    const [cube] = get().objects;
    get().setUnitSystem('cm');
    get().updateObjectMeta(cube.id, { name: 'Tapa', color: '#ff8210' });
    get().setObjectTransform(cube.id, { position: [22, 0, 17] }, true);
    get().undo();
    vi.mocked(saveProjectFile).mockResolvedValue({ name: 'Tapa.kura', location: 'chosen-file' });
    expect(await get().saveProject()).toBe(true);
    const bytes = await requestedBytes();
    expect(isProjectDirty(get())).toBe(false);
    expect(get().newProject()).toBe(true);
    expect(get().objects).toHaveLength(0);

    vi.mocked(openProjectFile).mockResolvedValue({ name: 'Tapa.kura', location: 'reopened-file', bytes });
    expect(await get().openProject()).toBe(true);
    expect(get().projectName).toBe('Tapa.kura');
    expect(get().unitSystem).toBe('cm');
    expect(get().objects[0]).toMatchObject({ id: cube.id, name: 'Tapa', color: '#ff8210' });
    expect(get().selectedIds).toEqual([cube.id]);
    expect(get().objects[0].mesh.positions).toEqual(cube.mesh.positions);
    get().redo();
    expect(get().objects[0].position).toEqual([22, 0, 17]);
    expect(isProjectDirty(get())).toBe(true);
    get().undo();
    expect(isProjectDirty(get())).toBe(false);
    get().redo();

    await get().saveProject();
    expect(vi.mocked(saveProjectFile).mock.lastCall?.[2]).toBe('reopened-file');
    await get().saveProject(true);
    expect(vi.mocked(saveProjectFile).mock.lastCall?.[2]).toBeUndefined();
  });

  it('preserves the active document after a corrupt file, cancellation or denied replacement', async () => {
    vi.mocked(saveProjectFile).mockResolvedValueOnce({ name: 'Original.kura' });
    await get().saveProject();
    const bytes = await requestedBytes();
    const [cube] = get().objects;
    get().updateObjectMeta(cube.id, { name: 'Sin guardar' });
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });

    vi.mocked(openProjectFile)
      .mockResolvedValueOnce({ name: 'Dañado.kura', bytes: new Uint8Array([7, 7]) })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: 'Original.kura', bytes });
    expect(await get().openProject()).toBe(false);
    expect(await get().openProject()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(await get().openProject()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(get().objects[0].name).toBe('Sin guardar');
    expect(get().projectName).toBe('Original.kura');
    expect(get().projectBusy).toBe(false);
    expect(isProjectDirty(get())).toBe(true);
  });

  it('keeps edits made during a pending save dirty and a failed save recoverable', async () => {
    const [cube] = get().objects;
    let complete!: (result: { name: string }) => void;
    vi.mocked(saveProjectFile).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    get().updateObjectMeta(cube.id, { name: 'Antes de guardar' });
    const saving = get().saveProject();
    await vi.waitFor(() => expect(saveProjectFile).toHaveBeenCalledOnce());
    const bytes = await requestedBytes();
    get().updateObjectMeta(cube.id, { name: 'Edición durante guardado' });
    expect(get().newProject()).toBe(false);
    complete({ name: 'Escena.kura' });
    expect(await saving).toBe(true);
    expect(decodeProject(bytes).objects[0].name).toBe('Antes de guardar');
    expect(isProjectDirty(get())).toBe(true);

    vi.mocked(saveProjectFile).mockRejectedValueOnce(new Error('Disco lleno'));
    expect(await get().saveProject()).toBe(false);
    expect(get().projectName).toBe('Escena.kura');
    expect(get().objects[0].name).toBe('Edición durante guardado');
    expect(get().projectBusy).toBe(false);
    expect(isProjectDirty(get())).toBe(true);
  });

  it('keeps discard protection when the browser only requests a download', async () => {
    get().updateObjectMeta(get().objects[0].id, { name: 'Versión única' });
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });
    vi.mocked(saveProjectFile).mockResolvedValueOnce({ name: 'Escena.kura', viaDownload: true });

    expect(await get().saveProject()).toBe(true);
    expect(isProjectDirty(get())).toBe(true);
    expect(get().newProject()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(get().objects[0].name).toBe('Versión única');
  });
});
