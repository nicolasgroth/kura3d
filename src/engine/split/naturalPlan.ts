/**
 * @file src/engine/split/naturalPlan.ts
 * @description Estrategia «Por las partes de la figura» de "dividir para imprimir". Parte del plan de
 * rejilla (que fija cuántos planos hacen falta por eje y el largo máximo de cada tramo), busca los
 * estrechamientos de la figura en el perfil de secciones (`naturalCandidates.ts`), mide cada uno con
 * la sección real (`measureSection`: islas, tiras, si admite la unión) y elige por eje la combinación
 * que más estrechamientos usa (`naturalSelect.ts`), completando con cortes rectos. El resultado es un
 * plan corriente con `planePositions` forzadas: la ejecución, los nombres de pieza, las uniones, la
 * firmeza y el armado no cambian. Si no hay estrechamientos útiles, o alguna pieza dejaría de caber,
 * queda el plan de rejilla. Límite: los planos siguen alineados a los ejes y atraviesan todo el modelo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import { naturalCutCandidates, type NaturalCutCandidate } from './naturalCandidates';
import { chooseAxisCuts } from './naturalSelect';
import { connectorMargin, fittingRotation, measureSection, orientForAxis, type SectionStats } from './splitSections';
import type { BedSplitPlan, BedSplitPlanOptions, SplitAxis, SplitBed, SplitConnectorOptions, SplitNaturalSummary } from './splitTypes';

type GridPlanner = (m: Manifold, bed: SplitBed, options: BedSplitPlanOptions) => BedSplitPlan;

const AXES: SplitAxis[] = ['x', 'y', 'z'];

/** Tramo mínimo (igual que `minSpan` de `splitPlan.ts`). */
function minSpanMm(c: SplitConnectorOptions | null): number {
  return c ? 2 * (Math.max(0.8, c.depth + c.tolerance) + 0.8) + 2 : 2;
}

/** Islas máximas de la sección para que un estrechamiento cuente. */
export const MAX_ISLANDS = 6;

/**
 * Peso de un estrechamiento (mayor = mejor sitio): cuán marcado es, más un extra si la sección admite
 * la unión; resta si parte paredes a lo largo (tiras), si deja islas diminutas o varias islas; con más de
 * `MAX_ISLANDS` islas se descarta.
 */
export function naturalWeight(depth: number, s: SectionStats, connector: SplitConnectorOptions | null): number {
  // Demasiadas islas (mechones, capa, dedos): la unión queda en muchos trocitos sueltos
  if (!(s.areaMm2 > 0) || s.islands === 0 || s.islands > MAX_ISLANDS) return 0;
  const tinyLimit = connector ? Math.max(100, 2 * Math.PI * connectorMargin(connector) ** 2) : 100;
  const admits = connector ? s.admitsConnectors || connector.type === 'lap' : false;
  const w = depth + (admits ? 0.4 : 0) - (s.strips > 0 ? 0.6 : 0) - (s.smallestIslandMm2 < tinyLimit ? 0.35 : 0) - Math.min(0.25, 0.05 * Math.max(0, s.islands - 1));
  return Math.max(0, w);
}

/** Plan «Por las partes de la figura» sobre el sólido mundial `m` y su malla `world`. */
export function planNaturalFromManifold(
  m: Manifold,
  world: MeshData,
  bed: SplitBed,
  options: BedSplitPlanOptions,
  gridPlanner: GridPlanner,
): BedSplitPlan {
  const t0 = performance.now();
  const gridOptions: BedSplitPlanOptions = { ...options, strategy: 'grid' };
  const planned = gridPlanner(m, bed, gridOptions);
  // Sin estrechamientos útiles queda esta rejilla: todos sus planos son rectos
  const grid: BedSplitPlan = { ...planned, planes: planned.planes.map((p) => ({ ...p, origin: 'straight' as const })) };
  const empty: SplitNaturalSummary = { naturalCuts: 0, straightCuts: grid.planes.length, candidates: [], analysisMs: 0 };
  if (grid.fitsWithoutCuts) return { ...grid, strategy: 'natural', natural: { ...empty, analysisMs: performance.now() - t0 } };
  const connector = grid.connector;
  const cutAxes = AXES.filter((a) => grid.counts[a] > 1);
  const { candidates } = naturalCutCandidates(world.positions, world.indices, { axes: cutAxes });
  const summary: SplitNaturalSummary['candidates'] = [];
  const forced: Partial<Record<SplitAxis, number[]>> = {};
  const kinds: Partial<Record<SplitAxis, Array<'natural' | 'straight'>>> = {};
  for (const axis of cutAxes) {
    const a = AXES.indexOf(axis);
    const own = candidates.filter((c) => c.axis === axis);
    const weighted = measureCandidates(m, axis, own, connector);
    const user = options.planePositions?.[axis];
    const room = grid.roomMm?.[axis];
    const choice = room === undefined ? null : chooseAxisCuts({
      min: grid.bounds.min[a],
      max: grid.bounds.max[a],
      planes: grid.counts[axis] - 1,
      roomMm: room,
      minSpanMm: minSpanMm(connector),
      candidates: weighted.map((c) => ({ position: c.position, weight: c.weight })),
    });
    const used = new Set(choice ? choice.positions.filter((_, i) => choice.kinds[i] === 'natural') : []);
    for (const c of weighted) summary.push({ axis, kind: c.kind, position: c.position, sectionAreaMm2: c.sectionAreaMm2, depth: c.depth, islands: c.islands, admitsJoint: c.admitsJoint, weight: c.weight, used: !user && used.has(c.position) });
    // Planos movidos a mano en este eje: mandan los del usuario
    if (user && user.length === grid.counts[axis] - 1) continue;
    if (choice && used.size > 0) {
      forced[axis] = choice.positions;
      kinds[axis] = choice.kinds;
    }
  }
  const analysisMs = () => performance.now() - t0;
  if (Object.keys(forced).length === 0) {
    summary.forEach((c) => { c.used = false; });
    return { ...grid, strategy: 'natural', natural: { ...empty, candidates: summary, analysisMs: analysisMs() } };
  }
  const plan = gridPlanner(m, bed, { ...gridOptions, planePositions: { ...options.planePositions, ...forced } });
  // Toda pieza debe seguir cabiendo; si no, la rejilla (que sí cabe).
  const fits = plan.pieces.every((p) => fittingRotation(p.sizeMm, plan.usableMm, options.allowRotation ?? true) !== null);
  if (!fits) {
    summary.forEach((c) => { c.used = false; });
    return { ...grid, strategy: 'natural', natural: { ...empty, candidates: summary, analysisMs: analysisMs() } };
  }
  const planes = plan.planes.map((p) => {
    const k = kinds[p.axis];
    return { ...p, origin: k ? k[p.index] : ('straight' as const) };
  });
  const naturalCuts = planes.filter((p) => p.origin === 'natural').length;
  return {
    ...plan,
    planes,
    strategy: 'natural',
    natural: { naturalCuts, straightCuts: planes.length - naturalCuts, candidates: summary, analysisMs: analysisMs() },
    elapsedMs: performance.now() - t0,
  };
}

/** Mide cada candidato con la sección real y le pone peso. */
function measureCandidates(m: Manifold, axis: SplitAxis, cands: NaturalCutCandidate[], connector: SplitConnectorOptions | null) {
  if (cands.length === 0) return [];
  const { oriented, owned } = orientForAxis(m, axis);
  try {
    return cands.map((c) => {
      const s = measureSection(oriented, c.position, connector);
      const admitsJoint = connector !== null && s.islands > 0 && (s.admitsConnectors || connector.type === 'lap');
      return { ...c, islands: s.islands, admitsJoint, smallest: s.smallestIslandMm2, strips: s.strips, weight: naturalWeight(c.depth, s, connector) };
    });
  } finally {
    if (owned) oriented.delete();
  }
}
