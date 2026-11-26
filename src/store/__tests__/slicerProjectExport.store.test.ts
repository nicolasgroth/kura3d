/**
 * @file src/store/__tests__/slicerProjectExport.store.test.ts
 * @description Exportar 3MF desde el store con el proyecto de ejemplo del laminador guardado: el archivo lleva
 * `Metadata/project_settings.config` con los identificadores guardados y los colores de la escena; sin ejemplo no lo
 * lleva; un ejemplo guardado dañado se ignora; reimportar el 3MF de escena devuelve placas, nombres y colores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFileSet } from '../../utils/platformBridge';
import { saveSlicerProjectSample, STORAGE_SLICER_PROJECT_KEY } from '../slicerProjectPreference';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const savedBytes = () => vi.mocked(saveFileSet).mock.calls.at(-1)![0][0].data;
const toBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const SAMPLE = { version: '2.3.0', printerSettingsId: 'Bambu Lab A1 0.4 nozzle', printSettingsId: '0.20mm Standard @BBL A1', filamentSettingsIds: ['Bambu PLA Basic @BBL A1'], printerModel: 'Bambu Lab A1', defaultPrintProfile: '0.20mm Standard @BBL A1' };

async function twoPlates() {
  await addBox(20, [10, 0, 0], { name: 'Roja' });
  const p2 = store().createPlate()!;
  await addBox(20, [p2.origin[0], 0, 0], { name: 'Azul' });
  useKuraStore.setState({ objects: store().objects.map((o) => ({ ...o, color: o.name === 'Roja' ? '#ff0000' : '#0000ff' })) });
}

describe('3MF con proyecto de ejemplo del laminador (store)', () => {
  const data = new Map<string, string>();
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(async () => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, projectName: null });
    vi.mocked(saveFileSet).mockClear();
  });

  it('con ejemplo: project_settings.config con sus identificadores y los colores de la escena', async () => {
    expect(saveSlicerProjectSample(SAMPLE)).toBe(true);
    await twoPlates();
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    const z = unzipSync(savedBytes());
    const json = JSON.parse(strFromU8(z['Metadata/project_settings.config']));
    expect(json.printer_settings_id).toBe(SAMPLE.printerSettingsId);
    expect(json.filament_colour).toEqual(['#FF0000', '#0000FF']);
    expect(json.filament_settings_id).toEqual(['Bambu PLA Basic @BBL A1', 'Bambu PLA Basic @BBL A1']);
    expect(strFromU8(z['Metadata/model_settings.config'])).not.toContain('filament_count');

    // Reimportar en una escena vacía: vuelven las placas, nombres y colores.
    const bytes = savedBytes();
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print' });
    expect(await store().importModelFiles([{ name: 'x.3mf', size: bytes.byteLength, read: async () => toBuffer(bytes) }])).toBe(true);
    expect(store().plates).toHaveLength(2);
    expect(store().objects.map((o) => [o.name, o.color.toLowerCase()])).toEqual([['Roja', '#ff0000'], ['Azul', '#0000ff']]);
    expect(store().objects.find((o) => o.name === 'Azul')!.plateRef).toBe(store().plates[1].id);
  });

  it('sin ejemplo, o con uno dañado, no se escribe project_settings.config', async () => {
    await twoPlates();
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(Object.keys(unzipSync(savedBytes()))).not.toContain('Metadata/project_settings.config');
    localStorage.setItem(STORAGE_SLICER_PROJECT_KEY, JSON.stringify({ ...SAMPLE, printerModel: 'a\u0000b' }));
    expect(await store().exportModel({ format: '3mf', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(Object.keys(unzipSync(savedBytes()))).not.toContain('Metadata/project_settings.config');
  });
});
