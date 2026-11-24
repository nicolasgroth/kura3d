/**
 * @file src/engine/fitCheck/fitBodies.ts
 * @description Cuerpos efectivos de "Comprobar encaje": cada objeto pasa a mundo una sola vez (solo
 * posiciones e índices, sin normales ni colores), cada sólido cerrado recibe en copia las restas de los
 * negativos que tocan su caja (la misma regla de "Aplicar restas", sin tocar la escena), y cada cuerpo
 * guarda su sólido Manifold (si cierra) y su BVH para todos los pares. Lo que no cierra queda marcado
 * para el método aproximado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import { isNegative, isReference } from '../../core/scene/objectRole';
import { meshDataToManifold } from '../manifoldKernel';
import { cutPartInfoOf, type CutPartInfo } from './cutJoint';
import type { FitCheckBody, FitMessage } from './fitCheckTypes';

/** Tolerancia de la simplificación (solo para el cálculo) de mallas muy densas, en mm. */
export const FIT_SIMPLIFY_TOLERANCE_MM = 0.05;

export interface PreparedBody {
  id: string;
  name: string;
  reference: boolean;
  /** Orden en la entrada (desempata quién es A en un par). */
  order: number;
  /** Datos de Dividir de la pieza (para reconocer la unión del corte). */
  cut?: CutPartInfo;
  /** Malla efectiva en mundo (ejes internos). */
  positions: Float32Array;
  indices: Uint32Array;
  box: THREE.Box3;
  triangles: number;
  /** Sólido exacto; `null` si la malla no cierra (método aproximado). */
  manifold: Manifold | null;
  geometry: THREE.BufferGeometry;
  bvh: MeshBVH;
  /** Copia simplificada para la intersección de pares densos (perezosa). */
  simplified?: Manifold | null;
}

export interface SubtractionTally {
  applied: number;
  ignored: number;
  failed: string[];
}

/** Posiciones en mundo (matriz TRS de three.js) e índices propios, volteados si la escala refleja. */
export function worldMesh(body: Pick<FitCheckBody, 'mesh' | 'position' | 'rotation' | 'scale'>): { positions: Float32Array; indices: Uint32Array } {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...body.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(body.rotation[0], body.rotation[1], body.rotation[2], 'XYZ')),
    new THREE.Vector3(...body.scale),
  );
  const e = m.elements;
  const src = body.mesh.positions;
  const positions = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    positions[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
    positions[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    positions[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  const indices = new Uint32Array(body.mesh.indices);
  if (body.scale[0] * body.scale[1] * body.scale[2] < 0) {
    for (let t = 0; t < indices.length; t += 3) {
      const tmp = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = tmp;
    }
  }
  return { positions, indices };
}

function boxOf(positions: ArrayLike<number>): THREE.Box3 {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.length; i += 3) b.expandByPoint(v.set(positions[i], positions[i + 1], positions[i + 2]));
  return b;
}

function tryManifold(wasm: ManifoldToplevel, positions: Float32Array, indices: Uint32Array): Manifold | null {
  try {
    const m = meshDataToManifold(wasm, { positions, indices } as MeshData);
    if (m.isEmpty()) {
      m.delete();
      return null;
    }
    return m;
  } catch {
    return null;
  }
}

function finishBody(body: Omit<PreparedBody, 'geometry' | 'bvh' | 'box' | 'triangles'> & { box?: THREE.Box3 }): PreparedBody {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(body.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(body.indices, 1));
  // `indirect`: el BVH no reordena el índice (los índices siguen alineados con la malla del Manifold).
  const bvh = new MeshBVH(geometry, { indirect: true });
  (geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = bvh;
  return { ...body, box: body.box ?? boxOf(body.positions), triangles: body.indices.length / 3, geometry, bvh };
}

interface NegativeSolid {
  box: THREE.Box3;
  manifold: Manifold | null;
  name: string;
}

/**
 * Prepara los cuerpos (sólidos y referencias; los negativos de `objects` se ignoran). Con
 * `applySubtractions`, cada sólido cerrado recibe en copia las restas de los negativos que tocan su caja.
 * Llama a `step` antes de cada cuerpo (progreso y cancelación).
 */
export function prepareBodies(
  wasm: ManifoldToplevel,
  objects: readonly FitCheckBody[],
  negatives: readonly FitCheckBody[],
  applySubtractions: boolean,
  notes: FitMessage[],
  step: (i: number, n: number) => void,
): { bodies: PreparedBody[]; subtractions: SubtractionTally } {
  const tally: SubtractionTally = { applied: 0, ignored: 0, failed: [] };
  const targets = objects.filter((o) => !isNegative(o) && o.mesh.indices.length >= 3);
  const negs: NegativeSolid[] = negatives
    .filter((n) => isNegative(n) && n.mesh.indices.length >= 3)
    .map((n) => {
      const w = worldMesh(n);
      return { box: boxOf(w.positions), manifold: null as Manifold | null, name: n.name, world: w };
    })
    .map(({ world, ...rest }) => ({ ...rest, manifold: applySubtractions ? tryManifold(wasm, world.positions, world.indices) : null }));
  const ignored = new Set<number>();
  const bodies: PreparedBody[] = [];
  try {
    targets.forEach((obj, i) => {
      step(i, targets.length);
      const reference = isReference(obj);
      const w = worldMesh(obj);
      let manifold = tryManifold(wasm, w.positions, w.indices);
      let positions = w.positions;
      let indices = w.indices;
      const box = boxOf(positions);
      const touching = reference ? [] : negs.map((n, k) => ({ n, k })).filter(({ n }) => n.box.intersectsBox(box));
      if (touching.length > 0 && !applySubtractions) touching.forEach(({ k }) => ignored.add(k));
      if (touching.length > 0 && applySubtractions) {
        if (!manifold || touching.some(({ n }) => !n.manifold)) {
          tally.failed.push(obj.name);
          notes.push({ key: 'fitCheck.note.subtractionFailed', params: { name: obj.name } });
        } else {
          let current = manifold;
          let applied = 0;
          for (const { n } of touching) {
            const next = current.subtract(n.manifold!);
            // Un negativo que se comería entero al sólido no es su resta: es una pieza metida en el agujero
            // (un eje en el agujero de una placa). Se deja intacta para comparar.
            if (next.isEmpty()) {
              next.delete();
              continue;
            }
            current.delete();
            current = next;
            applied++;
          }
          tally.applied += applied;
          manifold = current;
          if (applied > 0) {
            const mesh = manifold.getMesh();
            positions = mesh.numProp === 3 ? new Float32Array(mesh.vertProperties) : stripProps(mesh.vertProperties, mesh.numProp);
            indices = new Uint32Array(mesh.triVerts);
          }
        }
      }
      if (!manifold) notes.push({ key: 'fitCheck.note.openMesh', params: { name: obj.name } });
      const cut = cutPartInfoOf(obj);
      bodies.push(finishBody({ id: obj.id, name: obj.name, reference, order: i, positions, indices, manifold, ...(cut ? { cut } : {}) }));
    });
  } catch (err) {
    disposeBodies(bodies);
    throw err;
  } finally {
    for (const n of negs) n.manifold?.delete();
  }
  tally.ignored = ignored.size;
  if (tally.ignored > 0) notes.push({ key: 'fitCheck.note.subtractionsIgnored', params: { count: tally.ignored } });
  return { bodies, subtractions: tally };
}

function stripProps(props: Float32Array, numProp: number): Float32Array {
  const n = props.length / numProp;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) out.set(props.subarray(i * numProp, i * numProp + 3), i * 3);
  return out;
}

/** Sólido para la intersección: el simplificado si el par es muy denso (perezoso, se reutiliza). */
export function manifoldForPair(body: PreparedBody, simplify: boolean): Manifold | null {
  if (!body.manifold || !simplify) return body.manifold;
  if (body.simplified === undefined) {
    const s = body.manifold.simplify(FIT_SIMPLIFY_TOLERANCE_MM);
    body.simplified = s.isEmpty() ? (s.delete(), null) : s;
  }
  return body.simplified ?? body.manifold;
}

/** Libera la memoria WASM y los BVH. */
export function disposeBodies(bodies: readonly PreparedBody[]): void {
  for (const b of bodies) {
    b.manifold?.delete();
    b.simplified?.delete();
    b.geometry.dispose();
  }
}
