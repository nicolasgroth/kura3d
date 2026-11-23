/**
 * @file src/engine/__tests__/paintModule.test.ts
 * @description Pruebas del módulo `src/engine/paint/`: equivalencia con la pintura anterior (sin
 * subdivisión), pasos vacíos (misma referencia si nada cambia), tiempos sobre una esfera de ~200 mil
 * triángulos, borde fino por subdivisión (malla cerrada, volumen intacto) e ida y vuelta 3MF / .kura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh, initManifoldEngine, signedVolumeMm3 } from '..';
import { paintEntireMesh, paintFloodFillConnectedFaces, paintMeshFacesInSphere } from '../paint';
import { countUnpairedEdges } from '../meshClosure';
import { exportSceneTo3MF, read3MF } from '../ioFormats';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject, type Vec3 } from '../../types/kura';
import { legacyFloodFill, legacyPaintEntire, legacyPaintSphere } from './fixtures/legacyPaint';
import { toBuffer } from './ioFixtures';

function sceneObject(mesh: MeshData, scale: Vec3 = [1, 1, 1], color = '#123456'): SceneObject {
  return {
    id: 'p', name: 'p', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale,
    color, isHole: false, visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  } as SceneObject;
}

let box: MeshData;
let sphere: MeshData;
let big: MeshData;

beforeAll(async () => {
  await initManifoldEngine();
  box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
  sphere = await createPrimitiveMesh('sphere', { radius: 12, segments: 32 });
  big = uvSphere(40, 448, 224);
}, 60_000);

/** Esfera UV cerrada (abanicos en los polos): 2·lon·(lat−1) triángulos. */
function uvSphere(radius: number, lon: number, lat: number): MeshData {
  const pos: number[] = [0, radius, 0];
  for (let i = 1; i < lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j < lon; j++) {
      const ph = (j / lon) * 2 * Math.PI;
      pos.push(radius * Math.sin(th) * Math.cos(ph), radius * Math.cos(th), radius * Math.sin(th) * Math.sin(ph));
    }
  }
  pos.push(0, -radius, 0);
  const south = pos.length / 3 - 1;
  const ring = (i: number, j: number) => 1 + (i - 1) * lon + (j % lon);
  const idx: number[] = [];
  for (let j = 0; j < lon; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < lat - 1; i++) {
    for (let j = 0; j < lon; j++) {
      idx.push(ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j));
    }
  }
  for (let j = 0; j < lon; j++) idx.push(south, ring(lat - 1, j), ring(lat - 1, j + 1));
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

describe('equivalencia con la pintura anterior (sin subdivisión)', () => {
  const brushCases: Array<[string, () => MeshData, Vec3, number, Vec3]> = [
    ['caja', () => box, [2, 20, 0], 6, [1, 1, 1]],
    ['caja escalada', () => box, [2, 20, 0], 6, [0.5, 1, 2]],
    ['esfera', () => sphere, [0, 24, 0], 6, [1, 1, 1]],
    ['nada en el radio', () => sphere, [500, 0, 0], 1, [1, 1, 1]],
  ];
  it.each(brushCases)('pincel en %s', (_name, mesh, center, radius, scale) => {
    const obj = sceneObject(mesh(), scale);
    const before = legacyPaintSphere(obj, center, radius, '#FF0000');
    const after = paintMeshFacesInSphere(obj, center, radius, '#FF0000', { refineEdge: false });
    expect(after.faceColors).toEqual(before.faceColors);
    // Segunda pasada sobre lo ya pintado: mismo resultado y misma referencia.
    const again = paintMeshFacesInSphere(sceneObject(after, scale), center, radius, '#ff0000', { refineEdge: false });
    expect(again).toBe(after);
  });

  it('radio mayor que la pieza: sin vista, solo lo anterior que mira como la cara más cercana', () => {
    const obj = sceneObject(sphere, [1.5, 1, 1]);
    const center: Vec3 = [0, 24, 0];
    const before = legacyPaintSphere(obj, center, 20, '#FF0000').faceColors!;
    const after = paintMeshFacesInSphere(obj, center, 20, '#FF0000', { refineEdge: false }).faceColors!;
    const P = sphere.positions, I = sphere.indices;
    let painted = 0;
    for (let t = 0; t < after.length; t++) {
      if (after[t] !== '#ff0000') continue;
      painted++;
      expect(before[t]).toBe('#ff0000');
      // Cara más cercana = polo norte (normal +Y): nada pintado de espaldas a ella.
      const ys = [0, 1, 2].map((k) => P[I[t * 3 + k] * 3 + 1]);
      expect(Math.max(...ys)).toBeGreaterThan(11.9);
    }
    expect(painted).toBeGreaterThan(0);
    expect(painted).toBeLessThan(before.filter((c) => c === '#ff0000').length);
  });

  it('relleno por región igual al anterior (caja, esfera, malla ya pintada)', () => {
    for (const [mesh, seed, angle] of [[box, 0, 30], [sphere, 10, 35], [sphere, 100, 5]] as const) {
      expect(paintFloodFillConnectedFaces(mesh, seed, '#00FF00', angle, '#abcdef').faceColors)
        .toEqual(legacyFloodFill(mesh, seed, '#00FF00', angle, '#abcdef').faceColors);
    }
    const painted = legacyPaintSphere(sceneObject(sphere), [0, 12, 0], 5, '#ff0000');
    expect(paintFloodFillConnectedFaces(painted, 3, '#0000ff', 20).faceColors)
      .toEqual(legacyFloodFill(painted, 3, '#0000ff', 20).faceColors);
  });

  it('pintar todo igual al anterior', () => {
    expect(paintEntireMesh(box, '#ABCDEF').faceColors).toEqual(legacyPaintEntire(box, '#ABCDEF').faceColors);
  });
});

describe('sin pasos vacíos', () => {
  it('pintar todo con el color que ya tiene devuelve la misma malla', () => {
    const once = paintEntireMesh(box, '#ff0000');
    expect(paintEntireMesh(once, '#FF0000')).toBe(once);
    // Sin colores por cara y con el color base del objeto: nada cambia a la vista.
    expect(paintEntireMesh(box, '#123456', '#123456')).toBe(box);
  });

  it('rellenar con el color que la región ya tiene devuelve la misma malla', () => {
    const once = paintFloodFillConnectedFaces(box, 0, '#ff0000', 30, '#123456');
    expect(paintFloodFillConnectedFaces(once, 0, '#ff0000', 30, '#123456')).toBe(once);
    expect(paintFloodFillConnectedFaces(box, 0, '#123456', 30, '#123456')).toBe(box);
  });

  it('el pincel con el color base sobre una malla sin pintar no la copia', () => {
    expect(paintMeshFacesInSphere(sceneObject(box), [0, 20, 0], 4, '#123456')).toBe(box);
  });
});

describe('tiempos sobre ~200 mil triángulos', () => {
  it('una muestra de pincel y un relleno son mucho más rápidos que antes', () => {
    const tris = big.indices.length / 3;
    expect(tris).toBeGreaterThan(190_000);
    const obj = sceneObject(big);
    const time = (fn: () => unknown, runs: number) => {
      const t0 = performance.now();
      for (let i = 0; i < runs; i++) fn();
      return (performance.now() - t0) / runs;
    };
    const centers: Vec3[] = Array.from({ length: 10 }, (_, i) => [Math.cos(i) * 40, Math.sin(i) * 40, 0]);
    let k = 0;
    const legacyBrush = time(() => legacyPaintSphere(obj, centers[k++ % 10], 3, '#ff0000'), 10);
    paintMeshFacesInSphere(obj, centers[0], 3, '#00ff00', { refineEdge: false }); // índice en caché
    k = 0;
    const newBrush = time(() => paintMeshFacesInSphere(obj, centers[k++ % 10], 3, '#ff0000', { refineEdge: false }), 10);
    const legacyFill = time(() => legacyFloodFill(big, 0, '#ff0000', 1), 3);
    paintFloodFillConnectedFaces(big, 0, '#00ff00', 1); // adyacencia en caché
    const newFill = time(() => paintFloodFillConnectedFaces(big, 0, '#ff0000', 1), 3);
    console.info(
      `[pintura] ${tris} triángulos — pincel: antes ${legacyBrush.toFixed(2)} ms, ahora ${newBrush.toFixed(2)} ms; ` +
        `relleno: antes ${legacyFill.toFixed(2)} ms, ahora ${newFill.toFixed(2)} ms`,
    );
    // Margen holgado: con la máquina cargada la razón baja (medido 3× justo); la meta fina vive en las pruebas perf.
    expect(newBrush).toBeLessThan(legacyBrush / 1.5);
    expect(newFill).toBeLessThan(legacyFill / 3);
  }, 120_000);
});

describe('borde fino por subdivisión', () => {
  it('subdivide los triángulos del borde, conserva la malla cerrada y el volumen', () => {
    const obj = sceneObject(box);
    const painted = paintMeshFacesInSphere(obj, [0, 20, 0], 4, '#ff0000', { refineEdge: true, maxNewTriangles: 4000 });
    expect(painted.indices.length).toBeGreaterThan(box.indices.length);
    expect(countUnpairedEdges(painted)).toBe(0);
    expect(signedVolumeMm3(painted)).toBeCloseTo(signedVolumeMm3(box), 3);
    expect(painted.faceColors).toHaveLength(painted.indices.length / 3);
    // El área pintada se acerca al disco π·r² (antes se pintaban caras enteras de 400 mm²).
    let area = 0;
    const p = painted.positions;
    for (let t = 0; t < painted.indices.length / 3; t++) {
      if (painted.faceColors![t] !== '#ff0000') continue;
      const [a, b, c] = [0, 1, 2].map((j) => painted.indices[t * 3 + j] * 3);
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    expect(area).toBeGreaterThan(Math.PI * 16 * 0.6);
    expect(area).toBeLessThan(Math.PI * 16 * 2);
  });

  it('respeta el tope de triángulos nuevos y es desactivable', () => {
    const obj = sceneObject(box);
    const capped = paintMeshFacesInSphere(obj, [0, 20, 0], 4, '#ff0000', { refineEdge: true, maxNewTriangles: 50 });
    expect(capped.indices.length / 3 - box.indices.length / 3).toBeLessThanOrEqual(50 + 8);
    expect(countUnpairedEdges(capped)).toBe(0);
    const off = paintMeshFacesInSphere(obj, [0, 20, 0], 4, '#ff0000', { refineEdge: false });
    expect(off.indices).toBe(box.indices);
  });

  it('los colores de la malla subdividida sobreviven a 3MF y .kura', () => {
    const painted = paintMeshFacesInSphere(sceneObject(box), [0, 20, 0], 4, '#ff0000', { refineEdge: true });
    const obj = { ...sceneObject(painted), stats: computeMeshStats(painted) };
    const model = read3MF(toBuffer(exportSceneTo3MF([obj], 'mm', 'bambu')), 'p.3mf');
    const imported = model.parts[0].mesh;
    const count = (m: MeshData, c: string) => m.faceColors!.filter((x) => x === c).length;
    expect(count(imported, '#ff0000')).toBe(count(painted, '#ff0000'));
    const doc = decodeProject(encodeProject({
      objects: [obj], selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
      customBedDimensions: { width: 200, depth: 200, height: 200 }, sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 1,
    }));
    expect(doc.objects[0].mesh.faceColors).toEqual(painted.faceColors);
  });
});
