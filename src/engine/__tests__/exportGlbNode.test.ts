// @vitest-environment node
/**
 * @file src/engine/__tests__/exportGlbNode.test.ts
 * @description GLB en Node (sin `FileReader` ni otras APIs del navegador, como en el servidor MCP):
 * cabecera glTF 2.0, trozo JSON válido con una malla por objeto, trozo BIN alineado y posiciones en
 * metros (cubo de 10 mm en x = 20 mm queda entre 0,015 y 0,025 m).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject } from '../../types/kura';
import { exportSceneToGLB } from '../io/glb';
import { cubeGeometry } from './ioFixtures';

const { v, t } = cubeGeometry(10, [-5, -5, 0]);
const cube: MeshData = { positions: new Float32Array(v.flatMap(([x, y, z]) => [x, z, -y])), indices: new Uint32Array(t.flat()) };
const painted: MeshData = { ...cube, faceColors: Array.from({ length: cube.indices.length / 3 }, (_, i) => (i < 2 ? '#ff0000' : '#3366ff')) };
const base = { source: 'primitive', rotation: [0, 0, 0], scale: [1, 1, 1], role: 'solid', visible: true, locked: false } as const;
const objects = [
  { ...base, id: 'a', name: 'Cubo', position: [20, 0, 0], color: '#3366ff', mesh: painted },
  { ...base, id: 'b', name: 'Gris', position: [-20, 4, 0], color: '#808080', mesh: cube },
] as unknown as SceneObject[];

describe('GLB en Node', () => {
  it('no usa FileReader y produce un contenedor glTF 2.0 válido en metros', async () => {
    expect(typeof (globalThis as { FileReader?: unknown }).FileReader).toBe('undefined');
    const bytes = await exportSceneToGLB(objects);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(bytes.byteLength);
    const jsonLen = view.getUint32(12, true);
    expect(view.getUint32(16, true)).toBe(0x4e4f534a); // 'JSON'
    expect(jsonLen % 4).toBe(0);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
    const binHeader = 20 + jsonLen;
    const binLen = view.getUint32(binHeader, true);
    expect(view.getUint32(binHeader + 4, true)).toBe(0x004e4942); // 'BIN\0'
    expect(binHeader + 8 + binLen).toBe(bytes.byteLength);
    expect(json.asset.version).toBe('2.0');
    expect(json.buffers[0].byteLength).toBe(binLen);
    expect(json.meshes.map((m: { name: string }) => m.name)).toEqual(['Cubo', 'Gris']);
    expect(json.meshes[0].primitives).toHaveLength(2);
    expect(json.materials.length).toBe(3);

    const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    expect(pos.min[0]).toBeCloseTo(0.015, 6);
    expect(pos.max[0]).toBeCloseTo(0.025, 6);
    expect(pos.max[1]).toBeCloseTo(0.01, 6);
    // Las posiciones del trozo BIN coinciden con min/max declarados.
    const bv = json.bufferViews[pos.bufferView];
    const floats = new Float32Array(bytes.slice(binHeader + 8 + (bv.byteOffset ?? 0), binHeader + 8 + (bv.byteOffset ?? 0) + pos.count * 12).buffer);
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) maxX = Math.max(maxX, floats[i * 3]);
    expect(maxX).toBeCloseTo(0.025, 6);
  });
});
