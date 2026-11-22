/**
 * @file src/engine/split/splitExecute.ts
 * @description Ejecución de "dividir para imprimir": corta el sólido mundial por los planos del plan
 * (`splitByPlane` en secuencia, X → Y → Z), separa cada celda en piezas de un solo cuerpo y funde los
 * fragmentos diminutos (`splitBodies.ts`), y arma una unión por cada par de piezas con contacto real a
 * través de un plano (`splitJoints.ts`: conectores, solape de borde en pared delgada y marca de
 * pareja). Machos y lengüetas van en la pieza baja; alojamientos y ranuras con holgura en la alta.
 * Todo en Manifold; la malla de cada pieza se cierra en `splitFinish.ts` (si no cierra, sus uniones
 * pasan a pegar con aviso).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { applyTransformToMesh } from '../primitives';
import { buildBodies, cellKey, contactSection, MIN_CONTACT_MM2, type Cell } from './splitBodies';
import { cutIntoCells, gridOf, SPLIT_AXES } from './splitCells';
import { buildJoint } from './splitJoints';
import { finishParts } from './splitFinish';
import { buildLooseDowelBatch, looseDowelLength } from './splitLooseDowel';
import { fixAssemblyBeforeConnectors, type PendingJoint } from './splitAssembly';
import { settleAssembly } from './splitAssemblyRepair';
import { ConnectorRoom } from './splitConnectorRoom';
import type { AssemblyFix, AssemblySuggestion } from './assemblyTypes';
import { SPLIT_DEFAULTS, splitPartCode } from './splitPlan';
import type { BedSplitExecuteOptions, BedSplitPlan, BedSplitResult, SplitAxis, SplitJoint, SplitLooseDowel } from './splitTypes';

const AXES = SPLIT_AXES;

/** Tarugos sueltos de las uniones que los conservan, en un lote por medida. */
function buildLooseDowels(wasm: Awaited<ReturnType<typeof initManifoldEngine>>, joints: SplitJoint[]): SplitLooseDowel[] {
  const groups = new Map<string, { c: NonNullable<SplitJoint['connector']>; count: number }>();
  for (const j of joints) {
    const c = j.connector;
    if (j.kind !== 'connector' || c?.type !== 'loose-dowel' || j.connectorCenters.length === 0) continue;
    const key = [c.size, c.depth, c.tolerance].map((v) => v.toFixed(4)).join('|');
    const g = groups.get(key) ?? { c, count: 0 };
    g.count += j.connectorCenters.length;
    groups.set(key, g);
  }
  return [...groups.values()].map(({ c, count }) => {
    const m = buildLooseDowelBatch(wasm, c, count);
    const out = { diameterMm: 2 * c.size, lengthMm: looseDowelLength(c), count, mesh: manifoldToMeshData(m), volumeMm3: m.volume() };
    m.delete();
    return out;
  });
}

/**
 * Divide `obj` según `plan`. Devuelve piezas (malla local + transformación de armado), uniones con
 * etiqueta y conectores o solape aplicados, volúmenes de control y avisos tipados.
 */
export async function executeBedSplitGeometry(
  obj: SceneObject,
  plan: BedSplitPlan,
  options: BedSplitExecuteOptions = {},
): Promise<BedSplitResult> {
  const t0 = performance.now();
  const wasm = await initManifoldEngine();
  const connector = options.connector === undefined ? plan.connector : options.connector;
  const labels = options.labels ?? 'none';
  const labelPlacement = options.labelPlacement ?? 'auto';
  const labelDepth = options.labelDepthMm ?? SPLIT_DEFAULTS.labelDepthMm;
  const labelMin = options.labelMinHeightMm ?? SPLIT_DEFAULTS.labelMinHeightMm;
  const lapHeight = connector?.lapHeightMm ?? SPLIT_DEFAULTS.lapHeightMm;
  const minFragment = options.minFragmentMm3 ?? SPLIT_DEFAULTS.minFragmentMm3;
  const warnings: EngineWarning[] = [];
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const source = meshDataToManifold(wasm, world, undefined, obj.color);
  const sourceVolume = source.volume();
  const counts = [plan.counts.x, plan.counts.y, plan.counts.z];
  const { planesBy, bounds } = gridOf(plan);
  const totalCuts = planesBy[0].length + planesBy[1].length * counts[0] + planesBy[2].length * counts[0] * counts[1];
  let done = 0;
  const tick = () => options.onProgress?.(++done, totalCuts);
  const codeOf = (c: Cell) => splitPartCode(c, counts[2]);

  // 1. Cortes en secuencia y piezas de un solo cuerpo
  const cells = cutIntoCells(source, planesBy, tick);
  const { bodies, byCell, cache } = buildBodies(wasm, cells, bounds, { minFragmentMm3: minFragment, usable: plan.usableMm, codeOf }, warnings);

  try {
    // 2. Uniones entre piezas con contacto real
    const joints: Array<Omit<SplitJoint, 'a' | 'b'> & PendingJoint> = [];
    let clearance = 0;
    let engraved = 0;
    // Registro global: un conector nuevo deja la pared mínima a los de las demás uniones y al exterior
    const room = new ConnectorRoom();
    const order = [...bodies.values()].sort((p, q) => p.cell[2] - q.cell[2] || p.cell[1] - q.cell[1] || p.cell[0] - q.cell[0] || p.id - q.id);
    for (const low of order) {
      for (let a = 0; a < 3; a++) {
        const axis = AXES[a];
        const hc = [...low.cell] as Cell;
        hc[a]++;
        const coord = bounds[a][hc[a]];
        for (const hid of byCell.get(cellKey(hc)) ?? []) {
          const high = bodies.get(hid)!;
          const contact = contactSection(cache, low.id, hid, axis, coord);
          try {
            const area = contact.area();
            if (area <= MIN_CONTACT_MM2) continue;
            const label = String(joints.length + 1);
            const addsBefore = low.adds.length;
            const subsBefore = high.subs.length;
            const lowSubsBefore = low.subs.length;
            const out = await buildJoint(
              wasm,
              {
                low, high, axis, coord, span: bounds[a][hc[a] + 1] - coord, contact, bounds, label, connector,
                lapHeightMm: lapHeight, labels, labelPlacement, labelDepthMm: labelDepth, labelMinHeightMm: labelMin,
                reinforce: options.reinforceWeakJoints !== false, room,
              },
              warnings,
            );
            clearance += out.clearance;
            engraved += out.engraved;
            // Sólidos de conector o solape (sin la marca, que va al final de `high.subs`)
            const subsEnd = high.subs.length - (out.labelPlacement !== null ? 1 : 0);
            const lowSubsEnd = low.subs.length - (out.labelPlacement !== null ? 1 : 0);
            const solids = { adds: low.adds.slice(addsBefore), subs: high.subs.slice(subsBefore, subsEnd), lowSubs: low.subs.slice(lowSubsBefore, lowSubsEnd) };
            low.labels.push(label);
            high.labels.push(label);
            joints.push({
              label, axis, position: coord, low: low.id, high: hid, connector: out.used, connectorCenters: out.centers,
              kind: out.kind, lap: out.lap, islands: out.islands, contactAreaMm2: area, labelEngraved: out.labelPlacement !== null,
              labelPlacement: out.labelPlacement, labelHeightMm: out.labelHeightMm, clearance: out.clearance, solids,
            });
          } finally {
            contact.delete();
          }
        }
      }
    }

    // 2b. Montaje posible en algún orden: si no, las uniones que traban pasan a "para pegar"
    const check = options.validateAssembly !== false;
    let fix: AssemblyFix | null = null;
    let suggestions: AssemblySuggestion[] = [];
    if (check && joints.some((j) => j.kind !== 'glue')) {
      const r = fixAssemblyBeforeConnectors(
        wasm, order, joints, warnings, options.assemblyAutoFix !== false, options.assemblyAllowTypeChange !== false,
        options.assemblyAllowSurfaceChange === true,
      );
      fix = r.fix;
      suggestions = r.suggestions;
      clearance += r.clearanceDelta;
    }

    // 3. Aplicar conectores, solapes y marcas, y pasar a mallas cerradas (si no cierra: para pegar)
    const finished = finishParts(wasm, order, joints, warnings);
    const { parts, index } = finished;
    clearance += finished.clearanceDelta;
    const sign = (axis: SplitAxis, s: '+' | '-') => `${s}${axis}` as SplitJoint['a']['face'];
    const toJoints = (): SplitJoint[] => joints.map(({ low, high, clearance: _c, solids: _s, ...j }) => ({
      ...j,
      a: { part: index.get(low)!, code: bodies.get(low)!.code, face: sign(j.axis, '+') },
      b: { part: index.get(high)!, code: bodies.get(high)!.code, face: sign(j.axis, '-') },
    }));
    // 4. Armado final: lo que aún traba o choca pasa a pegar (el resultado por defecto siempre es armable)
    let assembly: BedSplitResult['assembly'];
    if (check) {
      const settled = settleAssembly({
        wasm, bodies, joints, parts, index, toJoints, volumes: { source: sourceVolume, clearance, engraved },
        smoothParts: () => order.map((b) => ({ code: b.code, mesh: manifoldToMeshData(b.m), assembly: { position: [0, 0, 0], rotation: [0, 0, 0] } })),
        preFix: fix, preSuggestions: suggestions, autoFix: options.assemblyAutoFix !== false, connector, warnings,
      });
      clearance += settled.clearanceDelta;
      assembly = settled.report;
    }
    const outJoints = toJoints();
    const looseDowels = buildLooseDowels(wasm, outJoints);
    const glueJoints = outJoints.filter((j) => j.kind === 'glue').length;
    if (glueJoints > 0 && connector) warnings.push(engineWarning('SPLIT_GLUE_SUMMARY', { count: glueJoints, total: outJoints.length }));
    if (assembly) warnings.push(...assembly.warnings);
    return {
      parts,
      looseDowels,
      joints: outJoints,
      assembly,
      glueJoints,
      sourceVolumeMm3: sourceVolume,
      clearanceVolumeMm3: clearance,
      engravedVolumeMm3: engraved,
      warnings,
      elapsedMs: performance.now() - t0,
    };
  } finally {
    cache.dispose();
    for (const b of bodies.values()) {
      b.m.delete();
      for (const h of [...b.adds, ...b.subs]) h.delete();
    }
  }
}
