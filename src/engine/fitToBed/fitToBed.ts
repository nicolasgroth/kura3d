/**
 * @file src/engine/fitToBed/fitToBed.ts
 * @description "Ajustar a la impresora" (`fit_to_bed`), función pura: mide el bloque de objetos con
 * su transformación (caja mundial, una pasada por vértice, sin copiar la malla), prueba las 24
 * orientaciones ortogonales y devuelve las alternativas comparables: solo escalar, girar sin
 * escalar, girar y escalar, y dividir. `planFitTransforms` calcula la transformación final de cada
 * objeto (girado como bloque, escalado, centrado en la cama y apoyado en Z = 0).
 * Factor por eje: (cama − 2·margen) / tamaño, como en Dividir para imprimir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { FIT_ORIENTATIONS, internalMatrix, orientationPublic, rotatedSize, type OrientationEntry } from './fitOrientations';
import type {
  FitAlternative, FitAlternativeKind, FitBed, FitBodyInput, FitToBedAnalysis, FitToBedOptions, FitTransform, FitWarning,
} from './fitToBedTypes';

export const FIT_DEFAULTS = { marginMm: 5, minScale: 0.5, thinWallFactor: 0.8, referenceWallMm: 1.2 } as const;

/** Caja mundial del bloque en ejes internos (Y arriba). */
interface InternalBox { min: Vec3; max: Vec3 }

function bodyMatrix(b: FitBodyInput): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...b.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ')),
    new THREE.Vector3(...b.scale),
  );
}

function internalBox(bodies: readonly FitBodyInput[]): InternalBox {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) {
    const e = bodyMatrix(b).elements;
    const p = b.mesh.positions;
    for (let i = 0; i + 2 < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (wx < min[0]) min[0] = wx; if (wx > max[0]) max[0] = wx;
      if (wy < min[1]) min[1] = wy; if (wy > max[1]) max[1] = wy;
      if (wz < min[2]) min[2] = wz; if (wz > max[2]) max[2] = wz;
    }
  }
  if (!Number.isFinite(min[0])) throw new EngineError('MESH_EMPTY');
  return { min, max };
}

/** Tamaño del bloque en ejes del usuario (X, Y fondo, Z altura) y su caja interna. */
export function measureFitBlock(bodies: readonly FitBodyInput[]): { sizeMm: Vec3; box: InternalBox } {
  const box = internalBox(bodies);
  const d = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
  return { sizeMm: [d[0], d[2], d[1]], box };
}

/** Redondea hacia abajo a 4 decimales: el factor informado nunca hace que el bloque se pase. */
const floor4 = (v: number) => Math.floor(v * 10_000 + 1e-7) / 10_000;
const EPS = 1e-6;

function usableOf(bed: FitBed): Vec3 {
  const sides: Array<[string, number]> = [['widthMm', bed.widthMm], ['depthMm', bed.depthMm], ['heightMm', bed.heightMm]];
  for (const [name, v] of sides) {
    if (!(Number.isFinite(v) && v > 0)) throw new EngineError('INVALID_PARAMETER', { name, value: String(v), min: 0, max: 10_000 });
  }
  const m = bed.marginMm;
  const usable: Vec3 = [bed.widthMm - 2 * m, bed.depthMm - 2 * m, bed.heightMm - 2 * m];
  if (!(Number.isFinite(m) && m >= 0) || usable.some((v) => !(v > 0))) {
    throw new EngineError('INVALID_PARAMETER', {
      name: 'marginMm', value: String(m), min: 0, max: Math.min(bed.widthMm, bed.depthMm, bed.heightMm) / 2,
    });
  }
  return usable;
}

interface Candidate { o: OrientationEntry; size: Vec3; raw: number }

const rawFactor = (size: Vec3, usable: Vec3) =>
  Math.min(...size.map((s, i) => (s > EPS ? usable[i] / s : Infinity)));

/** Mejor de un conjunto: mayor factor; empate → misma cara apoyada, menor altura, mayor huella, menor índice. */
function better(a: Candidate, b: Candidate): boolean {
  const fa = floor4(Math.min(a.raw, 1)), fb = floor4(Math.min(b.raw, 1));
  if (fa !== fb) return fa > fb;
  const ka = a.o.downFace === '-z' ? 0 : 1, kb = b.o.downFace === '-z' ? 0 : 1;
  if (ka !== kb) return ka < kb;
  if (Math.abs(a.size[2] - b.size[2]) > EPS) return a.size[2] < b.size[2];
  const areaA = a.size[0] * a.size[1], areaB = b.size[0] * b.size[1];
  if (Math.abs(areaA - areaB) > EPS) return areaA > areaB;
  return a.o.index < b.o.index;
}

function scaleWarnings(factor: number, opts: Required<FitToBedOptions>): FitWarning[] {
  const out: FitWarning[] = [];
  if (factor < opts.minScale) out.push({ code: 'FIT_BELOW_MIN_SCALE', params: { factor, minFactor: opts.minScale } });
  if (factor < opts.thinWallFactor) {
    out.push({ code: 'FIT_THIN_WALLS', params: { factor, wallMm: +(FIT_DEFAULTS.referenceWallMm * factor).toFixed(2) } });
  }
  return out;
}

function alternative(kind: FitAlternativeKind, c: Candidate, factor: number, opts: Required<FitToBedOptions>): FitAlternative {
  const changesDownFace = c.o.downFace !== '-z';
  const warnings = scaleWarnings(factor, opts);
  if (changesDownFace) warnings.push({ code: 'FIT_DOWN_FACE_CHANGED', params: { downFace: c.o.downFace } });
  return {
    kind, available: true, factor, sizeMm: c.size.map((s) => s * factor) as Vec3,
    orientation: orientationPublic(c.o), changesDownFace, recommended: false, warnings,
  };
}

/** Analiza el bloque contra la cama y devuelve las cuatro alternativas (en orden fijo). */
export function analyzeFitToBed(
  bodies: readonly FitBodyInput[],
  bed: FitBed,
  options: FitToBedOptions = {},
): FitToBedAnalysis {
  if (bodies.length === 0) throw new EngineError('MESH_EMPTY');
  const opts: Required<FitToBedOptions> = {
    minScale: options.minScale ?? FIT_DEFAULTS.minScale,
    thinWallFactor: options.thinWallFactor ?? FIT_DEFAULTS.thinWallFactor,
  };
  const usable = usableOf(bed);
  const { sizeMm } = measureFitBlock(bodies);
  const candidates: Candidate[] = FIT_ORIENTATIONS.map((o) => {
    const size = rotatedSize(o.user, sizeMm);
    return { o, size, raw: rawFactor(size, usable) };
  });
  const current = candidates[0];
  const fitsAsIs = current.raw >= 1 - EPS;

  const scaleFactor = floor4(Math.min(current.raw, 1));
  const scale = alternative('scale', current, scaleFactor, opts);

  const fitting = candidates.filter((c) => c.raw >= 1 - EPS);
  // Girar sin escalar: la primera en orden de prioridad (cara actual, giro sobre Z, otras caras).
  const rotateCandidate = fitting[0];
  const rotate = rotateCandidate
    ? alternative('rotate', rotateCandidate, 1, opts)
    : { ...alternative('rotate', current, 1, opts), available: false, reason: 'noOrientationFits' as const, warnings: [] };

  const best = candidates.reduce((acc, c) => (better(c, acc) ? c : acc), candidates[0]);
  const bestFactor = floor4(Math.min(best.raw, 1));
  const rotateScale = alternative('rotateScale', best, bestFactor, opts);

  const fitsWithRotation = fitting.length > 0;
  const split: FitAlternative = {
    kind: 'split', available: !fitsWithRotation, factor: 1, sizeMm: [...sizeMm] as Vec3,
    orientation: orientationPublic(current.o), changesDownFace: false, recommended: false, warnings: [],
    ...(fitsWithRotation ? { reason: 'fitsWithoutSplit' as const } : {}),
  };

  if (fitsAsIs) {
    for (const a of [scale, rotate, rotateScale]) Object.assign(a, { available: false, reason: 'alreadyFits', warnings: [] });
    split.reason = 'alreadyFits';
  } else {
    if (rotate.available) Object.assign(rotateScale, { available: false, reason: 'sameAsRotate' });
    // Si la mejor orientación es la actual (o rinde lo mismo), girar y escalar no aporta: se oculta.
    else if (bestFactor <= scaleFactor) Object.assign(rotateScale, { available: false, reason: 'sameAsScale' });
    // Una sola sugerencia: girar si cabe a tamaño real; si no, dividir bajo la escala mínima; si no, el mayor factor.
    if (rotate.available) rotate.recommended = true;
    else if (bestFactor < opts.minScale) split.recommended = true;
    else (rotateScale.available ? rotateScale : scale).recommended = true;
  }
  return { sizeMm, usableMm: usable, fitsAsIs, alternatives: [scale, rotate, rotateScale, split] };
}

const snap = (v: number) => {
  const k = Math.round(v / (Math.PI / 2));
  const s = Math.abs(v - k * (Math.PI / 2)) < 1e-9 ? k * (Math.PI / 2) : v;
  return s + 0;
};

/**
 * Transformación final de cada objeto: el bloque se gira con la orientación elegida, se escala por
 * `factor` (uniforme) y queda centrado en la cama (X = Y = 0) y apoyado (Z = 0). Ejes internos.
 */
export function planFitTransforms(
  bodies: readonly FitBodyInput[],
  choice: { orientationIndex: number; factor: number },
): Record<string, FitTransform> {
  const o = FIT_ORIENTATIONS[choice.orientationIndex];
  if (!o) throw new EngineError('INVALID_PARAMETER', { name: 'orientationIndex', value: String(choice.orientationIndex), min: 0, max: 23 });
  const f = choice.factor;
  if (!(Number.isFinite(f) && f > 0)) throw new EngineError('INVALID_PARAMETER', { name: 'factor', value: String(f), min: 0, max: 1 });
  const { box } = measureFitBlock(bodies);
  const c = new THREE.Vector3((box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2);
  const half = [(box.max[0] - box.min[0]) / 2, (box.max[1] - box.min[1]) / 2, (box.max[2] - box.min[2]) / 2];
  const r = internalMatrix(o.user);
  // Media altura del bloque girado: fila Y de |R|·half.
  const halfY = Math.abs(r[3]) * half[0] + Math.abs(r[4]) * half[1] + Math.abs(r[5]) * half[2];
  const m3 = new THREE.Matrix4().set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
  const qBlock = new THREE.Quaternion().setFromRotationMatrix(m3);
  const out: Record<string, FitTransform> = {};
  for (const b of bodies) {
    const p = new THREE.Vector3(...b.position).sub(c).applyMatrix4(m3).multiplyScalar(f);
    p.y += halfY * f;
    const q = qBlock.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ')));
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    out[b.id] = {
      position: [p.x + 0, p.y + 0, p.z + 0],
      rotation: [snap(e.x), snap(e.y), snap(e.z)],
      scale: [b.scale[0] * f, b.scale[1] * f, b.scale[2] * f],
    };
  }
  return out;
}
