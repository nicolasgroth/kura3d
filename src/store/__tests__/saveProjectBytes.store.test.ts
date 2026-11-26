/**
 * @file src/store/__tests__/saveProjectBytes.store.test.ts
 * @description Guardar con el códec real: el archivo es idéntico byte a byte al que da el códec para el mismo
 * proyecto, y después la escena conserva sus mallas (no se transfieren ni se vacían) y deshacer sigue funcionando.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMeshStats } from '../../engine/meshStats';
import { encodeProjectCompressed } from '../../project/projectCodec';
import { compactInfo, infoNow } from '../../project/projectInfo';
import { saveProjectFile } from '../../project/projectFiles';
import type { MeshData, SceneObject } from '../../types/kura';
import { captureProject } from '../projectDocument';
import { useKuraStore } from '../useKuraStore';

vi.mock('../../project/projectFiles', async (importActual) => ({
  ...(await importActual<typeof import('../../project/projectFiles')>()),
  saveProjectFile: vi.fn(),
}));

const get = useKuraStore.getState;
const baseline = get();

function object(): SceneObject {
  const mesh: MeshData = { positions: new Float32Array(30_000).map((_, i) => i % 101), indices: Uint32Array.from({ length: 30_000 }, (_, i) => i % 10_000) };
  return { id: 'a', name: 'pieza', source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#808080',
    role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh) };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-26T12:00:00Z'), toFake: ['Date'] });
  useKuraStore.setState({ ...baseline, engineReady: true, objects: [object()], selectedIds: [], past: [], future: [], toasts: [] }, true);
});
afterEach(() => vi.useRealTimers());

describe('guardar con el códec real', () => {
  it('mismo archivo byte a byte, escena con sus mallas y deshacer intacto', async () => {
    get().updateObjectMeta('a', { name: 'renombrada' });
    expect(get().past.length).toBe(1);
    const state = get();
    const info = compactInfo({ ...state.projectInfo, workSeconds: state.projectWorkSeconds, modifiedAt: infoNow() });
    const expected = await encodeProjectCompressed({ ...captureProject(state), ...(info ? { info } : {}) });

    let written: Uint8Array | undefined;
    vi.mocked(saveProjectFile).mockImplementation(async (name, data) => {
      written = typeof data === 'function' ? await data() : data;
      return { name, location: 'C:/pieza.kura' };
    });
    expect(await get().saveProject()).toBe(true);
    expect(written).toEqual(expected);

    const mesh = get().objects[0].mesh;
    expect(mesh.positions.length).toBe(30_000);
    expect(mesh.positions.buffer.byteLength).toBeGreaterThan(0);
    expect(mesh.indices[29_999]).toBe(9_999);
    get().undo();
    expect(get().objects[0].name).toBe('pieza');
    expect(get().objects[0].mesh.positions.length).toBe(30_000);
  });
});
