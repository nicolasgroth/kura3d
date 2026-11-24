/**
 * @file src/project/projectCodecMagnet.test.ts
 * @description Un .kura con un agregado de imán sin holguras (como lo sanea `sanitizeMagnetParams`) se carga; uno con
 * medidas fuera de rango se rechaza. También: la paleta encuentra el alojamiento por «imán» o «iman» en inglés.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import * as engine from '../engine';
import { magnetPaletteItems } from '../components/magnet/magnetPaletteItems';
import { parametricOrigin } from '../core/scene/parametric';
import { buildSceneObject } from '../core/scene/sceneObjects';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../types/kura';
import { rankPaletteItems } from '../utils/paletteRank';
import { decodeProject, encodeProject, type ProjectDocument } from './projectCodec';

let base: SceneObject;

beforeAll(async () => {
  await engine.initManifoldEngine();
  const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh('cylinder', { radius: 3, height: 2 }));
  base = buildSceneObject({
    id: 'm1', name: 'Imán', source: 'primitive', mesh, primitiveType: 'cylinder', primitiveParams: { radius: 3, height: 2 },
    parametric: parametricOrigin('primitive', mesh), role: 'negative',
  });
});

const doc = (objects: SceneObject[]): ProjectDocument => ({
  objects, selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
});

const withAddon = (params: Record<string, unknown>): SceneObject => ({
  ...base, metadata: { addon: { kind: 'magnet_pocket', params, hostId: undefined } },
} as unknown as SceneObject);

describe('.kura: agregado de imán', () => {
  it('un imán sin holguras (se usan las de fábrica) se carga', () => {
    const back = decodeProject(encodeProject(doc([withAddon({ shape: 'round', sizeMm: 5, heightMm: 2, hidden: false })])));
    expect(back.objects[0].metadata?.addon?.kind).toBe('magnet_pocket');
  });

  it('medidas fuera de rango se rechazan', () => {
    expect(() => decodeProject(encodeProject(doc([withAddon({ shape: 'round', sizeMm: 5, heightMm: 2, clearanceMm: 3, hidden: false })])))).toThrow();
  });
});

describe('paleta: alojamiento de imán', () => {
  it.each(['imán', 'iman', 'alojamiento'])('con la interfaz en inglés se encuentra buscando «%s»', (query) => {
    const items = magnetPaletteItems('en', 'Create');
    expect(rankPaletteItems(items, query)).toHaveLength(1);
  });
});
