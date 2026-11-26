/**
 * @file src/engine/paint/brush.ts
 * @description Pincel esférico 3D: pinta los triángulos a menos de `radiusMm` (mm de mundo, con la
 * escala del objeto) del centro que cumplen la regla de visibilidad y conexión (`brushVisibility`):
 * de frente a la vista (o, sin vista, a la normal de la cara más cercana) y conectados a la semilla.
 * Con `refineEdge`, subdivide antes solo los triángulos visibles del borde para que el color siga el
 * círculo del pincel. Usa el escritor diferido para no copiar colores si nada cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { selectBrushFaces } from './brushSelect';
import { facesViewer, prepareBrush, type BrushQuery, type BrushView } from './brushVisibility';
import { DEFAULT_MAX_NEW_TRIANGLES, refineBrushEdge } from './edgeRefine';
import { FaceColorWriter, withFaceColors } from './faceColors';

export interface BrushOptions {
  /** Subdivide los triángulos del borde del trazo (por defecto no). */
  refineEdge?: boolean;
  /** Tope de triángulos nuevos por muestra (por defecto 2000). */
  maxNewTriangles?: number;
  /** Cámara o dirección de vista y cara bajo el puntero; sin ella, se usa la cara más cercana. */
  view?: BrushView;
}

/**
 * Pinta con `colorHex` los triángulos cuya distancia exacta a `localCenter` sea ≤ `radiusMm`.
 * Las distancias se miden con la escala del objeto (rotación y traslación no las alteran). Devuelve
 * la misma malla si ningún color cambia.
 */
export function paintMeshFacesInSphere(
  obj: SceneObject,
  localCenter: Vec3,
  radiusMm: number,
  colorHex: string,
  options: BrushOptions = {},
): MeshData {
  const s = (obj.scale ?? [1, 1, 1]).map((v) => Math.abs(v) || 1) as [number, number, number];
  const c: [number, number, number] = [localCenter[0] * s[0], localCenter[1] * s[1], localCenter[2] * s[2]];
  const r = radiusMm;
  const hex = colorHex.toLowerCase();
  const base = obj.color.toLowerCase();
  const query: BrushQuery = { ...options.view, center: localCenter, radiusMm, scale: obj.scale ?? [1, 1, 1] };
  // La vista se resuelve una vez sobre la malla original y vale igual para la subdividida.
  const prepared = prepareBrush(obj.mesh, query);

  const mesh = options.refineEdge
    ? refineBrushEdge(obj.mesh, s, c, r, options.maxNewTriangles ?? DEFAULT_MAX_NEW_TRIANGLES, (m, t) => facesViewer(m, t, prepared))
    : obj.mesh;
  const refined = mesh !== obj.mesh;
  const { positions: P, indices: I } = mesh;
  const rSq = r * r;

  // Subdividir renumera las caras: la semilla del puntero ya no aplica (se toma la más cercana).
  const touched = Array.from(selectBrushFaces(mesh, refined ? { ...query, seedFace: null } : query, prepared));
  // Con el borde subdividido se pinta por centroide (el color sigue el círculo); si el pincel es
  // más chico que todo triángulo tocado, se vuelve a "pintar lo que toca".
  let paint = touched;
  if (refined) {
    const inside = touched.filter((t) => centroidDistSq(P, I, t, s, c) <= rSq);
    if (inside.length > 0) paint = inside;
  }
  const writer = new FaceColorWriter(mesh, base);
  for (const t of paint) writer.set(t, hex);
  const colors = writer.result();
  // Subdividir sin cambiar ningún color no aporta nada: se descarta (sin paso de historial).
  if (!colors) return refined ? obj.mesh : mesh;
  return withFaceColors(mesh, colors);
}

function centroidDistSq(P: Float32Array, I: Uint32Array, t: number, s: Vec3, c: Vec3): number {
  let d = 0;
  for (let a = 0; a < 3; a++) {
    const m = ((P[I[t * 3] * 3 + a] + P[I[t * 3 + 1] * 3 + a] + P[I[t * 3 + 2] * 3 + a]) / 3) * s[a];
    d += (m - c[a]) ** 2;
  }
  return d;
}
