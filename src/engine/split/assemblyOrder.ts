/**
 * @file src/engine/split/assemblyOrder.ts
 * @description Orden de montaje de la validación de armado.
 *
 * Una pieza P puede entrar con la dirección d si (1) d es compatible con TODAS sus uniones con
 * conector o solape hacia piezas ya puestas (`jointDirections`) y (2) ninguna pieza ya puesta está en
 * su sombra de barrido para d (`sweepShadows`: el camino muestreado en vóxeles desde lejos hasta su
 * lugar). Las uniones para pegar no restringen d; el barrido evita que la pieza atraviese a la vecina.
 *
 * Búsqueda (`findOrder`): en profundidad con retroceso; candidatas = piezas tocando lo ya puesto,
 * de abajo hacia arriba; memo de conjuntos puestos que ya fracasaron y tope de nodos. Agregar piezas
 * solo agrega restricciones, así que la primera candidata factible casi siempre lleva a una solución:
 * en la práctica es O(n²·u) con u = uniones por pieza; el peor caso (sin solución) queda acotado por
 * el tope de nodos.
 *
 * Arreglo (`greedyFix`): construcción voraz desde la base; en cada paso elige la pieza y dirección
 * libres de barrido que obligan a pegar menos uniones, y pasa esas uniones a "para pegar". Cuando cada
 * pieza tiene a lo más un vecino por eje (rejillas 2×2×2) alcanza el mínimo: uniones − (piezas − 1); con
 * hasta `EXACT_FIX_MAX_PARTS` piezas, solo pegar usa además el óptimo exacto (`assemblyOrderExact.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { alternativeType, jointDirections, restricts } from './assemblyConnectors';
import type { SplitConnectorType } from './splitTypes';
import type { AssemblyBlocked, AssemblyDirection, AssemblyJointInput, AssemblyStep } from './assemblyTypes';
import { DIRECTIONS } from './assemblyVoxels';
import { exactGlueFix } from './assemblyOrderExact';

export interface OrderInput {
  codes: string[];
  /** Cota baja en Y de cada pieza (base primero). */
  minY: number[];
  joints: AssemblyJointInput[];
  shadows: Array<Map<AssemblyDirection, Set<number>>>;
  /** Pieza base (va primero y no se mueve): la más baja; a igual altura, la de más volumen. */
  base: number;
  nodeBudget?: number;
}

export interface OrderOutcome {
  order: AssemblyStep[];
  blocked: AssemblyBlocked[];
}

function byPart(n: number, joints: AssemblyJointInput[]): AssemblyJointInput[][] {
  const out: AssemblyJointInput[][] = Array.from({ length: n }, () => []);
  for (const j of joints) {
    out[j.a.part]?.push(j);
    if (j.b.part !== j.a.part) out[j.b.part]?.push(j);
  }
  return out;
}
const other = (j: AssemblyJointInput, p: number) => (j.a.part === p ? j.b.part : j.a.part);

interface Eval {
  dirs: AssemblyDirection[];
  conflicting: string[];
  blockingBy: Map<AssemblyDirection, number[]>;
  adjacent: boolean;
}

function evaluate(p: number, placed: Uint8Array, mine: AssemblyJointInput[], shadows: OrderInput['shadows'], glued: Set<string>): Eval {
  let allowed = new Set(DIRECTIONS);
  const conflicting: string[] = [];
  let adjacent = false;
  for (const j of mine) {
    if (!placed[other(j, p)]) continue;
    adjacent = true;
    if (!restricts(j) || glued.has(j.label)) continue;
    conflicting.push(j.label);
    const ok = new Set(jointDirections(j, p));
    allowed = new Set([...allowed].filter((d) => ok.has(d)));
  }
  const blockingBy = new Map<AssemblyDirection, number[]>();
  const dirs: AssemblyDirection[] = [];
  for (const d of DIRECTIONS) {
    const hit = [...shadows[p].get(d)!].filter((q) => placed[q]);
    blockingBy.set(d, hit);
    if (hit.length === 0 && allowed.has(d)) dirs.push(d);
  }
  return { dirs, conflicting, blockingBy, adjacent };
}

function candidates(input: OrderInput, placed: Uint8Array, joints: AssemblyJointInput[][]): number[] {
  const n = input.codes.length;
  if (!placed[input.base]) return [input.base];
  const list: number[] = [];
  for (let p = 0; p < n; p++) if (!placed[p]) list.push(p);
  const touches = (p: number) => joints[p].some((j) => placed[other(j, p)]);
  return list.sort((p, q) => Number(touches(q)) - Number(touches(p)) || input.minY[p] - input.minY[q] || p - q);
}

function blockedOf(input: OrderInput, placed: Uint8Array, joints: AssemblyJointInput[][], glued: Set<string>): AssemblyBlocked[] {
  const out: AssemblyBlocked[] = [];
  const evals = candidates(input, placed, joints).map((p) => ({ p, e: evaluate(p, placed, joints[p], input.shadows, glued) }));
  const adjacent = evals.filter((x) => x.e.adjacent);
  for (const { p, e } of adjacent.length > 0 ? adjacent : evals) {
    // Sin dirección por conectores, o todas las compatibles topan al barrer
    const jointOk = DIRECTIONS.filter((d) => {
      return joints[p].every((j) => !placed[other(j, p)] || !restricts(j) || glued.has(j.label) || jointDirections(j, p).includes(d));
    });
    const reason = jointOk.length === 0 ? 'directions' : 'sweep';
    const blocking = new Set<number>();
    for (const d of jointOk) for (const q of e.blockingBy.get(d) ?? []) blocking.add(q);
    out.push({ part: p, code: input.codes[p], reason, conflictingJoints: e.conflicting, blockingParts: [...blocking].map((q) => input.codes[q]) });
  }
  return out;
}

/** Busca un orden de montaje sin cambiar las uniones; si no hay, el tramo más largo y los bloqueos. */
export function findOrder(input: OrderInput, glued: Set<string> = new Set()): OrderOutcome {
  const n = input.codes.length;
  const joints = byPart(n, input.joints);
  const placed = new Uint8Array(n);
  const order: AssemblyStep[] = [];
  let best: { order: AssemblyStep[]; placed: Uint8Array } = { order: [], placed: placed.slice() };
  const failed = new Set<string>();
  const budget = input.nodeBudget ?? 20_000;
  let nodes = 0;
  const key = () => Array.from(placed).join('');
  const search = (): boolean => {
    if (order.length === n) return true;
    if (++nodes > budget) return false;
    const k = key();
    if (failed.has(k)) return false;
    for (const p of candidates(input, placed, joints)) {
      const e = evaluate(p, placed, joints[p], input.shadows, glued);
      if (e.dirs.length === 0) continue;
      placed[p] = 1;
      order.push({ part: p, code: input.codes[p], direction: e.dirs[0], step: order.length + 1 });
      if (order.length > best.order.length) best = { order: [...order], placed: placed.slice() };
      if (search()) return true;
      order.pop();
      placed[p] = 0;
      if (nodes > budget) break;
    }
    failed.add(k);
    return false;
  };
  if (n === 0 || search()) return { order: [...order], blocked: [] };
  return { order: best.order, blocked: blockedOf(input, best.placed, joints, glued) };
}

/**
 * Arreglo voraz: uniones a pasar a "para pegar" para que todas las piezas entren. Con `allowChange`,
 * una unión que traba pero admite otro tipo de conector compatible con la dirección elegida
 * (`alternativeType`) cambia de tipo en vez de pegarse; el costo es (pegadas, cambiadas). Los cambios
 * que alteran la superficie exterior (a cola de milano pasante) solo con `allowSurface`.
 */
export function greedyFix(
  input: OrderInput,
  allowChange = false,
  allowSurface = true,
): FixOutcome {
  const greedy = greedyBuild(input, allowChange, allowSurface);
  // Solo pegar y pocas piezas: el óptimo exacto, si pega menos (p. ej. 16 en vez de 17 de 33 en 3×2×3)
  if (allowChange) return greedy;
  const exact = exactGlueFix(input);
  if (exact && (greedy.blocked.length > 0 || exact.glued.size < greedy.glued.size)) {
    return { glued: exact.glued, changed: new Map(), blocked: [], order: exact.order };
  }
  return greedy;
}

type FixOutcome = { glued: Set<string>; changed: Map<string, SplitConnectorType>; blocked: AssemblyBlocked[]; order: AssemblyStep[] };

function greedyBuild(input: OrderInput, allowChange: boolean, allowSurface: boolean): FixOutcome {
  const n = input.codes.length;
  // Copias: un cambio de tipo modifica las direcciones de las evaluaciones siguientes
  const own = input.joints.map((j) => ({ ...j }));
  const joints = byPart(n, own);
  const changed = new Map<string, SplitConnectorType>();
  const placed = new Uint8Array(n);
  const glued = new Set<string>();
  const order: AssemblyStep[] = [];
  for (let step = 0; step < n; step++) {
    // Por capas: la más baja primero (no encierra piezas), luego tocando lo puesto, luego menos uniones a pegar
    let pick: { p: number; d: AssemblyDirection; cost: number; glue: string[]; change: Array<[AssemblyJointInput, SplitConnectorType]>; y: number; touch: boolean } | null = null;
    const better = (y: number, touch: boolean, cost: number) =>
      !pick || y < pick.y - 1e-3 || (Math.abs(y - pick.y) <= 1e-3 && (Number(touch) > Number(pick.touch) || (touch === pick.touch && cost < pick.cost)));
    for (const p of candidates(input, placed, joints)) {
      const e = evaluate(p, placed, joints[p], input.shadows, glued);
      for (const d of DIRECTIONS) {
        if ((e.blockingBy.get(d) ?? []).length > 0) continue;
        const stuck = joints[p].filter((j) => placed[other(j, p)] && restricts(j) && !glued.has(j.label) && !jointDirections(j, p).includes(d));
        const change: Array<[AssemblyJointInput, SplitConnectorType]> = [];
        const glue: string[] = [];
        for (const j of stuck) {
          const t = allowChange ? alternativeType(j, p, d, allowSurface) : null;
          if (t) change.push([j, t]);
          else glue.push(j.label);
        }
        const cost = glue.length * 1000 + change.length;
        if (better(input.minY[p], e.adjacent, cost)) pick = { p, d, cost, glue, change, y: input.minY[p], touch: e.adjacent };
      }
    }
    if (!pick) return { glued, changed, order, blocked: blockedOf({ ...input, joints: own }, placed, joints, glued) };
    for (const l of pick.glue) glued.add(l);
    for (const [j, t] of pick.change) {
      j.connector = { ...j.connector!, type: t };
      changed.set(j.label, t);
    }
    placed[pick.p] = 1;
    order.push({ part: pick.p, code: input.codes[pick.p], direction: pick.d, step: step + 1 });
  }
  return { glued, changed, order, blocked: [] };
}
