/**
 * @file src/engine/split/splitSuggestionCheck.ts
 * @description Depura las sugerencias finales del armado de "dividir para imprimir": quedan solo las de
 * uniones que terminaron para pegar o que aún traban (una sugerencia de un paso anterior sobre una unión
 * que conservó su conector y monta haría que la interfaz la muestre como "Traba el montaje"), y cada
 * `change-type:<tipo>` se comprueba con el validador aplicándolo solo a esa unión: si sus conectores chocan
 * (no caben) o, con el armado ya resuelto, la unión vuelve a trabar (p. ej. una cola de milano que no puede
 * deslizar), la opción se quita y queda solo pegar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AssemblyJointInput, AssemblyPartInput, AssemblyReport, AssemblySuggestion } from './assemblyTypes';
import type { SplitConnectorOptions, SplitConnectorType } from './splitTypes';
import { validateAssembly } from './validateAssembly';

/** Comprobaciones con el validador como máximo (cada una es un armado en vóxeles). */
const MAX_CHECKS = 12;

/** Conector y centros que tenía una unión antes de pasar a pegar (para probar el cambio de tipo). */
export type OriginalConnectors = Map<string, { connector: SplitConnectorOptions; centers: [number, number, number][] }>;

/**
 * Sugerencias válidas del informe final. `joints` es el estado final de las uniones y `parts` las piezas
 * terminadas (o lisas) con que se valida. No modifica la entrada.
 */
export function checkSuggestions(
  report: AssemblyReport,
  parts: AssemblyPartInput[],
  joints: AssemblyJointInput[],
  originals: OriginalConnectors,
  /** Conector pedido, para las uniones pegadas antes de poner conectores (sin original). */
  requested: SplitConnectorOptions | null,
): AssemblySuggestion[] {
  const stillBlocking = new Set(report.blocked.flatMap((b) => b.conflictingJoints));
  const kindOf = new Map(joints.map((j) => [j.label, j.kind]));
  const relevant = report.suggestions.filter((s) => kindOf.get(s.joint) === 'glue' || stillBlocking.has(s.joint));
  const settled = report.blocked.length === 0;
  let checks = 0;
  const out: AssemblySuggestion[] = [];
  for (const s of relevant) {
    const options = s.options.filter((o) => {
      if (!o.startsWith('change-type:')) return true;
      if (checks >= MAX_CHECKS) return true;
      checks++;
      const type = o.slice('change-type:'.length) as SplitConnectorType;
      const orig = originals.get(s.joint);
      const base = joints.find((j) => j.label === s.joint);
      const connector = orig?.connector ?? base?.connector ?? requested;
      if (!base || !connector) return false;
      // Solo esta unión cambia; las demás quedan como terminaron. Con el armado ya resuelto (sin bloqueos), el
      // cambio no debe volver a trabar por esta unión; sin resolver (`autoFix: false`) el resultado depende de
      // la combinación del arreglo, así que solo se exige que sus conectores no choquen.
      const trial = joints.map((j): AssemblyJointInput =>
        j.label === s.joint ? { ...j, kind: 'connector', connector: { ...connector, type }, connectorCenters: orig?.centers ?? j.connectorCenters } : j,
      );
      const r = validateAssembly(parts, trial, { autoFix: false });
      const clash = r.clashes.some((c) => c.joint === s.joint || c.other?.joint === s.joint);
      const reblocks = settled && r.blocked.some((b) => b.conflictingJoints.includes(s.joint));
      return !clash && !reblocks;
    });
    out.push({ joint: s.joint, options: options.includes('glue') ? options : ['glue', ...options] });
  }
  return out;
}
