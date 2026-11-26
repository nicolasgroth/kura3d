/**
 * @file src/core/scene/cameraFraming.ts
 * @description Política única de encuadre de cámara: caja envolvente de lo afectado, prueba de si ya
 * está completamente a la vista, distancia exacta (campo de visión vertical y relación de aspecto
 * reales) para que la caja entre entera con margen dentro del área libre del lienzo, elección de una
 * dirección de vista desde la que lo afectado no quede tapado por otros objetos y criterio de
 * reencuadre tras editar un tamaño. Funciones puras, sin dependencia del visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { SceneObject } from '../../types/kura';
import { worldBox } from './overlap';

export type Vec3 = [number, number, number];

export interface FrameBox {
  min: Vec3;
  max: Vec3;
}

/** Margen por defecto: la caja ocupa como máximo ~67 % del encuadre (deja sitio a las barras flotantes del visor) en su eje más ajustado. */
export const DEFAULT_FRAME_MARGIN = 1.5;

/** Caja envolvente en mundo de varios objetos (null si ninguno tiene malla). */
export function boxForObjects(
  objects: ReadonlyArray<Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>>,
): FrameBox | null {
  const total = new THREE.Box3();
  for (const obj of objects) {
    const box = worldBox(obj);
    if (box) total.union(box);
  }
  if (total.isEmpty()) return null;
  return { min: total.min.toArray() as Vec3, max: total.max.toArray() as Vec3 };
}

function corners(box: FrameBox): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [box.min[0], box.max[0]])
    for (const y of [box.min[1], box.max[1]])
      for (const z of [box.min[2], box.max[2]]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

export function boxCenter(box: FrameBox): Vec3 {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

/** Franjas del lienzo tapadas por avisos, barras o paneles, como fracción (0–1) de su alto o ancho. */
export interface ViewInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FitParams {
  box: FrameBox;
  /** Dirección desde el objetivo hacia la cámara (no hace falta normalizarla). */
  viewDir: Vec3;
  /** Campo de visión vertical en grados (como `PerspectiveCamera.fov`). */
  fovDeg: number;
  /** Ancho / alto del lienzo. */
  aspect: number;
  margin?: number;
  /** Vector "arriba" del mundo; por defecto +Y (la altura en la convención interna). */
  up?: Vec3;
  /** Área del lienzo ocupada por la interfaz: se encuadra dentro del área libre real. */
  insets?: ViewInsets;
}

/** Fracción libre mínima por eje: franjas exageradas no deben dejar el encuadre sin sitio. */
const MIN_FREE = 0.35;

/** Fracción libre (ancho, alto) y centro del área libre en coordenadas normalizadas (−1…1). */
export function freeArea(insets?: ViewInsets): { fw: number; fh: number; cx: number; cy: number } {
  if (!insets) return { fw: 1, fh: 1, cx: 0, cy: 0 };
  const clamp = (v: number) => Math.min(0.6, Math.max(0, Number.isFinite(v) ? v : 0));
  const shrink = (a: number, b: number): [number, number] => {
    if (1 - a - b >= MIN_FREE) return [a, b];
    const k = (1 - MIN_FREE) / Math.max(1e-6, a + b);
    return [a * k, b * k];
  };
  const [top, bottom] = shrink(clamp(insets.top), clamp(insets.bottom));
  const [left, right] = shrink(clamp(insets.left), clamp(insets.right));
  return { fw: 1 - left - right, fh: 1 - top - bottom, cx: left - right, cy: bottom - top };
}

function cameraBasis(viewDir: Vec3, up: Vec3 = [0, 1, 0]) {
  const forward = new THREE.Vector3(...viewDir);
  if (forward.lengthSq() < 1e-12) forward.set(0, 0, 1);
  forward.normalize();
  let worldUp = new THREE.Vector3(...up).normalize();
  if (Math.abs(forward.dot(worldUp)) > 0.999) worldUp = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
  const camUp = new THREE.Vector3().crossVectors(forward, right).normalize();
  return { forward, right, camUp };
}

/**
 * Distancia desde el centro de la caja a la que debe ponerse la cámara, mirando por `viewDir`,
 * para que las 8 esquinas queden dentro del tronco de visión con el margen pedido.
 * Para una esquina con desplazamiento lateral x, vertical y y profundidad z (hacia la cámara):
 * d ≥ z + |x|·m / tan(hfov/2) y d ≥ z + |y|·m / tan(vfov/2). Con `insets`, las tangentes se
 * escalan por la fracción libre del lienzo.
 */
export function fitDistance({ box, viewDir, fovDeg, aspect, margin = DEFAULT_FRAME_MARGIN, up = [0, 1, 0], insets }: FitParams): number {
  const { forward, right, camUp } = cameraBasis(viewDir, up);
  const { fw, fh } = freeArea(insets);
  const tan = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const tanV = tan * fh;
  const tanH = tan * Math.max(1e-3, aspect) * fw;
  const center = new THREE.Vector3(...boxCenter(box));
  let distance = 0;
  for (const corner of corners(box)) {
    const rel = corner.sub(center);
    const x = Math.abs(rel.dot(right)) * margin;
    const y = Math.abs(rel.dot(camUp)) * margin;
    const z = rel.dot(forward);
    distance = Math.max(distance, z + x / tanH, z + y / tanV);
  }
  // Una caja degenerada (un punto) no debe dejar la cámara encima del objeto.
  return Math.max(distance, 1);
}

/** Área libre del lienzo: paneles que tapan cada borde (px) y tamaño del lienzo (px). */
export interface FreeArea {
  insets: ViewInsets;
  width: number;
  height: number;
}

/**
 * true si todas las esquinas de la caja caen dentro del encuadre de la cámara (NDC en [-limit, limit]
 * y delante de la cámara). Con `free`, el encuadre es solo el área que no tapan los paneles.
 * `viewProjection` es `projectionMatrix × matrixWorldInverse` en orden column-major (`Matrix4.elements`).
 */
export function isBoxInView(box: FrameBox, viewProjection: ArrayLike<number>, limit = 0.96, free?: FreeArea): boolean {
  const m = new THREE.Matrix4().fromArray(Array.from(viewProjection));
  const pad = 1 - limit;
  const w = free && free.width > 0 ? free.width : 0;
  const h = free && free.height > 0 ? free.height : 0;
  const minX = (w ? -1 + (2 * free!.insets.left) / w : -1) + pad;
  const maxX = (w ? 1 - (2 * free!.insets.right) / w : 1) - pad;
  const minY = (h ? -1 + (2 * free!.insets.bottom) / h : -1) + pad;
  const maxY = (h ? 1 - (2 * free!.insets.top) / h : 1) - pad;
  for (const corner of corners(box)) {
    const v = new THREE.Vector4(corner.x, corner.y, corner.z, 1).applyMatrix4(m);
    if (v.w <= 1e-6) return false;
    const nx = v.x / v.w;
    const ny = v.y / v.w;
    const nz = v.z / v.w;
    if (nx < minX || nx > maxX || ny < minY || ny > maxY || nz < -1 || nz > 1) return false;
  }
  return true;
}

export interface FramePose {
  position: Vec3;
  target: Vec3;
  distance: number;
}

/**
 * Pose de cámara que encuadra la caja manteniendo la dirección de vista dada. Con `insets`, el
 * objetivo se corre para que la caja quede centrada en el área libre del lienzo.
 */
export function framePose(params: FitParams & { minDistance?: number; maxDistance?: number }): FramePose {
  const { minDistance = 0, maxDistance = Infinity } = params;
  const distance = Math.min(maxDistance, Math.max(minDistance, fitDistance(params)));
  const { forward, right, camUp } = cameraBasis(params.viewDir, params.up);
  const { cx, cy } = freeArea(params.insets);
  const tanV = Math.tan(THREE.MathUtils.degToRad(params.fovDeg) / 2);
  const tanH = tanV * Math.max(1e-3, params.aspect);
  // La caja debe verse en (cx, cy) del lienzo: el objetivo se corre en sentido contrario.
  const target = new THREE.Vector3(...boxCenter(params.box))
    .addScaledVector(right, -cx * distance * tanH)
    .addScaledVector(camUp, -cy * distance * tanV);
  const position = target.clone().addScaledVector(forward, distance);
  return { target: target.toArray() as Vec3, distance, position: position.toArray() as Vec3 };
}

/** true si el segmento a→b atraviesa la caja (prueba de franjas). */
export function segmentHitsBox(a: Vec3, b: Vec3, box: FrameBox): boolean {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-12) {
      if (a[i] < box.min[i] || a[i] > box.max[i]) return false;
      continue;
    }
    let ta = (box.min[i] - a[i]) / d;
    let tb = (box.max[i] - a[i]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Direcciones candidatas: la actual primero, luego ocho vistas isométricas alrededor y una alta. */
export function candidateViewDirs(current: Vec3): Vec3[] {
  const out: Vec3[] = [current];
  const elev = THREE.MathUtils.degToRad(35);
  for (let k = 0; k < 8; k++) {
    const az = THREE.MathUtils.degToRad(50 + k * 45);
    out.push([Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az)]);
  }
  const high = THREE.MathUtils.degToRad(65);
  out.push([Math.cos(high) * 0.6, Math.sin(high), Math.cos(high) * 0.8]);
  return out;
}

/**
 * Elige, entre `candidates`, la dirección desde la que la caja queda menos tapada por `blockers`
 * (cajas de otros objetos): se trazan segmentos desde el centro y las esquinas (al 80 %) hasta la
 * cámara y se cuentan los que cruzan una caja ajena. En empate gana la primera (la vista actual).
 */
export function chooseUnoccludedViewDir(
  params: Omit<FitParams, 'viewDir'> & { candidates: Vec3[]; blockers: FrameBox[]; minDistance?: number; maxDistance?: number },
): Vec3 {
  const { candidates, blockers, ...fit } = params;
  if (candidates.length === 0) return [0.72, 0.62, 0.85];
  if (blockers.length === 0) return candidates[0];
  const center = boxCenter(fit.box);
  const samples: Vec3[] = [
    center,
    ...corners(fit.box).map((c) => [
      center[0] + (c.x - center[0]) * 0.8,
      center[1] + (c.y - center[1]) * 0.8,
      center[2] + (c.z - center[2]) * 0.8,
    ] as Vec3),
  ];
  let best = candidates[0];
  let bestHits = Infinity;
  for (const dir of candidates) {
    const pose = framePose({ ...fit, viewDir: dir });
    let hits = 0;
    for (const s of samples) if (blockers.some((b) => segmentHitsBox(s, pose.position, b))) hits++;
    if (hits < bestHits) {
      best = dir;
      bestHits = hits;
      if (hits === 0) break;
    }
  }
  return best;
}

/** Umbrales del reencuadre tras una edición: más del 150 % del alto visible o menos del 3 %. */
export const EDIT_REFRAME_MAX_FRACTION = 1.5;
export const EDIT_REFRAME_MIN_FRACTION = 0.03;

/**
 * Tras editar un tamaño o escala la cámara no salta, salvo que el objeto editado deje de verse
 * razonablemente: la cámara quedó dentro de su caja (o una esquina quedó detrás de ella), ocupa más
 * del 150 % del alto visible, menos del 3 % del encuadre o quedó entero fuera de cuadro.
 */
export function needsReframeAfterEdit(box: FrameBox, cameraPosition: Vec3, viewProjection: ArrayLike<number>): boolean {
  const pad = 1e-3;
  if ([0, 1, 2].every((i) => cameraPosition[i] >= box.min[i] - pad && cameraPosition[i] <= box.max[i] + pad)) return true;
  const m = new THREE.Matrix4().fromArray(Array.from(viewProjection));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const corner of corners(box)) {
    const v = new THREE.Vector4(corner.x, corner.y, corner.z, 1).applyMatrix4(m);
    if (v.w <= 1e-6) return true;
    minX = Math.min(minX, v.x / v.w);
    maxX = Math.max(maxX, v.x / v.w);
    minY = Math.min(minY, v.y / v.w);
    maxY = Math.max(maxY, v.y / v.w);
  }
  const height = (maxY - minY) / 2;
  const width = (maxX - minX) / 2;
  if (height > EDIT_REFRAME_MAX_FRACTION) return true;
  if (Math.max(height, width) < EDIT_REFRAME_MIN_FRACTION) return true;
  return maxX < -1 || minX > 1 || maxY < -1 || minY > 1;
}
