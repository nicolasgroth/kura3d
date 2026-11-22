/**
 * @file mcp-server/src/splitSummary.ts
 * @description Resumen corto del resultado de `split_for_bed` para la herramienta MCP: piezas (id,
 * código, placa), placas, uniones con y sin conector y avisos. El plan completo (planos, cajas,
 * centros de conectores) solo se devuelve con `detail: true`, para no gastar el contexto del agente.
 * Acepta la forma del motor headless y la del puente vivo (que ya resume las uniones).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

interface JointLike {
  label?: string;
  connector?: unknown;
  connectors?: number;
  connectorCenters?: unknown[];
}

interface PartLike {
  id?: string;
  name?: string;
  code?: string;
  plate?: number;
}

interface SplitResultLike {
  dryRun?: boolean;
  plan?: { fitsWithoutCuts?: boolean; pieces?: unknown[]; planes?: unknown[]; counts?: unknown };
  parts?: PartLike[];
  joints?: JointLike[];
  plateCount?: number;
  /** Resumen de la validación de armado (`summarizeAssembly`). */
  assembly?: unknown;
  warnings?: unknown[];
  note?: string;
}

/** Cantidad de conectores de una unión, venga del motor (`connectorCenters`) o del puente (`connectors`). */
function connectorCount(j: JointLike): number {
  if (typeof j.connectors === 'number') return j.connectors;
  if (Array.isArray(j.connectorCenters)) return j.connectorCenters.length;
  return j.connector ? 1 : 0;
}

/** Resumen corto del resultado de dividir para imprimir. */
export function summarizeSplitResult(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as SplitResultLike;
  const joints = Array.isArray(r.joints) ? r.joints : [];
  const withConnector = joints.filter((j) => connectorCount(j) > 0);
  const parts = Array.isArray(r.parts) ? r.parts : [];
  return {
    dryRun: r.dryRun ?? false,
    fitsWithoutCuts: r.plan?.fitsWithoutCuts ?? false,
    pieces: parts.length > 0 ? parts.length : (r.plan?.pieces?.length ?? 0),
    planes: r.plan?.planes?.length ?? 0,
    counts: r.plan?.counts,
    plates: r.plateCount ?? 0,
    joints: {
      total: joints.length,
      withConnector: withConnector.length,
      withoutConnector: joints.length - withConnector.length,
      labelsWithoutConnector: joints.filter((j) => connectorCount(j) === 0).map((j) => j.label).filter(Boolean),
    },
    parts: parts.map((p) => ({ id: p.id, code: p.code, plate: p.plate })),
    ...(r.assembly ? { assembly: r.assembly } : {}),
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    ...(r.note ? { note: r.note } : {}),
    detail: 'Resumen. Pide detail=true para el plan completo (planos, piezas planificadas y uniones).',
  };
}
