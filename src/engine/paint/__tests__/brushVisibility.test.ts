/**
 * @file src/engine/paint/__tests__/brushVisibility.test.ts
 * @description Regla única de visibilidad y conexión del pincel en todos sus caminos: selección rápida,
 * muestra con borde fino (subdivide), muestra sin vista (MCP/bus: dirección = normal de la cara más
 * cercana). Sobre una placa cerrada de 60×60×1 con la cámara arriba, ninguna cara de espaldas a la
 * cámara ni de la cara inferior queda pintada. El store y el trazo diferido: paintStrokeVisibility.test.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../..';
import { isClosedMesh } from '../../meshClosure';
import type { Vec3 } from '../../../types/kura';
import { paintMeshFacesInSphere } from '../brush';
import { selectBrushFaces } from '../brushSelect';
import { thinPlate } from './paintTestMeshes';
import { closedPlate, plateObject, wrongFaces } from './plateFixtures';

const RED = '#ff0000';
const EYE: Vec3 = [0, 100, 0];

describe('regla de visibilidad en el motor del pincel', () => {
  const plate = closedPlate();
  const obj = plateObject(plate);
  const center: Vec3 = [0.3, 0.5, 0.2];

  it.each([false, true])('placa de 1 mm, cámara arriba, refineEdge=%s: solo la cara superior', (refineEdge) => {
    const out = paintMeshFacesInSphere(obj, center, 3, RED, { refineEdge, view: { eye: EYE } });
    const r = wrongFaces(out, obj.color, EYE, -0.5);
    expect(r.painted).toBeGreaterThan(0);
    expect(r.back).toBe(0);
    expect(r.bottom).toBe(0);
  });

  it.each([false, true])('vista ortográfica hacia abajo, refineEdge=%s', (refineEdge) => {
    const out = paintMeshFacesInSphere(obj, center, 3, RED, { refineEdge, view: { viewDir: [0, -1, 0] } });
    expect(wrongFaces(out, obj.color, EYE, -0.5)).toMatchObject({ back: 0, bottom: 0 });
  });

  it.each([false, true])('sin vista (MCP/bus) usa la normal de la cara más cercana, refineEdge=%s', (refineEdge) => {
    const out = paintMeshFacesInSphere(obj, center, 3, RED, { refineEdge });
    const r = wrongFaces(out, obj.color, EYE, -0.5);
    expect(r.painted).toBeGreaterThan(0);
    expect(r.bottom).toBe(0);
    // Desde abajo, solo la cara inferior.
    const below = paintMeshFacesInSphere(obj, [0.3, -0.5, 0.2], 3, RED, { refineEdge });
    const rb = wrongFaces(below, obj.color, [0, -100, 0], 10);
    expect(rb.painted).toBeGreaterThan(0);
    expect(rb.back).toBe(0);
  });

  it('el refinado no subdivide la cara de atrás (no gasta el presupuesto en lo que no se ve)', () => {
    const out = paintMeshFacesInSphere(obj, center, 3, RED, { refineEdge: true, view: { eye: EYE } });
    let bottomTris = 0;
    for (let t = 0; t < out.indices.length / 3; t++) {
      if ([0, 1, 2].every((k) => out.positions[out.indices[t * 3 + k] * 3 + 1] < -0.45)) bottomTris++;
    }
    expect(bottomTris).toBe(60 * 60 * 2);
    // Sigue estanca, con el mismo volumen y medidas (los puntos nuevos caen sobre aristas existentes).
    expect(out.indices.length).toBeGreaterThan(plate.indices.length);
    expect(isClosedMesh(plate)).toBe(true);
    expect(isClosedMesh(out)).toBe(true);
    const stats = computeMeshStats(out);
    expect(stats.volumeMm3).toBeCloseTo(3600, 3);
    expect(stats.dimensionsMm.map((v) => Math.round(v * 1000) / 1000)).toEqual([60, 1, 60]);
  });

  it('sin semilla ni vista, la mancha se queda en la superficie conectada a la cara más cercana', () => {
    const a = thinPlate(20, 0.4, 10);
    const nVerts = a.positions.length / 3;
    const pos = new Float32Array(a.positions.length * 2);
    pos.set(a.positions);
    pos.set(a.positions.map((v, i) => (i % 3 === 1 ? v - 1 : v)), a.positions.length);
    const idx = new Uint32Array(a.indices.length * 2);
    idx.set(a.indices);
    idx.set(a.indices.map((v) => v + nVerts), a.indices.length);
    const faces = selectBrushFaces({ positions: pos, indices: idx }, { center: [0, 0.2, 0], radiusMm: 1.5, scale: [1, 1, 1] });
    expect(faces.length).toBeGreaterThan(0);
    expect(Array.from(faces).every((t) => t < a.indices.length / 6)).toBe(true);
  });
});
