/**
 * @file src/project/projectCodecParametric.test.ts
 * @description Formato .kura v2: el origen paramétrico (`parametric`) se guarda y se recupera; un
 * .kura v1 anterior (sin el campo) sigue abriendo, y un v1 que trajera el campo se rechaza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import * as engine from '../engine';
import { parametricOrigin, parametricStateOf } from '../core/scene/parametric';
import { buildSceneObject } from '../core/scene/sceneObjects';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../types/kura';
import { decodeProject, encodeProjectImage, type ProjectDocument } from './projectCodec';
import { toLegacyKura } from './__tests__/legacyKura';

let cyl: SceneObject;
let thread: SceneObject;

beforeAll(async () => {
  await engine.initManifoldEngine();
  const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh('cylinder', { radius: 5, height: 12 }));
  cyl = buildSceneObject({
    id: 'c1', name: 'Cilindro', source: 'primitive', mesh, primitiveType: 'cylinder',
    primitiveParams: { radius: 5, height: 12 }, parametric: parametricOrigin('primitive', mesh),
  });
  const options = { kind: 'bolt' as const, diameterMm: 6, pitchMm: 1, lengthMm: 10, includeHead: false };
  const tmesh = engine.normalizeMeshToBed(await engine.createMetricThread(options));
  thread = buildSceneObject({ id: 't1', name: 'M6', source: 'thread', mesh: tmesh, parametric: parametricOrigin('thread', tmesh, options) });
});

const doc = (objects: SceneObject[], past: SceneObject[][] = []): ProjectDocument => ({
  objects, selectedIds: [], past: past.map((o) => ({ objects: o, selectedIds: [] })), future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
});

const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);

describe('.kura v2: parámetros de origen', () => {
  it('escribe v2 y recupera parámetros y huella en escena e historial', () => {
    const bytes = encodeProjectImage(doc([cyl, thread], [[cyl]]));
    expect(versionOf(bytes)).toBe(3);
    const back = decodeProject(bytes);
    expect(back.objects[0].parametric).toEqual(cyl.parametric);
    expect(back.objects[1].parametric?.thread).toMatchObject({ diameterMm: 6, pitchMm: 1, lengthMm: 10 });
    expect(back.past[0].objects[0].parametric).toEqual(cyl.parametric);
    // La malla decodificada es otra instancia, pero sigue siendo paramétrica.
    expect(parametricStateOf(back.objects[0]).status).toBe('primitive');
    expect(parametricStateOf(back.objects[1]).status).toBe('thread');
  });

  it('abre un .kura v1 anterior sin el campo (los objetos no quedan paramétricos)', () => {
    const { parametric: _omit, ...legacy } = cyl;
    // Fixture v1: misma estructura con `isHole` en vez de `role` y versión 1 en la cabecera.
    const bytes = toLegacyKura(encodeProjectImage(doc([legacy as SceneObject])), 1);
    const back = decodeProject(bytes);
    expect(back.objects[0]).toMatchObject({ id: 'c1', primitiveType: 'cylinder', primitiveParams: { radius: 5, height: 12 } });
    expect(back.objects[0].parametric).toBeUndefined();
    expect(parametricStateOf(back.objects[0]).status).toBe('none');
  });

  it('rechaza un v1 que trae el campo de v2 y un `parametric` mal formado', () => {
    const v1 = toLegacyKura(encodeProjectImage(doc([cyl])), 1);
    expect(() => decodeProject(v1)).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const bad = { ...cyl, parametric: { kind: 'primitive', meshFingerprint: 'x', extra: 1 } } as unknown as SceneObject;
    expect(() => encodeProjectImage(doc([bad]))).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });
});
