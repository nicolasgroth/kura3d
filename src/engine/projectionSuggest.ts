/**
 * @file src/engine/projectionSuggest.ts
 * @description Valores iniciales para proyectar texto sobre una pieza: la cara por defecto (la cara
 * plana más grande que mira a la cámara o, sin cámara, la de mayor área) y un ancho de texto que
 * cabe en esa cara con margen. Funciones puras para que la interfaz las use al abrir el diálogo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject, SurfaceProjectionAxis, Vec3 } from '../types/kura';
import { OPERATION_RANGES } from './operationLimits';
import { applyTransformToMesh } from './primitives';
import { DEFAULT_TEXT_FONT_ID, loadTextFont } from './text/fontRegistry';
import { layoutTextOutlines } from './text/textOutlines';

/** Caras planas proyectables (la envoltura cilíndrica no es una cara). */
export type PlanarProjectionAxis = Exclude<SurfaceProjectionAxis, 'cylindrical'>;

/** Cara plana candidata, en coordenadas de mundo. */
export interface ProjectionFaceCandidate {
  axis: PlanarProjectionAxis;
  /** Área del plano más grande con esa orientación (mm²). */
  areaMm2: number;
  /** Extensión del plano en las direcciones U (ancho del texto) y V (alto) de la proyección (mm). */
  uSpanMm: number;
  vSpanMm: number;
  /** Centro de la caja del plano (mm). */
  center: Vec3;
}

type Obj = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

/** Orden de preferencia ante áreas equivalentes: tapa, frente, derecha… y la base al final. */
const AXES: readonly PlanarProjectionAxis[] = ['+y', '+z', '+x', '-z', '-x', '-y'];
const NORMALS: Record<PlanarProjectionAxis, Vec3> = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1],
};
/** Ejes de mundo que recorren U y V en cada cara (según `buildProjectionRay`). */
const UV_AXES: Record<PlanarProjectionAxis, [number, number]> = {
  '+z': [0, 1], '-z': [0, 1], '+x': [2, 1], '-x': [2, 1], '+y': [0, 2], '-y': [0, 2],
};
/** Coseno mínimo entre la normal del triángulo y el eje para contarlo como parte de la cara. */
const FLAT_COS = 0.985;
/** Paso con que se agrupan triángulos coplanares (mm). */
const PLANE_STEP_MM = 0.05;
/** Áreas dentro de este margen relativo se consideran empatadas (gana el orden de preferencia). */
const AREA_TIE = 0.01;

interface PlaneBucket {
  area: number;
  min: Vec3;
  max: Vec3;
}

/**
 * Lista, para cada orientación, el plano más grande de la pieza (en mundo, con su transformación).
 * Una orientación sin caras planas no aparece.
 */
export function listProjectionFaces(obj: Obj): ProjectionFaceCandidate[] {
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const p = world.positions;
  const idx = world.indices;
  const buckets = new Map<string, PlaneBucket>();

  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    const n: Vec3 = [nx / len, ny / len, nz / len];
    for (const axis of AXES) {
      const k = axis[1] === 'x' ? 0 : axis[1] === 'y' ? 1 : 2;
      const sign = axis[0] === '+' ? 1 : -1;
      if (n[k] * sign < FLAT_COS) continue;
      const offset = Math.round((sign * (p[a + k] + p[b + k] + p[c + k])) / 3 / PLANE_STEP_MM);
      const key = `${axis}:${offset}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { area: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        buckets.set(key, bucket);
      }
      bucket.area += len / 2;
      for (const v of [a, b, c]) {
        for (let d = 0; d < 3; d++) {
          if (p[v + d] < bucket.min[d]) bucket.min[d] = p[v + d];
          if (p[v + d] > bucket.max[d]) bucket.max[d] = p[v + d];
        }
      }
      break;
    }
  }

  const best = new Map<PlanarProjectionAxis, PlaneBucket>();
  for (const [key, bucket] of buckets) {
    const axis = key.slice(0, 2) as PlanarProjectionAxis;
    const prev = best.get(axis);
    if (!prev || bucket.area > prev.area) best.set(axis, bucket);
  }
  return AXES.filter((axis) => best.has(axis)).map((axis) => {
    const { area, min, max } = best.get(axis)!;
    const [ui, vi] = UV_AXES[axis];
    return {
      axis,
      areaMm2: area,
      uSpanMm: max[ui] - min[ui],
      vSpanMm: max[vi] - min[vi],
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    };
  });
}

/** Elige la candidata de mayor área; ante empate (±1 %), la primera en el orden de preferencia. */
function largest(candidates: ProjectionFaceCandidate[]): ProjectionFaceCandidate | undefined {
  let pick: ProjectionFaceCandidate | undefined;
  for (const c of candidates) {
    if (!pick || c.areaMm2 > pick.areaMm2 * (1 + AREA_TIE)) pick = c;
  }
  return pick;
}

export interface SuggestFaceOptions {
  /** Posición de la cámara en mundo (mm); si se da, solo cuentan las caras que la miran. */
  cameraPosition?: Vec3;
}

/**
 * Cara por defecto para proyectar cuando el usuario no la indicó: la cara plana más grande que mira
 * a la cámara o, sin cámara (o si ninguna la mira), la de mayor área. En una placa acostada de
 * 60×4×40 devuelve `+y` (la cara de 60×40), nunca un canto. Sin caras planas (esfera, malla
 * orgánica) devuelve `+z`.
 */
export function suggestProjectionFace(obj: Obj, options: SuggestFaceOptions = {}): PlanarProjectionAxis {
  const faces = listProjectionFaces(obj);
  const cam = options.cameraPosition;
  if (cam) {
    const facing = faces.filter((f) => {
      const n = NORMALS[f.axis];
      return n[0] * (cam[0] - f.center[0]) + n[1] * (cam[1] - f.center[1]) + n[2] * (cam[2] - f.center[2]) > 0;
    });
    const pick = largest(facing);
    if (pick) return pick.axis;
  }
  return largest(faces)?.axis ?? '+z';
}

export interface SuggestWidthOptions {
  /** Fracción libre que se deja a cada lado del texto, en total (0,15 = 85 % de la cara). */
  margin?: number;
}

/** Extensión U/V de la caja de la pieza en mundo para una cara (respaldo si no hay plano). */
function boxSpans(obj: Obj, face: SurfaceProjectionAxis): [number, number] {
  const p = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale).positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    const d = i % 3;
    if (p[i] < min[d]) min[d] = p[i];
    if (p[i] > max[d]) max[d] = p[i];
  }
  const span = (d: number) => Math.max(0, max[d] - min[d]);
  if (face === 'cylindrical') {
    // Media vuelta de la envoltura alrededor de Y, y el alto de la pieza.
    return [(Math.PI * Math.max(span(0), span(2))) / 2, span(1)];
  }
  const [ui, vi] = UV_AXES[face];
  return [span(ui), span(vi)];
}

/**
 * Ancho inicial (mm) del texto proyectado para que quepa en la cara `face` con margen: el menor
 * entre el ancho de la cara y su alto multiplicado por la proporción ancho/alto del texto con la
 * fuente real. Redondeado hacia abajo a 0,1 mm y dentro del rango de `widthMm`.
 */
export async function suggestProjectionWidth(
  obj: Obj,
  face: SurfaceProjectionAxis,
  text: string,
  options: SuggestWidthOptions = {}
): Promise<number> {
  const R = OPERATION_RANGES.projection.widthMm;
  const keep = 1 - Math.min(0.9, Math.max(0, options.margin ?? 0.15));
  const plane = face === 'cylindrical' ? undefined : listProjectionFaces(obj).find((f) => f.axis === face);
  const [uSpan, vSpan] = plane ? [plane.uSpanMm, plane.vSpanMm] : boxSpans(obj, face);

  let aspect = 4; // respaldo si el texto está vacío o sin tinta
  const trimmed = text.trim();
  if (trimmed) {
    const face0 = await loadTextFont(DEFAULT_TEXT_FONT_ID);
    const { bounds } = layoutTextOutlines(face0, trimmed, { size: 10, toleranceMm: 0.2 });
    const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
    if (w > 0 && h > 0) aspect = w / h;
  }
  const width = Math.min(uSpan * keep, vSpan * keep * aspect);
  return Math.min(R.max, Math.max(R.min, Math.floor(width * 10) / 10));
}
