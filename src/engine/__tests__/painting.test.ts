/**
 * @file src/engine/__tests__/painting.test.ts
 * @description Pruebas de pintura por caras: el relleno inteligente conserva el color del objeto en las
 * caras sin pintar, el pincel mide el radio en mm de mundo (escala del objeto), pintar no copia la
 * geometría, el atributo de color se actualiza en sitio y el historial guarda un paso por trazo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeMeshStats,
  createBufferGeometryFromMeshData,
  createPrimitiveMesh,
  initManifoldEngine,
  paintEntireMesh,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
} from '..';
import { updateGeometryFaceColors, writeFaceColors } from '../paintColorAttribute';
import { useKuraStore } from '../../store/useKuraStore';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';

function sceneObject(mesh: MeshData, scale: Vec3 = [1, 1, 1]): SceneObject {
  return {
    id: 'p', name: 'p', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale,
    color: '#123456', isHole: false, visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  } as SceneObject;
}

beforeEach(async () => {
  await initManifoldEngine();
});

describe('smart fill', () => {
  it('keeps unpainted faces in the object color instead of a hard-coded blue', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const painted = paintFloodFillConnectedFaces(box, 0, '#ff0000', 30, '#123456');
    const colors = painted.faceColors!;
    expect(colors.filter((c) => c === '#ff0000')).toHaveLength(2);
    expect(colors.filter((c) => c === '#123456')).toHaveLength(colors.length - 2);
    expect(colors).not.toContain('#38bdf8');
  });

  it('shares positions, indices and normals with the source mesh', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    for (const painted of [paintFloodFillConnectedFaces(box, 0, '#ff0000'), paintEntireMesh(box, '#00ff00')]) {
      expect(painted.positions).toBe(box.positions);
      expect(painted.indices).toBe(box.indices);
      expect(painted.normals).toBe(box.normals);
    }
  });
});

describe('sphere brush', () => {
  it('measures the radius in world mm, taking the object scale into account', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    // Punto sobre la cara superior a 8 mm locales del borde lateral (x=10).
    const center: Vec3 = [2, 20, 0];
    const touches = (mesh: MeshData) => mesh.faceColors?.some((c) => c === '#ff0000') ?? false;
    // Sin escala, un radio de 6 mm toca la cara lateral x=10 (a 8 mm) solo si pasa: no debe pasar.
    const plain = paintMeshFacesInSphere(sceneObject(box), center, 6, '#ff0000');
    const sideFacesPlain = countSide(plain);
    // Con escala 0.5 en X, la cara lateral queda a 4 mm reales: el mismo radio sí la alcanza.
    const scaled = paintMeshFacesInSphere(sceneObject(box, [0.5, 1, 1]), center, 6, '#ff0000');
    expect(touches(plain)).toBe(true);
    expect(sideFacesPlain).toBe(0);
    expect(countSide(scaled)).toBeGreaterThan(0);

    function countSide(mesh: MeshData) {
      let n = 0;
      const colors = mesh.faceColors ?? [];
      for (let t = 0; t < colors.length; t++) {
        const xs = [0, 1, 2].map((k) => box.positions[box.indices[t * 3 + k] * 3]);
        if (colors[t] === '#ff0000' && xs.every((x) => Math.abs(x - 10) < 1e-6)) n++;
      }
      return n;
    }
  });

  it('returns the same mesh when nothing changes and never copies geometry', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const once = paintMeshFacesInSphere(sceneObject(box), [0, 20, 0], 4, '#ff0000');
    expect(once.positions).toBe(box.positions);
    const again = paintMeshFacesInSphere(sceneObject(once), [0, 20, 0], 4, '#ff0000');
    expect(again).toBe(once);
    const far = paintMeshFacesInSphere(sceneObject(box), [500, 500, 500], 1, '#ff0000');
    expect(far).toBe(box);
  });
});

describe('color attribute', () => {
  it('updates vertex colors in place without rebuilding the geometry', async () => {
    const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const painted = paintEntireMesh(box, '#000000');
    const geometry = createBufferGeometryFromMeshData(painted, '#000000');
    const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const before = attr.array;
    const next = paintFloodFillConnectedFaces(painted, 0, '#ffffff');
    expect(updateGeometryFaceColors(geometry, next.faceColors!, '#000000')).toBe(true);
    expect(geometry.getAttribute('color').array).toBe(before);
    expect(attr.array[0]).toBeCloseTo(1, 3);
    expect(attr.array[attr.array.length - 1]).toBeCloseTo(0, 3);
    expect(writeFaceColors(new Float32Array(9), ['#ffffff', '#ffffff'], '#000000')).toBe(false);
  });
});

describe('paint history', () => {
  it('records one undo step per brush stroke, not one per sample', async () => {
    useKuraStore.setState({ engineReady: true, objects: [], selectedIds: [], past: [], future: [], paintMode: 'brush', paintRadiusMm: 3 });
    const store = useKuraStore.getState();
    const obj = await store.createPrimitive('sphere', { radius: 12, segments: 24 });
    const base = useKuraStore.getState().past.length;
    store.beginPaintStroke();
    for (let i = 0; i < 10; i++) {
      useKuraStore.getState().setPaintSettings({ paintColor: i % 2 ? '#ff0000' : '#00ff00' });
      useKuraStore.getState().paintObjectSurface(obj!.id, [i - 5, 24, 0], null);
    }
    store.endPaintStroke();
    expect(useKuraStore.getState().past.length).toBe(base + 1);
    useKuraStore.getState().undo();
    expect(useKuraStore.getState().objects[0].mesh.faceColors).toBeUndefined();
  });

  it('smart fill from the store keeps the object color on the other faces', async () => {
    useKuraStore.setState({ engineReady: true, objects: [], selectedIds: [], past: [], future: [], paintMode: 'smart_fill' });
    const obj = await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { color: '#abcdef' });
    useKuraStore.getState().setPaintSettings({ paintColor: '#ff0000' });
    useKuraStore.getState().paintObjectSurface(obj!.id, null, 0);
    const colors = useKuraStore.getState().objects[0].mesh.faceColors!;
    expect(new Set(colors)).toEqual(new Set(['#ff0000', '#abcdef']));
  });
});

describe('paint without empty steps', () => {
  it('painting the whole object or filling with the current color adds no history step', async () => {
    useKuraStore.setState({ engineReady: true, objects: [], selectedIds: [], past: [], future: [], paintMode: 'whole' });
    const obj = await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { color: '#abcdef' });
    useKuraStore.getState().setPaintSettings({ paintColor: '#ff0000' });
    useKuraStore.getState().paintObjectSurface(obj!.id, null, null);
    const base = useKuraStore.getState().past.length;
    const mesh = useKuraStore.getState().objects[0].mesh;
    useKuraStore.getState().paintObjectSurface(obj!.id, null, null);
    useKuraStore.getState().setPaintSettings({ paintMode: 'smart_fill' });
    useKuraStore.getState().paintObjectSurface(obj!.id, null, 0);
    expect(useKuraStore.getState().past.length).toBe(base);
    expect(useKuraStore.getState().objects[0].mesh).toBe(mesh);
  });

  it('does not paint while another operation is running', async () => {
    useKuraStore.setState({ engineReady: true, objects: [], selectedIds: [], past: [], future: [], paintMode: 'whole' });
    const obj = await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 });
    const mesh = useKuraStore.getState().objects[0].mesh;
    useKuraStore.setState({ busyOperation: 'hollow' });
    useKuraStore.getState().paintObjectSurface(obj!.id, null, null);
    useKuraStore.setState({ busyOperation: null });
    expect(useKuraStore.getState().objects[0].mesh).toBe(mesh);
  });

  it('refines the stroke edge on a low-poly box and keeps the volume', async () => {
    useKuraStore.setState({
      engineReady: true, objects: [], selectedIds: [], past: [], future: [], paintMode: 'brush', paintRadiusMm: 4, paintRefineEdge: true,
    });
    const obj = await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 });
    const before = useKuraStore.getState().objects[0];
    useKuraStore.getState().setPaintSettings({ paintColor: '#ff0000' });
    useKuraStore.getState().paintObjectSurface(obj!.id, [0, 20, 0], null);
    const after = useKuraStore.getState().objects[0];
    expect(after.stats.triangles).toBeGreaterThan(before.stats.triangles);
    expect(after.stats.volumeMm3).toBeCloseTo(before.stats.volumeMm3, 3);
  });
});
