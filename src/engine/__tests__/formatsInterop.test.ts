// @vitest-environment node
/**
 * @file src/engine/__tests__/formatsInterop.test.ts
 * @description QA ronda 5 de formatos: GLB generado en Node que carga con el GLTFLoader de three
 * (estructura, accesores y conteos), PLY de ida y vuelta con 4 colores por cara, y 3MF cuya entrada ZIP
 * miente sobre su tamaño descomprimido (debe rechazarse con error tipado, sin reservar la salida).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MeshData, SceneObject } from '../../types/kura';
import { exportSceneToGLB } from '../io/glb';
import { exportSceneToPLY, readPLY } from '../io/ply';
import { read3MF } from '../io/threeMfImport';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';
import { cubeMeshXml } from './ioFixtures';

const toBuf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

describe('GLB', () => {
  it('un GLB con malla pintada de 3 colores y una esfera carga en GLTFLoader con los mismos triángulos', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 10, depth: 10 });
    const n = box.indices.length / 3;
    const painted: MeshData = { ...box, faceColors: Array.from({ length: n }, (_, i) => ['#ff0000', '#00ff00', '#0000ff'][i % 3]) };
    const sphere = await createPrimitiveMesh('sphere', { radius: 8, segments: 32 });
    const objs = [
      makeObject('caja', painted, { position: [10, 0, 0] }),
      makeObject('esfera', sphere, { position: [-20, 0, 5] }),
    ] as SceneObject[];
    const bytes = await exportSceneToGLB(objs);
    const gltf = await new GLTFLoader().parseAsync(toBuf(bytes), '');
    let tris = 0;
    let meshes = 0;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const p = g.attributes.position.array;
      for (const v of p) expect(Number.isFinite(v)).toBe(true);
    });
    expect(meshes).toBeGreaterThanOrEqual(2);
    expect(tris).toBe(n + sphere.indices.length / 3);
    const box3 = new THREE.Box3().setFromObject(gltf.scene);
    // metros: la escena ocupa ~ 0,05 m de ancho (de -28 a 20 mm), no 50 m
    expect(box3.max.x - box3.min.x).toBeGreaterThan(0.04);
    expect(box3.max.x - box3.min.x).toBeLessThan(0.06);
  });
});

describe('PLY', () => {
  it('4 colores por cara en una esfera vuelven con el mismo reparto y la malla sigue cerrada', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 24 });
    const pal = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    const n = sphere.indices.length / 3;
    const painted: MeshData = { ...sphere, faceColors: Array.from({ length: n }, (_, t) => pal[(t * 7 + (t >> 3)) % 4]) };
    const obj = makeObject('p', painted, { color: '#999999' });
    const model = readPLY(toBuf(exportSceneToPLY([obj])), 'p.ply');
    const back = model.parts[0].mesh;
    const tally = (c?: string[]) => [...(c ?? []).reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].sort();
    expect(tally(back.faceColors)).toEqual(tally(painted.faceColors));
    expect(back.indices.length / 3).toBe(n);
    expect(computeMeshStats(back).isManifold).toBe(true);
    expect(computeMeshStats(back).volumeMm3).toBeCloseTo(computeMeshStats(sphere).volumeMm3, 0);
  });
});

/** 3MF mínimo con el modelo inflado a `padding` bytes y los tamaños declarados cambiados a `declared`. */
function lyingZip(padding: number, declared: number): ArrayBuffer {
  const model =
    '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>' +
    `<object id="1" type="model">${cubeMeshXml(10)}</object></resources><build><item objectid="1"/></build></model>` +
    `<!--${' '.repeat(padding)}-->`;
  const zip = zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '3D/3dmodel.model': strToU8(model),
  });
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = 0; i + 30 < zip.length; i++) {
    const sig = dv.getUint32(i, true);
    if (sig === 0x04034b50) dv.setUint32(i + 22, declared, true); // cabecera local: tamaño sin comprimir
    if (sig === 0x02014b50) dv.setUint32(i + 24, declared, true); // directorio central
  }
  return toBuf(zip);
}

describe('3MF con ZIP mentiroso', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return (e as { code?: string }).code ?? 'sin-codigo:' + (e as Error).message;
    }
    return 'ok';
  };
  it('declara 100 bytes pero trae 3 MB: error tipado, no éxito', () => {
    const r = code(() => read3MF(lyingZip(3_000_000, 100), 'miente.3mf', { maxUncompressedBytes: 1_000_000 }));
    expect(['archive-too-large', 'corrupt']).toContain(r);
  });
  it('declara 4 GB (>= 2^32-1) pero trae poco: no revienta la memoria', () => {
    const r = code(() => read3MF(lyingZip(1000, 0xfffffffe), 'enorme.3mf', { maxUncompressedBytes: 1_000_000 }));
    expect(['archive-too-large', 'corrupt']).toContain(r);
  });
  it('declara 0 bytes con contenido real: error tipado', () => {
    const r = code(() => read3MF(lyingZip(2000, 0), 'cero.3mf'));
    expect(['archive-too-large', 'corrupt']).toContain(r);
  });
});
