/**
 * @file src/engine/__tests__/projectionStackedLayers.test.ts
 * @description Proyecciones apiladas: un grabado sobre un cilindro macizo que ya tiene un relieve
 * cilíndrico no debe medir el espesor contra la capa del relieve (falso PROJECTION_TOO_DEEP); el
 * resultado queda watertight y en un cuerpo (sin astillas del relieve cortado). Un relieve sobre
 * esfera no deja aristas dirigidas duplicadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { firstSolidThickness } from '../projectionThickness';
import { makeObject, shellCount } from './geometryTestUtils';

/** Aristas dirigidas repetidas tras soldar vértices por posición (0 en una malla 2-manifold). */
function duplicatedDirectedEdges(mesh: MeshData): number {
  const key = (i: number) =>
    `${Math.round(mesh.positions[i * 3] * 1e4)},${Math.round(mesh.positions[i * 3 + 1] * 1e4)},${Math.round(mesh.positions[i * 3 + 2] * 1e4)}`;
  const weld = new Map<string, number>();
  const id = (i: number) => {
    const k = key(i);
    let v = weld.get(k);
    if (v === undefined) weld.set(k, (v = weld.size));
    return v;
  };
  const seen = new Set<string>();
  let dup = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const v = [0, 1, 2].map((c) => id(mesh.indices[t * 3 + c]));
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    for (let e = 0; e < 3; e++) {
      const k = `${v[e]}>${v[(e + 1) % 3]}`;
      if (seen.has(k)) dup++;
      else seen.add(k);
    }
  }
  return dup;
}

describe('firstSolidThickness (projectionThickness.ts)', () => {
  it('ignora impactos rasantes en las paredes de un relieve y mide el sólido completo', () => {
    // Entra al relieve (0), roza su pared (0.97, rasante), sigue en el macizo y sale a 41
    expect(firstSolidThickness([
      { distance: 0, cosToRay: -1 },
      { distance: 0.97, cosToRay: 0.01 },
      { distance: 41, cosToRay: 1 },
    ])).toBeCloseTo(41, 6);
  });

  it('un rayo por una arista (dos caras a la misma distancia) cuenta un solo cruce', () => {
    expect(firstSolidThickness([
      { distance: 5, cosToRay: -0.7 },
      { distance: 5 + 1e-6, cosToRay: -0.7 },
      { distance: 7, cosToRay: 0.7 },
    ])).toBeCloseTo(2, 6);
  });

  it('dos cuerpos separados por aire: mide solo el primero; sin salida devuelve Infinity', () => {
    expect(firstSolidThickness([
      { distance: 1, cosToRay: -1 },
      { distance: 3, cosToRay: 1 },
      { distance: 10, cosToRay: -1 },
      { distance: 30, cosToRay: 1 },
    ])).toBeCloseTo(2, 6);
    expect(firstSolidThickness([{ distance: 1, cosToRay: -1 }])).toBe(Infinity);
  });
});

describe('Proyecciones apiladas sobre superficies curvas', () => {
  it('grabado de 1 mm sobre cilindro r20 con relieve cilíndrico previo no da PROJECTION_TOO_DEEP', async () => {
    const cyl = await createPrimitiveMesh('cylinder', { radius: 20, height: 40, segments: 64 });
    const embossed = await projectGraphicOntoSurface(makeObject('c', cyl), {
      kind: 'text',
      text: 'CURVA',
      mode: 'emboss',
      axis: 'cylindrical',
      widthMm: 30,
      depthMm: 1,
      colorHex: '#f97316',
    });
    const withRelief = makeObject('c2', embossed.mesh, { position: embossed.position });
    const before = computeMeshStats(embossed.mesh).volumeMm3;

    const engraved = await projectGraphicOntoSurface(withRelief, {
      kind: 'text',
      text: 'KURA',
      mode: 'deboss',
      axis: 'cylindrical',
      widthMm: 30,
      depthMm: 1,
      colorHex: '#22c55e',
    });
    const stats = computeMeshStats(engraved.mesh);
    expect(stats.isManifold).toBe(true);
    expect(await shellCount(engraved.mesh)).toBe(1);
    expect(stats.volumeMm3).toBeLessThan(before);
    // Las dimensiones del cilindro se conservan (diámetro 40 + relieve, altura 40)
    expect(stats.dimensionsMm[1]).toBeCloseTo(40, 0);
  });

  it('un grabado realmente más profundo que una placa con relieve sigue rechazándose', async () => {
    const plate = await createPrimitiveMesh('box', { width: 40, height: 30, depth: 2 });
    const embossed = await projectGraphicOntoSurface(makeObject('p', plate), {
      kind: 'text',
      text: 'KURA',
      mode: 'emboss',
      axis: '+z',
      widthMm: 24,
      depthMm: 1,
      colorHex: '#f97316',
    });
    await expect(
      projectGraphicOntoSurface(makeObject('p2', embossed.mesh, { position: embossed.position }), {
        kind: 'text',
        text: 'OK',
        mode: 'deboss',
        axis: '-z',
        widthMm: 14,
        depthMm: 2.5,
        colorHex: '#22c55e',
      })
    ).rejects.toMatchObject({ code: 'PROJECTION_TOO_DEEP' });
  });

  it('relieve sobre esfera: watertight y sin aristas dirigidas duplicadas', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 20, segments: 48 });
    const res = await projectGraphicOntoSurface(makeObject('s', sphere), {
      kind: 'text',
      text: 'CURVA',
      mode: 'emboss',
      axis: '+z',
      widthMm: 20,
      depthMm: 1,
      colorHex: '#f97316',
    });
    expect(computeMeshStats(res.mesh).isManifold).toBe(true);
    expect(duplicatedDirectedEdges(res.mesh)).toBe(0);
  });
});
