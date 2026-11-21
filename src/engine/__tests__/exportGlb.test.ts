// @vitest-environment jsdom
/**
 * @file src/engine/__tests__/exportGlb.test.ts
 * @description Ida y vuelta GLB: exporta con GLTFExporter y vuelve a leer con GLTFLoader,
 * comprobando nombres, posiciones (metros) y colores por objeto y por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData, SceneObject } from '../../types/kura';
import { cubeGeometry } from './ioFixtures';
import { exportSceneToGLB, GLTF_METERS_PER_MM } from '../ioFormats';

let objects: SceneObject[];

beforeAll(() => {
  // Cubo de 10 mm centrado en X/Z y apoyado en Y=0 (sin Manifold: jsdom no carga el WASM).
  const { v, t } = cubeGeometry(10, [-5, -5, 0]);
  const cube: MeshData = {
    positions: new Float32Array(v.flatMap(([x, y, z]) => [x, z, -y])),
    indices: new Uint32Array(t.flat()),
  };
  const painted: MeshData = { ...cube, faceColors: Array.from({ length: cube.indices.length / 3 }, (_, t) => (t < 2 ? '#ff0000' : '#3366ff')) };
  const base = { source: 'primitive', rotation: [0, 0, 0], scale: [1, 1, 1], isHole: false, visible: true, locked: false } as const;
  objects = [
    { ...base, id: 'a', name: 'Cubo', position: [20, 0, 0], color: '#3366ff', mesh: painted } as unknown as SceneObject,
    { ...base, id: 'b', name: 'Gris', position: [-20, 4, 0], color: '#808080', mesh: cube } as unknown as SceneObject,
  ];
});

describe('exportación GLB', () => {
  it('conserva nombres, posiciones en metros y colores', async () => {
    const bytes = await exportSceneToGLB(objects);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('glTF');
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
    const meshes: THREE.Mesh[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
    });
    const byName = new Map<string, THREE.Box3>();
    const colorsByName = new Map<string, Set<string>>();
    for (const mesh of meshes) {
      // Los nodos multimaterial se exportan como un grupo con una malla por primitiva.
      const owner = mesh.name.startsWith('Cubo') || mesh.parent?.name === 'Cubo' ? 'Cubo' : 'Gris';
      const box = byName.get(owner) ?? new THREE.Box3();
      box.union(new THREE.Box3().setFromObject(mesh));
      byName.set(owner, box);
      const set = colorsByName.get(owner) ?? new Set<string>();
      set.add(`#${(mesh.material as THREE.MeshStandardMaterial).color.getHexString()}`);
      colorsByName.set(owner, set);
    }
    const toMm = (v: THREE.Vector3) => v.toArray().map((n) => Math.round(n / GLTF_METERS_PER_MM));
    expect(toMm(byName.get('Cubo')!.min)).toEqual([15, 0, -5]);
    expect(toMm(byName.get('Gris')!.max)).toEqual([-15, 14, 5]);
    expect(colorsByName.get('Cubo')).toEqual(new Set(['#ff0000', '#3366ff']));
    expect(colorsByName.get('Gris')).toEqual(new Set(['#808080']));
  });
});
