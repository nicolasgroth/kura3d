/**
 * @file src/engine/__tests__/threeMfSlicerProject.test.ts
 * @description 3MF y laminador (segunda parte): ninguna exportación escribe `filament_count` (el laminador descarta el
 * archivo entero al verlo); con proyecto de ejemplo se escribe `Metadata/project_settings.config` con 9 claves exactas y
 * los colores de los filamentos en el orden de `extruder`; sin ejemplo no se escribe; la ida y vuelta conserva placas,
 * nombres, colores y posiciones; un `project_settings.config` ajeno (con claves de conexión) no rompe la importación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import type { MeshData, SceneObject } from '../../types/kura';
import { createPrimitiveMesh, initManifoldEngine } from '../index';
import { exportSceneTo3MF, parseModelFile } from '../ioFormats';
import type { SlicerProjectSample } from '../io/slicerProjectSample';
import { makeObject } from './geometryTestUtils';

const BED = { widthMm: 256, depthMm: 256 };
const SAMPLE: SlicerProjectSample = {
  version: '1.5.3.5',
  printerSettingsId: 'Elegoo Centauri Carbon 2 0.2 nozzle',
  printSettingsId: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
  filamentSettingsIds: ['Elegoo PLA+ @ECC2', 'Elegoo PLA Silk @ECC2'],
  printerModel: 'Elegoo Centauri Carbon 2',
  defaultPrintProfile: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
};
const NINE = ['version', 'name', 'from', 'printer_settings_id', 'print_settings_id', 'filament_settings_id', 'printer_model', 'default_print_profile', 'filament_colour'];

let cube: MeshData;
beforeAll(async () => {
  await initManifoldEngine();
  cube = await createPrimitiveMesh('box', { width: 20, height: 10, depth: 20 });
});

const colors = ['#e53935', '#1e88e5', '#43a047'];
const objects = (): SceneObject[] => colors.map((c, i) => makeObject(`o${i}`, cube, { name: `Pieza ${i + 1}`, color: c, position: [10 * i - 20, 0, 5 * i] }));
const layout = (objs: SceneObject[]) => ({ plates: objs.map((o, i) => ({ name: `Placa ${i + 1}`, objectIds: [o.id] })) });
const toBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('3MF sin filament_count', () => {
  it('ninguna variante lo escribe', () => {
    const objs = objects();
    const variants = [
      exportSceneTo3MF(objs, 'mm'),
      exportSceneTo3MF(objs, 'mm', undefined, BRAND, { groups: [] }),
      exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, layout(objs), undefined, { bed: BED }),
      exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, undefined, undefined, { bed: BED, project: SAMPLE }),
    ];
    for (const bytes of variants) expect(strFromU8(unzipSync(bytes)['Metadata/model_settings.config'])).not.toContain('filament_count');
  });
});

describe('project_settings.config del proyecto de ejemplo', () => {
  it('sin ejemplo no se escribe', () => {
    const objs = objects();
    const z = unzipSync(exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, layout(objs), undefined, { bed: BED }));
    expect(Object.keys(z)).not.toContain('Metadata/project_settings.config');
  });

  it('con ejemplo: 9 claves exactas, colores en el orden de extruder y filamentos ajustados', () => {
    const objs = objects();
    const z = unzipSync(exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, layout(objs), undefined, { bed: BED, project: SAMPLE }));
    const json = JSON.parse(strFromU8(z['Metadata/project_settings.config']));
    expect(Object.keys(json)).toEqual(NINE);
    expect(json).toMatchObject({ name: 'project_settings', from: 'project', version: SAMPLE.version, printer_model: SAMPLE.printerModel });
    expect(json.filament_colour).toEqual(['#E53935', '#1E88E5', '#43A047']);
    expect(json.filament_settings_id).toEqual(['Elegoo PLA+ @ECC2', 'Elegoo PLA Silk @ECC2', 'Elegoo PLA+ @ECC2']);
    // extruder N de cada objeto = filament_colour[N-1] = su color.
    const settings = strFromU8(z['Metadata/model_settings.config']);
    const extruders = [...settings.matchAll(/<object id="\d+">\s*<metadata key="name" value="([^"]+)"\/>\s*<metadata key="extruder" value="(\d+)"/g)];
    expect(extruders.map((m) => json.filament_colour[Number(m[2]) - 1])).toEqual(['#E53935', '#1E88E5', '#43A047']);
  });

  it('los colores de huecos u ocultos no cuentan como filamentos', () => {
    const objs = [...objects().slice(0, 1), makeObject('h', cube, { name: 'Hueco', color: '#000000', role: 'negative' })];
    const z = unzipSync(exportSceneTo3MF(objs, 'mm', undefined, BRAND, { groups: [] }, undefined, undefined, { bed: BED, project: SAMPLE }));
    expect(JSON.parse(strFromU8(z['Metadata/project_settings.config'])).filament_colour).toEqual(['#E53935']);
  });

  it('ida y vuelta con ejemplo: placas, nombres, colores y posiciones relativas', () => {
    const objs = objects();
    const bytes = exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, layout(objs), undefined, { bed: BED, project: SAMPLE });
    const model = parseModelFile('x.3mf', toBuffer(bytes));
    expect(model.plates?.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2', 'Placa 3']);
    expect(model.parts.map((p) => p.name)).toEqual(objs.map((o) => o.name));
    expect(model.parts.map((p) => p.color?.toLowerCase())).toEqual(colors);
    const centerX = (part: (typeof model.parts)[number]) => {
      let lo = Infinity, hi = -Infinity;
      for (let v = 0; v < part.mesh.positions.length; v += 3) { lo = Math.min(lo, part.mesh.positions[v]); hi = Math.max(hi, part.mesh.positions[v]); }
      return (lo + hi) / 2 + (part.translation?.[0] ?? 0);
    };
    // Placa 1 y 2 en la misma fila: 1,2 × 256 entre centros de cama más la diferencia de posición propia.
    expect(centerX(model.parts[1]) - centerX(model.parts[0])).toBeCloseTo(307.2 + 10, 4);
  });

  it('un project_settings.config ajeno (con datos de conexión) no rompe la importación', () => {
    const objs = objects();
    const z = unzipSync(exportSceneTo3MF(objs, 'mm', undefined, BRAND, undefined, layout(objs), undefined, { bed: BED }));
    z['Metadata/project_settings.config'] = strToU8(JSON.stringify({ print_host: '10.0.0.2', printhost_apikey: 'x', filament_colour: 'no-lista', layer_height: ['0.2'] }));
    const model = parseModelFile('x.3mf', toBuffer(zipSync(z)));
    expect(model.parts).toHaveLength(3);
    expect(model.parts.map((p) => p.color?.toLowerCase())).toEqual(colors);
    z['Metadata/project_settings.config'] = strToU8('{esto no es json');
    expect(parseModelFile('x.3mf', toBuffer(zipSync(z))).parts).toHaveLength(3);
  });
});
