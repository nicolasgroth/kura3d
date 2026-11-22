/**
 * @file src/engine/threads.ts
 * @description Roscas métricas ISO de 60° (perno, tuerca y macho negativo) con tabla ISO 261
 * de paso grueso M2–M64, paso automático por diámetro, validación tipada y una malla
 * helicoidal exacta: los vértices se ubican sobre las 4 hélices de quiebre del perfil y sobre
 * N columnas angulares, de modo que la malla es invariante ante el movimiento de tornillo
 * (girar 360°/N y avanzar paso/N). Así perno y tuerca generados con la misma N calzan igual
 * en cualquier fase de giro y la holgura radial queda garantizada (se compensa además el error
 * de cuerda de las columnas). Un M8×16 ronda 5–6 k triángulos (antes ~40 k).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData, ThreadOptions } from '../types/kura';
import { EngineError, requireNumberInRange } from './engineErrors';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from './manifoldKernel';
import { OPERATION_RANGES } from './operationLimits';

const THREAD_RANGES = OPERATION_RANGES.thread;

/** Tabla ISO 261 de paso grueso (diámetro nominal → paso en mm). */
export const ISO_COARSE_THREADS: ReadonlyArray<{ diameterMm: number; pitchMm: number }> = [
  { diameterMm: 2, pitchMm: 0.4 },
  { diameterMm: 2.5, pitchMm: 0.45 },
  { diameterMm: 3, pitchMm: 0.5 },
  { diameterMm: 3.5, pitchMm: 0.6 },
  { diameterMm: 4, pitchMm: 0.7 },
  { diameterMm: 5, pitchMm: 0.8 },
  { diameterMm: 6, pitchMm: 1.0 },
  { diameterMm: 7, pitchMm: 1.0 },
  { diameterMm: 8, pitchMm: 1.25 },
  { diameterMm: 10, pitchMm: 1.5 },
  { diameterMm: 12, pitchMm: 1.75 },
  { diameterMm: 14, pitchMm: 2.0 },
  { diameterMm: 16, pitchMm: 2.0 },
  { diameterMm: 18, pitchMm: 2.5 },
  { diameterMm: 20, pitchMm: 2.5 },
  { diameterMm: 22, pitchMm: 2.5 },
  { diameterMm: 24, pitchMm: 3.0 },
  { diameterMm: 27, pitchMm: 3.0 },
  { diameterMm: 30, pitchMm: 3.5 },
  { diameterMm: 33, pitchMm: 3.5 },
  { diameterMm: 36, pitchMm: 4.0 },
  { diameterMm: 42, pitchMm: 4.5 },
  { diameterMm: 48, pitchMm: 5.0 },
  { diameterMm: 56, pitchMm: 5.5 },
  { diameterMm: 64, pitchMm: 6.0 },
];

export const THREAD_MIN_DIAMETER_MM = THREAD_RANGES.diameterMm.min;
export const THREAD_MAX_DIAMETER_MM = THREAD_RANGES.diameterMm.max;
export const THREAD_MIN_PITCH_MM = THREAD_RANGES.pitchMm.min;

/** Paso ISO grueso para `diameterMm` (exacto si es nominal; si no, el del nominal inmediato inferior). */
export function isoCoarsePitch(diameterMm: number): number {
  let pitch = ISO_COARSE_THREADS[0].pitchMm;
  for (const row of ISO_COARSE_THREADS) {
    if (row.diameterMm <= diameterMm + 1e-9) pitch = row.pitchMm;
  }
  return pitch;
}

/** Paso máximo admitido para un diámetro (más grueso no deja núcleo útil). */
export function maxPitchForDiameter(diameterMm: number): number {
  return Math.max(0.25, diameterMm / 4);
}

/** Opciones de rosca con paso opcional (sin paso ⇒ ISO 261 grueso). */
export type ThreadRequest = Omit<ThreadOptions, 'pitchMm'> & { pitchMm?: number };

/** Parámetros resueltos y geometría derivada de una rosca. */
export interface ResolvedThread {
  kind: ThreadOptions['kind'];
  diameterMm: number;
  pitchMm: number;
  lengthMm: number;
  /** Holgura radial aplicada (mm); la holgura por flanco de 60° es la mitad. */
  radialClearanceMm: number;
  flankClearanceMm: number;
  columns: number;
}

/** Valida y resuelve las opciones (errores tipados en vez de correcciones silenciosas). */
export function resolveThreadOptions(options: ThreadRequest): ResolvedThread {
  const diameterMm = requireNumberInRange('diameterMm', options.diameterMm, THREAD_MIN_DIAMETER_MM, THREAD_MAX_DIAMETER_MM);
  const maxPitch = maxPitchForDiameter(diameterMm);
  let pitchMm: number;
  if (options.pitchMm === undefined) {
    pitchMm = isoCoarsePitch(diameterMm);
  } else if (!Number.isFinite(options.pitchMm) || options.pitchMm < THREAD_MIN_PITCH_MM || options.pitchMm > maxPitch) {
    throw new EngineError('THREAD_INVALID_PITCH', {
      pitch: String(options.pitchMm),
      diameter: diameterMm,
      min: THREAD_MIN_PITCH_MM,
      max: maxPitch,
      iso: isoCoarsePitch(diameterMm),
    });
  } else {
    pitchMm = options.pitchMm;
  }
  const lengthMm = requireNumberInRange('lengthMm', options.lengthMm, THREAD_RANGES.lengthMm.min, THREAD_RANGES.lengthMm.max);
  const radialClearanceMm =
    options.kind === 'bolt' ? 0 : requireNumberInRange(
      'clearanceMm', options.clearanceMm, THREAD_RANGES.clearanceMm.min, THREAD_RANGES.clearanceMm.max, 0.25);
  const columns = Math.min(96, Math.max(32, Math.ceil((Math.PI * diameterMm) / 0.6 / 8) * 8));
  return {
    kind: options.kind,
    diameterMm,
    pitchMm,
    lengthMm,
    radialClearanceMm,
    flankClearanceMm: radialClearanceMm * 0.5,
    columns,
  };
}

/** Quiebres de fase de un perfil: inicio y fin del valle, inicio y fin de la cresta. */
export type ProfileBreaks = readonly [number, number, number, number];

/** Perfil básico ISO 68-1 (tuerca y macho): valle 1/4 P en D1, cresta 1/8 P. */
export const BASIC_PROFILE_BREAKS: ProfileBreaks = [0, 0.25, 0.5625, 0.6875];

/**
 * Perfil del perno: los mismos flancos de 60° prolongados hasta el diámetro menor d3 = d − 1.22687·P
 * (ISO 724, h3 = 17/24·H), con fondo de 1/6 P. Como los flancos coinciden con los del perfil básico,
 * el perno solo puede quedar más holgado que la tuerca, nunca interferir.
 */
export const BOLT_PROFILE_BREAKS: ProfileBreaks = [1 / 24, 5 / 24, 0.5625, 0.6875];

/** Radio del perfil ISO 60° en la fase `phi` para los quiebres `b`. */
function profileRadius(phi: number, rMinor: number, rMajor: number, b: ProfileBreaks): number {
  let p = ((phi % 1) + 1) % 1;
  if (p < b[0]) p += 1;
  if (p <= b[1]) return rMinor;
  if (p <= b[2]) return rMinor + (rMajor - rMinor) * ((p - b[1]) / (b[2] - b[1]));
  if (p <= b[3]) return rMajor;
  return rMajor - (rMajor - rMinor) * ((p - b[3]) / (b[0] + 1 - b[3]));
}

/** Entrecaras s (mm) de cabezas y tuercas hexagonales ISO 4017 / ISO 4032, M3–M20. */
export const ISO_HEX_ACROSS_FLATS: Readonly<Record<number, number>> = {
  3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13, 10: 16, 12: 18, 14: 21, 16: 24, 18: 27, 20: 30,
};

/** Entrecaras del hexágono para `diameterMm`: tabla ISO si es nominal; si no, 1.55·d. */
export function hexAcrossFlats(diameterMm: number): number {
  return ISO_HEX_ACROSS_FLATS[diameterMm] ?? 1.55 * diameterMm;
}

/**
 * Malla cerrada de un cilindro roscado (hélice derecha) entre `z0` y `z1` en eje Z.
 * La fase es absoluta: φ = θ/2π − z/P, así que dos piezas con el mismo origen calzan en fase.
 */
export function buildHelicalThreadMesh(
  rMinor: number,
  rMajor: number,
  pitch: number,
  z0: number,
  z1: number,
  columns: number,
  breaks: ProfileBreaks = BASIC_PROFILE_BREAKS
): MeshData {
  const positions: number[] = [];
  const indices: number[] = [];
  const colVerts: number[][] = [];
  const colZ: number[][] = [];
  const eps = pitch * 1e-6;

  for (let i = 0; i < columns; i++) {
    const theta = (2 * Math.PI * i) / columns;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const u = i / columns;
    const zs: number[] = [z0];
    const rs: number[] = [profileRadius(u - z0 / pitch, rMinor, rMajor, breaks)];
    // Cruces de hélices de quiebre: z = P·(u − (m + b_q)), recorridos en z creciente
    const mStart = Math.floor(u - z1 / pitch) - 1;
    const mEnd = Math.ceil(u - z0 / pitch) + 1;
    const crossings: Array<[number, number]> = [];
    for (let m = mStart; m <= mEnd; m++) {
      for (let q = 0; q < 4; q++) {
        const z = pitch * (u - (m + breaks[q]));
        if (z > z0 + eps && z < z1 - eps) crossings.push([z, q < 2 ? rMinor : rMajor]);
      }
    }
    crossings.sort((a, b) => a[0] - b[0]);
    for (const [z, r] of crossings) {
      zs.push(z);
      rs.push(r);
    }
    zs.push(z1);
    rs.push(profileRadius(u - z1 / pitch, rMinor, rMajor, breaks));

    const ids: number[] = [];
    for (let k = 0; k < zs.length; k++) {
      ids.push(positions.length / 3);
      positions.push(rs[k] * c, rs[k] * s, zs[k]);
    }
    colVerts.push(ids);
    colZ.push(zs);
  }

  // Bandas laterales: cremallera monótona en z entre columnas vecinas (normal saliente)
  for (let i = 0; i < columns; i++) {
    const A = colVerts[i];
    const B = colVerts[(i + 1) % columns];
    const zA = colZ[i];
    const zB = colZ[(i + 1) % columns];
    let ia = 0;
    let ib = 0;
    while (ia < A.length - 1 || ib < B.length - 1) {
      const advanceA = ia < A.length - 1 && (ib === B.length - 1 || zA[ia + 1] < zB[ib + 1]);
      if (advanceA) {
        indices.push(A[ia], B[ib], A[ia + 1]);
        ia++;
      } else {
        indices.push(A[ia], B[ib], B[ib + 1]);
        ib++;
      }
    }
  }

  // Tapas planas
  const bottom = positions.length / 3;
  positions.push(0, 0, z0);
  const top = bottom + 1;
  positions.push(0, 0, z1);
  for (let i = 0; i < columns; i++) {
    const A = colVerts[i];
    const B = colVerts[(i + 1) % columns];
    indices.push(bottom, B[0], A[0]);
    indices.push(top, A[A.length - 1], B[B.length - 1]);
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Prisma hexagonal con bisel cónico en eje Z (`[0..height]`). */
function buildChamferedHexPrismZ(
  wasm: ManifoldToplevel,
  radius: number,
  height: number,
  chamferBothEnds: boolean
): Manifold {
  const handles: Manifold[] = [];
  try {
    const hex = wasm.Manifold.cylinder(height, radius, radius, 6, false);
    handles.push(hex);
    const chamferH = Math.min(height * 0.22, radius * 0.28);
    const outerR = radius * 1.12;
    const innerR = radius * 0.84;
    let envelope: Manifold;
    if (chamferBothEnds && height > chamferH * 2.5) {
      const midH = height - chamferH * 2;
      const bot = wasm.Manifold.cylinder(chamferH, innerR, outerR, 36, false);
      const midRaw = wasm.Manifold.cylinder(midH, outerR, outerR, 36, false);
      const mid = midRaw.translate([0, 0, chamferH]);
      const topRaw = wasm.Manifold.cylinder(chamferH, outerR, innerR, 36, false);
      const topC = topRaw.translate([0, 0, chamferH + midH]);
      handles.push(bot, midRaw, mid, topRaw, topC);
      envelope = wasm.Manifold.union([bot, mid, topC]);
    } else {
      const bodyH = Math.max(0.2, height - chamferH);
      const body = wasm.Manifold.cylinder(bodyH, outerR, outerR, 36, false);
      const topRaw = wasm.Manifold.cylinder(chamferH, outerR, innerR, 36, false);
      const topC = topRaw.translate([0, 0, bodyH]);
      handles.push(body, topRaw, topC);
      envelope = body.add(topC);
    }
    handles.push(envelope);
    return hex.intersect(envelope);
  } finally {
    for (const h of handles) h.delete();
  }
}

/** Radios de la rosca exterior (perno) y del macho negativo (tuerca/agujero) para `spec`. */
export function threadRadii(spec: ResolvedThread): {
  boltMinor: number;
  boltMajor: number;
  tapMinor: number;
  tapMajor: number;
} {
  const H = (Math.sqrt(3) / 2) * spec.pitchMm;
  const boltMajor = spec.diameterMm / 2;
  // Perno: d3 (ISO 724, h3 = 17/24 H). Tuerca/macho: D1 básico (5/8 H) más la holgura.
  const boltMinor = boltMajor - (17 / 24) * H;
  const basicMinor = boltMajor - (5 / 8) * H;
  // Error de cuerda de las columnas: la cuerda queda hasta r·(1−cos(π/N)) dentro del arco
  const sagitta = (boltMajor + spec.radialClearanceMm) * (1 - Math.cos(Math.PI / spec.columns));
  const extra = spec.kind === 'bolt' ? 0 : spec.radialClearanceMm + sagitta;
  return {
    boltMinor,
    boltMajor,
    tapMinor: basicMinor + extra,
    tapMajor: boltMajor + extra,
  };
}

/**
 * Genera una pieza roscada métrica ISO (perno `'bolt'`, tuerca `'nut'` o macho negativo `'hole'`)
 * apoyada sobre Y=0 con el eje en X=Z=0. Sin `pitchMm` usa el paso grueso ISO 261.
 *
 * @throws EngineError `THREAD_INVALID_PITCH` o `INVALID_PARAMETER` con datos fuera de rango.
 */
export async function createMetricThread(options: ThreadRequest): Promise<MeshData> {
  const spec = resolveThreadOptions(options);
  const wasm = await initManifoldEngine();
  const { boltMinor, boltMajor, tapMinor, tapMajor } = threadRadii(spec);
  const { pitchMm, lengthMm, columns, diameterMm } = spec;
  const hexRadius = hexAcrossFlats(diameterMm) / Math.sqrt(3);
  const handles: Manifold[] = [];
  const own = <T extends Manifold>(m: T): T => {
    handles.push(m);
    return m;
  };
  const solid = (rMin: number, rMaj: number, z0: number, z1: number, breaks = BASIC_PROFILE_BREAKS): Manifold =>
    own(meshDataToManifold(wasm, buildHelicalThreadMesh(rMin, rMaj, pitchMm, z0, z1, columns, breaks)));

  try {
    let resultZ: Manifold;
    if (options.kind === 'hole') {
      resultZ = solid(tapMinor, tapMajor, 0, lengthMm);
    } else if (options.kind === 'nut') {
      const hexBody = own(buildChamferedHexPrismZ(wasm, hexRadius, lengthMm, true));
      resultZ = own(hexBody.subtract(solid(tapMinor, tapMajor, -1, lengthMm + 1)));
    } else if (options.includeHead === false) {
      resultZ = solid(boltMinor, boltMajor, 0, lengthMm, BOLT_PROFILE_BREAKS);
    } else {
      const headH = Math.max(2.2, 0.65 * diameterMm);
      const head = own(buildChamferedHexPrismZ(wasm, hexRadius, headH, false));
      resultZ = own(head.add(solid(boltMinor, boltMajor, headH - 0.5, headH + lengthMm, BOLT_PROFILE_BREAKS)));
    }
    const rotatedY = own(resultZ.rotate([-90, 0, 0]));
    const mesh = manifoldToMeshData(rotatedY);
    // Apoya en Y=0 sin recentrar en XZ: el eje queda exactamente en el origen
    const minY = rotatedY.boundingBox().min[1];
    for (let v = 1; v < mesh.positions.length; v += 3) mesh.positions[v] -= minY;
    return mesh;
  } finally {
    for (const h of handles) h.delete();
  }
}
