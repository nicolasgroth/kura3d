/**
 * @file src/engine/io/glb.ts
 * @description Exportación GLB (glTF 2.0 binario) con `GLTFExporter` de three.js (MIT): un nodo por
 * objeto, coordenadas mundiales en metros (unidad estándar glTF, Y-up) y un material por color,
 * incluidos los colores por cara como primitivas separadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { SceneObject } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { applyTransformToMesh } from '../primitives';
import { normalizeHexColor } from './meshBuffers';
import { exportableObjects } from './stl';

/** Factor de milímetros (Kura3D) a metros (glTF). */
export const GLTF_METERS_PER_MM = 0.001;

/** Construye la escena three.js que se exporta (separada para pruebas). */
export function buildGltfScene(objects: SceneObject[]): THREE.Scene {
  const scene = new THREE.Scene();
  scene.name = 'Kura3D';
  for (const obj of exportableObjects(objects)) {
    const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const base = normalizeHexColor(obj.color);
    const triCount = Math.floor(world.indices.length / 3);

    // Ordena triángulos por color para que cada grupo sea una primitiva con su material.
    const byColor = new Map<string, number[]>();
    for (let t = 0; t < triCount; t++) {
      const color = normalizeHexColor(world.faceColors?.[t], base);
      let list = byColor.get(color);
      if (!list) byColor.set(color, (list = []));
      list.push(t);
    }
    const indices = new Uint32Array(triCount * 3);
    const geometry = new THREE.BufferGeometry();
    const materials: THREE.MeshStandardMaterial[] = [];
    let cursor = 0;
    for (const [color, tris] of byColor) {
      const start = cursor;
      for (const t of tris) {
        indices[cursor++] = world.indices[t * 3];
        indices[cursor++] = world.indices[t * 3 + 1];
        indices[cursor++] = world.indices[t * 3 + 2];
      }
      geometry.addGroup(start, cursor - start, materials.length);
      materials.push(new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0, name: `kura_${color.slice(1)}` }));
    }
    const positions = new Float32Array(world.positions.length);
    for (let i = 0; i < positions.length; i++) positions[i] = world.positions[i] * GLTF_METERS_PER_MM;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, materials.length === 1 ? materials[0] : materials);
    mesh.name = obj.name;
    scene.add(mesh);
  }
  return scene;
}

/** Exporta los objetos visibles y sólidos a un archivo GLB. */
export async function exportSceneToGLB(objects: SceneObject[]): Promise<Uint8Array> {
  const scene = buildGltfScene(objects);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: false });
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      (Array.isArray(node.material) ? node.material : [node.material]).forEach((m: THREE.Material) => m.dispose());
    }
  });
  if (!(result instanceof ArrayBuffer)) throw new EngineError('GLB_EXPORT_FAILED');
  return new Uint8Array(result);
}
