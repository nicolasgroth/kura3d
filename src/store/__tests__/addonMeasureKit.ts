/**
 * @file src/store/__tests__/addonMeasureKit.ts
 * @description Mediciones del resultado de los agregados negativos con el motor real (ojo de cerradura, paso de
 * cable): volumen de la intersección de dos piezas (¿un cilindro de prueba choca con el material?), cilindro de prueba
 * orientado en coordenadas locales de un agregado, género de una malla cerrada (agujeros pasantes) y el documento
 * mínimo para codificar un `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fromLocal, type UprightFrame } from '../../core/addons/faceFrame';
import { stadiumLoftMesh } from '../../core/addons/stadiumMesh';
import { computeMeshStats, runBooleanOperation } from '../../engine';
import type { ProjectDocument } from '../../project/projectCodec';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { store } from './magnetTestKit';

type Posed = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

const asObject = (o: Posed, id: string): SceneObject => ({
  id, name: id, source: 'imported', role: 'solid', visible: true, locked: false, color: '#888888',
  mesh: o.mesh, position: o.position, rotation: o.rotation, scale: o.scale,
  stats: computeMeshStats(o.mesh),
}) as unknown as SceneObject;

/** Volumen (mm³) de la intersección de dos piezas; 0 si no se tocan. */
export async function intersectionVolume(a: Posed, b: Posed): Promise<number> {
  try {
    const r = await runBooleanOperation(asObject(a, 'a'), asObject(b, 'b'), 'intersect');
    if (r.mesh.indices.length === 0) return 0;
    return Math.abs(computeMeshStats(r.mesh).volumeMm3);
  } catch {
    return 0;
  }
}

/**
 * Cilindro de prueba de radio `radius` con su eje en la normal de la cara, centrado en (x, 0, z) locales y de
 * `y0` a `y1` sobre el eje (coordenadas locales del agregado con origen `origin`).
 */
export function probeCylinder(frame: Pick<UprightFrame, 'axis' | 'x' | 'z' | 'rotation'>, origin: Vec3, x: number, y0: number, y1: number, radius: number): Posed {
  return {
    mesh: stadiumLoftMesh({ straightMm: 0, rings: [{ y: y0, radius }, { y: y1, radius }] }),
    position: fromLocal(frame, origin, [x, 0, 0]),
    rotation: frame.rotation,
    scale: [1, 1, 1],
  };
}

/** Género de una malla cerrada de un cuerpo (χ = V − A + C = 2 − 2g), tras soldar vértices por posición. */
export function genusOf(mesh: MeshData): number {
  const key = (i: number) => `${Math.round(mesh.positions[i * 3] * 1e4)},${Math.round(mesh.positions[i * 3 + 1] * 1e4)},${Math.round(mesh.positions[i * 3 + 2] * 1e4)}`;
  const ids = new Map<string, number>();
  const node = (v: number) => {
    const k = key(v);
    let id = ids.get(k);
    if (id === undefined) { id = ids.size; ids.set(k, id); }
    return id;
  };
  const edges = new Set<string>();
  let faces = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = [node(mesh.indices[t]), node(mesh.indices[t + 1]), node(mesh.indices[t + 2])];
    if (tri[0] === tri[1] || tri[1] === tri[2] || tri[0] === tri[2]) continue;
    faces += 1;
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }
  const chi = ids.size - edges.size + faces;
  return (2 - chi) / 2;
}

/** Documento mínimo del estado actual del store (para codificar un `.kura`). */
export function docOf(objects: SceneObject[] = store().objects): ProjectDocument {
  const s = store();
  return {
    objects, groups: s.groups, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: s.printerProfile,
    customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
  };
}

/** Aplica las restas sobre toda la escena y devuelve la pieza resultante. */
export async function applyAllHoles(hostId: string): Promise<SceneObject> {
  store().clearSelection();
  await store().applyHolesOnSolids();
  return store().objects.find((o) => o.id === hostId)!;
}
