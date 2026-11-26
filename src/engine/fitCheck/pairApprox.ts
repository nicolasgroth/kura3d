/**
 * @file src/engine/fitCheck/pairApprox.ts
 * @description Interferencia aproximada de "Comprobar encaje" cuando alguna malla no cierra (frecuente en
 * STL de fabricantes): pares de triángulos que se cortan (`bvhcast` de three-mesh-bvh) y volumen común
 * estimado muestreando una grilla en la caja común; un punto cuenta como dentro de un cuerpo si al menos
 * dos de tres rayos cruzan su superficie un número impar de veces (así un agujero en una cara no lo
 * invalida). El resultado va marcado como aproximado. Costo acotado: grilla fija y tope de cruces.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { PreparedBody } from './fitBodies';
import type { InternalInterference } from './pairGeometry';

/** Muestras por lado de la grilla en la caja común. */
export const FIT_APPROX_GRID = 18;
/** Tope de pares de triángulos que se cortan (basta para afirmar el cruce y ubicar la zona). */
export const FIT_APPROX_MAX_CROSSINGS = 50_000;

// Direcciones algo inclinadas para no pasar justo por aristas o vértices de mallas alineadas a los ejes.
const DIRS = [
  new THREE.Vector3(1, 0.0137, 0.0291).normalize(),
  new THREE.Vector3(0.0213, 1, 0.0173).normalize(),
  new THREE.Vector3(0.0311, 0.0119, 1).normalize(),
];

function inside(body: PreparedBody, p: THREE.Vector3, ray: THREE.Ray): boolean {
  let votes = 0;
  for (const d of DIRS) {
    ray.set(p, d);
    const hits = body.bvh.raycast(ray, THREE.DoubleSide);
    if (hits.length % 2 === 1) votes++;
  }
  return votes >= 2;
}

/** Interferencia aproximada de A y B; `null` si no se cortan ni comparten volumen muestreado. */
export function approximateInterference(a: PreparedBody, b: PreparedBody): InternalInterference | null {
  const common = a.box.clone().intersect(b.box);
  if (common.isEmpty()) return null;
  const zone = new THREE.Box3();
  let crossings = 0;
  const line = new THREE.Line3();
  a.bvh.bvhcast(b.bvh, new THREE.Matrix4(), {
    intersectsTriangles: (t1, t2) => {
      if (t1.intersectsTriangle(t2, line)) {
        crossings++;
        zone.expandByPoint(line.start).expandByPoint(line.end);
      }
      return crossings >= FIT_APPROX_MAX_CROSSINGS;
    },
  });
  const size = common.getSize(new THREE.Vector3());
  const n = FIT_APPROX_GRID;
  const cell = size.clone().divideScalar(n);
  const p = new THREE.Vector3();
  const ray = new THREE.Ray();
  let inBoth = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        p.set(common.min.x + (i + 0.5) * cell.x, common.min.y + (j + 0.5) * cell.y, common.min.z + (k + 0.5) * cell.z);
        if (inside(a, p, ray) && inside(b, p, ray)) {
          inBoth++;
          zone.expandByPoint(p.clone().sub(cell.clone().multiplyScalar(0.5)));
          zone.expandByPoint(p.clone().add(cell.clone().multiplyScalar(0.5)));
        }
      }
    }
  }
  if (inBoth === 0 && crossings === 0) return null;
  zone.intersect(common);
  const volumeMm3 = (inBoth / n ** 3) * size.x * size.y * size.z;
  const zs = zone.getSize(new THREE.Vector3());
  // Sin muestras dentro (cruce muy delgado), el área se estima por la caja de la zona.
  const areaMm2 = 2 * (zs.x * zs.y + zs.y * zs.z + zs.x * zs.z);
  return { volumeMm3, zone, areaMm2, approximate: true, crossingTriangles: crossings };
}
