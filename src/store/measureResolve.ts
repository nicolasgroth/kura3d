/**
 * @file src/store/measureResolve.ts
 * @description Pone al día las mediciones guardadas con el estado actual de la escena: cada punto
 * sigue a su objeto (coordenadas locales), de modo que distancia, ángulo y área se recalculan al
 * mover, rotar o escalar. Si un objeto se borró o su malla cambió, la medición queda "desactualizada"
 * (sin valor) y vuelve a ser válida si el objeto reaparece igual (deshacer).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import {
  angleAtVertex,
  angleBetweenFaces,
  localToWorld,
  measureDistance,
  normalToWorld,
  validObjectFor,
  worldRegion,
} from '../engine/measure';
import type { SceneObject, Vec3 } from '../types/kura';
import type { Measurement } from './measureStore';

export type ResolvedMeasurement = Measurement & { stale: boolean };

type Cache = { objs: Array<SceneObject | null>; value: ResolvedMeasurement };
const cache = new WeakMap<Measurement, Cache>();

function compute(m: Measurement, objs: SceneObject[]): ResolvedMeasurement {
  switch (m.kind) {
    case 'distance': {
      const [a, b] = m.anchors.map((an, i) => localToWorld(objs[i], an.local)) as [Vec3, Vec3];
      return { ...m, a, b, ...measureDistance(a, b), stale: false };
    }
    case 'angle': {
      const pts = m.anchors.map((an, i) => localToWorld(objs[i], an.local)) as [Vec3, Vec3, Vec3];
      return { ...m, points: pts, deg: angleAtVertex(...pts), stale: false };
    }
    case 'faceAngle': {
      const pts = m.anchors.map((an, i) => localToWorld(objs[i], an.local)) as [Vec3, Vec3];
      const [na, nb] = m.anchors.map((an, i) => normalToWorld(objs[i], an.normalLocal ?? [0, 1, 0])) as [Vec3, Vec3];
      const r = angleBetweenFaces(na, nb);
      return { ...m, points: pts, deg: r.dihedralDeg, betweenNormalsDeg: r.betweenNormalsDeg, stale: false };
    }
    case 'area': {
      const r = worldRegion(m.parts.map((part, i) => ({ part, obj: objs[i] })));
      return { ...m, areaMm2: r.areaMm2, centroid: r.centroid, highlight: r.highlight, stale: false };
    }
  }
}

/** Objetos de cada punto/parte de la medición, en el orden de sus anclas (o `null` si no es válido). */
function resolveObjects(m: Measurement, objects: ReadonlyArray<SceneObject>): Array<SceneObject | null> {
  const anchors = m.kind === 'area' ? m.parts : m.anchors;
  return anchors.map((a) => validObjectFor(a, objects));
}

/** Medición con los valores actuales, o `stale: true` (valores del momento de medir, no mostrarlos). */
export function resolveMeasurement(m: Measurement, objects: ReadonlyArray<SceneObject>): ResolvedMeasurement {
  const objs = resolveObjects(m, objects);
  const hit = cache.get(m);
  if (hit && hit.objs.length === objs.length && hit.objs.every((o, i) => o === objs[i])) return hit.value;
  const value = objs.every((o) => o !== null) ? compute(m, objs as SceneObject[]) : { ...m, stale: true };
  cache.set(m, { objs, value });
  return value;
}

export function resolveMeasurements(measurements: Measurement[], objects: ReadonlyArray<SceneObject>): ResolvedMeasurement[] {
  return measurements.map((m) => resolveMeasurement(m, objects));
}
