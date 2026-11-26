/**
 * @file src/engine/__tests__/exportBrand.test.ts
 * @description La marca de los exportadores (3MF, OBJ/MTL, PLY, GLB) la entrega quien llama: sin
 * ella los archivos salen con textos neutros; con ella, firmados con nombre, autor y organización.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import type { SceneObject } from '../../types/kura';
import { createPrimitiveMesh, initManifoldEngine } from '../index';
import { exportSceneTo3MF, exportSceneToOBJ, exportSceneToPLY } from '../ioFormats';
import { exportSceneToGLB } from '../io/glb';
import { makeObject } from './geometryTestUtils';

let scene: SceneObject[];
beforeAll(async () => {
  await initManifoldEngine();
  scene = [makeObject('cubo', await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 }))];
});

const textOf3mf = (bytes: Uint8Array) => {
  const zip = unzipSync(bytes);
  return strFromU8(zip['3D/3dmodel.model']) + strFromU8(zip['Metadata/model_settings.config']);
};
const plyHeader = (bytes: Uint8Array) => strFromU8(bytes.subarray(0, 300)).split('end_header')[0];
const glbJson = (bytes: Uint8Array) => {
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true);
  return JSON.parse(strFromU8(bytes.subarray(20, 20 + len))) as { asset: { generator: string }; scenes: { name: string }[] };
};

describe('marca en los exportadores', () => {
  it('sin marca: ningún archivo menciona la app', async () => {
    const { obj, mtl } = exportSceneToOBJ(scene, 'x');
    const texts = [textOf3mf(exportSceneTo3MF(scene, 'mm')), obj, mtl, plyHeader(exportSceneToPLY(scene)), JSON.stringify(glbJson(await exportSceneToGLB(scene)))];
    for (const text of texts) expect(text).not.toMatch(new RegExp(`${BRAND.name}|ISGROTH`, 'i'));
  });

  it('con BRAND: 3MF, OBJ/MTL, PLY y GLB quedan firmados', async () => {
    const xml = textOf3mf(exportSceneTo3MF(scene, 'mm', undefined, BRAND));
    expect(xml).toContain(`<metadata name="Application">${BRAND.name} by ${BRAND.author}</metadata>`);
    expect(xml).toContain('ISGROTH');
    // La placa implícita va sin nombre: el laminador muestra el suyo (antes salía «Kurra Studio_Bed»).
    expect(xml).toContain('<metadata key="plater_name" value=""/>');
    expect(xml).not.toContain('_Bed');
    const { obj, mtl } = exportSceneToOBJ(scene, 'x', BRAND);
    expect(obj.split('\n')[0]).toBe(`# ${BRAND.name} by ${BRAND.author} — Wavefront OBJ Export (Units: mm, Y-up)`);
    expect(mtl.split('\n')[0]).toContain(BRAND.name);
    expect(plyHeader(exportSceneToPLY(scene, BRAND))).toContain(`comment ${BRAND.name} by ${BRAND.author} export`);
    const glb = glbJson(await exportSceneToGLB(scene, BRAND));
    expect(glb.scenes[0].name).toBe(BRAND.name);
    expect(glb.asset.generator).toContain(BRAND.name);
  });
});
