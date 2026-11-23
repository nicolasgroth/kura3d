/**
 * @file src/project/projectEdgeParams.test.ts
 * @description Bordes de primitivas en el .kura: los campos `edgeStyle`/`edgeSize`/`edgeScope` se
 * guardan y se recuperan; un proyecto anterior sin ellos abre igual, sigue paramétrico y regenera
 * aristas rectas idénticas (misma huella); valores inválidos se rechazan o se acotan como el resto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import * as engine from '../engine';
import { parametricOrigin, parametricStateOf } from '../core/scene/parametric';
import { buildSceneObject } from '../core/scene/sceneObjects';
import { computeMeshFingerprint } from '../engine/meshFingerprint';
import { DEFAULT_PRINTER_PROFILES, type PrimitiveParams, type PrimitiveType, type SceneObject } from '../types/kura';
import { boundPrimitiveParams } from './primitiveParamsBounds';
import { decodeProject, encodeProject, type ProjectDocument } from './projectCodec';

beforeAll(async () => {
  await engine.initManifoldEngine();
});

async function primitive(id: string, type: PrimitiveType, params: PrimitiveParams): Promise<SceneObject> {
  const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh(type, params));
  return buildSceneObject({
    id, name: id, source: 'primitive', mesh, primitiveType: type, primitiveParams: params,
    parametric: parametricOrigin('primitive', mesh),
  });
}

const doc = (objects: SceneObject[]): ProjectDocument => ({
  objects, selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
});

describe('.kura: bordes de primitivas', () => {
  it('guarda y recupera estilo, tamaño y alcance; el objeto sigue paramétrico', async () => {
    const params: PrimitiveParams = { width: 40, depth: 30, height: 20, edgeStyle: 'round', edgeSize: 5, edgeScope: 'vertical' };
    const box = await primitive('b1', 'box', params);
    const back = decodeProject(encodeProject(doc([box])));
    expect(back.objects[0].primitiveParams).toEqual(params);
    const state = parametricStateOf(back.objects[0]);
    expect(state.status).toBe('primitive');
    // Regenerar con los parámetros recuperados da la misma malla (misma huella).
    const again = engine.normalizeMeshToBed(await engine.createPrimitiveMesh('box', back.objects[0].primitiveParams));
    expect(computeMeshFingerprint(again)).toBe(box.parametric?.meshFingerprint);
  });

  it('un proyecto anterior (v1 y v2 sin campos de borde) abre y regenera aristas rectas idénticas', async () => {
    const legacyParams = { width: 20, depth: 20, height: 10 };
    const old = await primitive('old', 'box', legacyParams);
    // v2 sin campos nuevos: sigue paramétrico y la regeneración coincide con la malla guardada.
    const v2 = decodeProject(encodeProject(doc([old])));
    expect(v2.objects[0].primitiveParams).toEqual(legacyParams);
    expect(parametricStateOf(v2.objects[0]).status).toBe('primitive');
    const regenerated = engine.normalizeMeshToBed(await engine.createPrimitiveMesh('box', v2.objects[0].primitiveParams));
    expect(computeMeshFingerprint(regenerated)).toBe(old.parametric?.meshFingerprint);
    // v1 (sin `parametric`): abre igual, con los mismos parámetros y sin campos de borde.
    const { parametric: _omit, ...legacy } = old;
    const bytes = encodeProject(doc([legacy as SceneObject]));
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(4, 1, true);
    const v1 = decodeProject(bytes);
    expect(v1.objects[0].primitiveParams).toEqual(legacyParams);
    expect(v1.objects[0].primitiveParams?.edgeStyle).toBeUndefined();
  });

  it('rechaza un estilo o alcance desconocido y acota el tamaño al rango global', async () => {
    const box = await primitive('b2', 'box', { width: 10, depth: 10, height: 10 });
    const bad = { ...box, primitiveParams: { width: 10, edgeStyle: 'wavy' } } as unknown as SceneObject;
    expect(() => encodeProject(doc([bad]))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const badScope = { ...box, primitiveParams: { width: 10, edgeScope: 'sideways' } } as unknown as SceneObject;
    expect(() => encodeProject(doc([badScope]))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    expect(boundPrimitiveParams('box', { edgeSize: 1e6 })).toEqual({ edgeSize: 1000 });
    expect(boundPrimitiveParams('box', { edgeSize: -2 })).toEqual({ edgeSize: 0 });
  });

  it('un alcance que la primitiva no admite se descarta al abrir (queda el de por defecto)', () => {
    expect(boundPrimitiveParams('cylinder', { radius: 5, edgeStyle: 'round', edgeScope: 'vertical' })).toEqual({ radius: 5, edgeStyle: 'round' });
    const ok = { radius: 5, edgeStyle: 'round' as const, edgeScope: 'top' as const };
    expect(boundPrimitiveParams('cylinder', ok)).toBe(ok);
  });

  it('el texto 3D con espaciado y alineación también se guarda', async () => {
    const text = await primitive('t1', 'text', { text: 'AB', fontSize: 10, height: 2, letterSpacing: 1, textAlign: 'center' });
    const back = decodeProject(encodeProject(doc([text])));
    expect(back.objects[0].primitiveParams).toMatchObject({ letterSpacing: 1, textAlign: 'center' });
  });
});
