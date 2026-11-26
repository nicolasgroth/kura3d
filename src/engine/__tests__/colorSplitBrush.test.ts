/**
 * @file src/engine/__tests__/colorSplitBrush.test.ts
 * @description "Separar por colores" sobre mallas pintadas con el pincel real (con "refinar al pintar",
 * que subdivide el borde del trazo): trazos irregulares sobre cilindro, esfera y texto 3D. Cada pieza
 * debe salir cerrada según la definición única del inspector (`computeMeshStats().isManifold`), sumar
 * el volumen original y no traer el aviso de defectos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MeshData } from '../../types/kura';
import { splitMeshByColorSolid } from '../colorSplitSolid';
import { initManifoldEngine } from '../manifoldKernel';
import { computeMeshStats } from '../primitives';
import { brushObj, paintedCylinder, paintedSphere, paintedText } from './brushPaintFixtures';

vi.setConfig({ testTimeout: 120_000 });

async function expectClosedSplit(mesh: MeshData) {
  const o = brushObj(mesh);
  expect(new Set(mesh.faceColors).size).toBe(2);
  const { parts, warnings } = await splitMeshByColorSolid(o, { depthMm: 1 });
  expect(parts.length).toBe(2);
  for (const p of parts) expect({ color: p.color, closed: computeMeshStats(p.mesh).isManifold }).toEqual({ color: p.color, closed: true });
  expect(warnings.map((w) => w.code)).not.toContain('SPLIT_COLOR_MESH_DEFECTS');
  const total = parts.reduce((s, p) => s + p.volumeMm3, 0);
  expect(Math.abs(total - o.stats.volumeMm3) / o.stats.volumeMm3).toBeLessThan(2e-3);
  return parts;
}

describe('separar por colores tras pintar con el pincel', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('cilindro con trazo irregular refinado: piezas cerradas', async () => {
    await expectClosedSplit(await paintedCylinder());
  });

  it('esfera con trazo irregular refinado: piezas cerradas', async () => {
    await expectClosedSplit(await paintedSphere());
  });

  it('texto 3D con trazo sobre la cara superior: el aviso calza con el estado real de cada pieza', async () => {
    // Límite conocido: las astillas de la triangulación de las letras pegadas a la arista viva impiden
    // el camino directo y el de booleanas puede dejar piezas abiertas. Lo exigible: el aviso nombra
    // exactamente las piezas que no cierran según el inspector (para ofrecer Reparar).
    const o = brushObj(await paintedText());
    const { parts, warnings } = await splitMeshByColorSolid(o, { depthMm: 1 });
    expect(parts.length).toBe(2);
    const open = parts.filter((p) => !computeMeshStats(p.mesh).isManifold).map((p) => p.color).sort();
    expect(parts.map((p) => p.closed)).toEqual(parts.map((p) => computeMeshStats(p.mesh).isManifold));
    const defects = warnings.find((w) => w.code === 'SPLIT_COLOR_MESH_DEFECTS');
    if (open.length === 0) expect(defects).toBeUndefined();
    else expect(String(defects?.params?.colors).split(', ').sort()).toEqual(open);
  });

  it('cilindro pintado: cada pieza informa `closed` igual que el inspector', async () => {
    const parts = await expectClosedSplit(await paintedCylinder());
    expect(parts.every((p) => p.closed)).toBe(true);
  });
});
