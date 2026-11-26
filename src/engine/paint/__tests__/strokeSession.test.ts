/**
 * @file src/engine/paint/__tests__/strokeSession.test.ts
 * @description Trazo de pincel y delta de historial: ida y vuelta exacta (incluido volver a "sin
 * pintar"), delta mucho menor que una copia completa, subida a la GPU solo de los tramos cambiados y
 * tiempo por muestra en una esfera de ~200 mil triángulos (umbral holgado; se informa el número).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import { createBufferGeometryFromMeshData } from '../../primitives';
import { faceUpdateRanges, updateGeometryFaceColorsAt, writeFaceColors } from '../../paintColorAttribute';
import { paintMeshFacesInSphere } from '../brush';
import { applyFaceColorDelta, diffFaceColors, faceColorDeltaBytes } from '../colorDelta';
import { PaintStrokeSession } from '../strokeSession';
import { uvSphere } from './paintTestMeshes';

const BASE = '#94A3B8';

function strokeOn(mesh: MeshData, samples: number, radius = 3): PaintStrokeSession {
  const session = new PaintStrokeSession(mesh, BASE);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI;
    const center: Vec3 = [20 * Math.cos(a) * 0.7, 20 * 0.7, 20 * Math.sin(a) * 0.7];
    const n = Math.hypot(...center);
    const onSurface = center.map((v) => (v / n) * 20) as Vec3;
    session.paint({ center: onSurface, radiusMm: radius, scale: [1, 1, 1], eye: onSurface.map((v) => v * 5) as Vec3 }, i % 2 ? '#FF0000' : '#00ff00');
  }
  return session;
}

describe('delta de colores', () => {
  const mesh = uvSphere(20, 96, 48);

  it('trazo sobre malla sin pintar: deshacer vuelve a sin pintar y rehacer da lo mismo', () => {
    const result = strokeOn(mesh, 30).finish()!;
    expect(result).not.toBeNull();
    expect(result.delta.beforePainted).toBe(false);
    const undone = applyFaceColorDelta(result.mesh, result.delta, 'undo', BASE);
    expect(undone.faceColors).toBeUndefined();
    expect(undone.positions).toBe(mesh.positions);
    const redone = applyFaceColorDelta(undone, result.delta, 'redo', BASE);
    expect(redone.faceColors).toEqual(result.mesh.faceColors);
  });

  it('trazo sobre malla pintada: ida y vuelta exacta y el delta pesa mucho menos que una copia', () => {
    const painted: MeshData = { ...mesh, faceColors: Array.from({ length: mesh.indices.length / 3 }, (_, t) => (t % 7 ? '#123456' : '#abcdef')) };
    const result = strokeOn(painted, 30).finish()!;
    expect(result.delta.faces.length).toBeGreaterThan(0);
    const undone = applyFaceColorDelta(result.mesh, result.delta, 'undo', BASE);
    expect(undone.faceColors).toEqual(painted.faceColors);
    expect(applyFaceColorDelta(undone, result.delta, 'redo', BASE).faceColors).toEqual(result.mesh.faceColors);
    expect(painted.faceColors).not.toBe(result.mesh.faceColors); // el origen no se muta
    expect(faceColorDeltaBytes(result.delta)).toBeLessThan((painted.faceColors!.length * 12) / 5);
    // El delta del trazo es el mismo que el de comparar ambas mallas.
    const diff = diffFaceColors(painted, result.mesh, BASE)!;
    expect(Array.from(diff.faces)).toEqual(Array.from(result.delta.faces));
  });

  it('pintar y volver al color original dentro del trazo no deja cambios', () => {
    const session = new PaintStrokeSession(mesh, BASE);
    const q = { center: [0, 20, 0] as Vec3, radiusMm: 4, scale: [1, 1, 1] as Vec3 };
    expect(session.paint(q, '#ff0000')).toBeGreaterThan(0);
    session.paint(q, BASE);
    expect(session.finish()).toBeNull();
    expect(diffFaceColors(mesh, mesh, BASE)).toBeNull();
  });
});

describe('subida parcial a la GPU', () => {
  it('fusiona caras cercanas en tramos y escribe solo esas caras', () => {
    expect(faceUpdateRanges([5, 3, 4, 500, 501])).toEqual([[3, 3], [500, 2]]);
    const mesh = uvSphere(10, 16, 8);
    const n = mesh.indices.length / 3;
    const colors = new Array<string>(n).fill('#000000');
    const geometry = createBufferGeometryFromMeshData({ ...mesh, faceColors: colors }, '#000000');
    const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
    colors[2] = '#ffffff';
    expect(updateGeometryFaceColorsAt(geometry, [2], colors, '#000000')).toBe(true);
    expect(attr.updateRanges).toEqual([{ start: 18, count: 9 }]);
    expect(attr.array[18]).toBeCloseTo(1, 3);
    expect(attr.array[27]).toBeCloseTo(0, 3);
  });
});

describe('rendimiento del pincel (~200 mil triángulos, trazo de 100 muestras)', () => {
  it('una muestra cuesta poco y mucho menos que el camino anterior', () => {
    const big = uvSphere(40, 448, 224);
    const tris = big.indices.length / 3;
    expect(tris).toBeGreaterThan(199_000);
    const samples: Vec3[] = Array.from({ length: 100 }, (_, i) => {
      const a = (i / 100) * Math.PI * 1.5;
      return [40 * Math.cos(a) * 0.8, 40 * 0.6, 40 * Math.sin(a) * 0.8];
    });
    const obj = { scale: [1, 1, 1], color: BASE, mesh: big } as unknown as SceneObject;

    // Camino anterior: copia completa de colores por muestra + reescritura de todo el atributo.
    const gpu = new Float32Array(tris * 9);
    let current: SceneObject = obj;
    paintMeshFacesInSphere(current, samples[0], 4, '#ff0000'); // calienta la rejilla
    const t0 = performance.now();
    for (const c of samples) {
      const mesh = paintMeshFacesInSphere(current, c, 4, '#ff0000');
      current = { ...current, mesh };
      writeFaceColors(gpu, mesh.faceColors ?? [], BASE);
    }
    const legacyMs = (performance.now() - t0) / samples.length;

    // Camino nuevo: rejilla + frente a la cámara + escritura solo de las caras cambiadas.
    const session = new PaintStrokeSession(big, BASE);
    const t1 = performance.now();
    for (const c of samples) {
      session.paint({ center: c, radiusMm: 4, scale: [1, 1, 1], eye: [c[0] * 4, c[1] * 4, c[2] * 4] }, '#00ff00');
      const dirty = session.takeDirty();
      for (const t of dirty) gpu[t * 9] = 1;
    }
    const newMs = (performance.now() - t1) / samples.length;
    const t2 = performance.now();
    const result = session.finish()!;
    const finishMs = performance.now() - t2;
    console.info(
      `[pincel] ${tris} triángulos, 100 muestras — antes ${legacyMs.toFixed(2)} ms/muestra, ahora ${newMs.toFixed(3)} ms/muestra; ` +
        `cierre del trazo ${finishMs.toFixed(1)} ms; delta ${result.delta.faces.length} caras / ${faceColorDeltaBytes(result.delta)} B`,
    );
    // Solo comparación relativa en la misma corrida (la meta absoluta < 4 ms se mide con la consola).
    expect(newMs).toBeLessThan(legacyMs);
  }, 60_000);
});
