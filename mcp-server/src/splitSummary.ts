/**
 * @file mcp-server/src/splitSummary.ts
 * @description Resumen corto del resultado de `split_for_bed` para la herramienta MCP: piezas (id,
 * código, placa), placas, uniones con y sin conector y avisos. El plan completo (planos, cajas,
 * centros de conectores) solo se devuelve con `detail: true`, para no gastar el contexto del agente.
 * Acepta la forma del motor headless y la del puente vivo (que ya resume las uniones).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

interface JointLike {
  label?: string;
  connector?: unknown;
  connectors?: number;
  connectorCenters?: unknown[];
  /** Imanes de la unión (`connectorType: 'magnet'`). */
  magnets?: { count?: number; magnet?: { sizeMm?: number; heightMm?: number } };
}

/** Texto de polaridad para quien arma (la app no fija la polaridad física de los imanes). */
export const MAGNET_POLARITY_TEXT = 'Glue each pair with opposite poles facing; test the pair before gluing.';

interface PartLike {
  id?: string;
  name?: string;
  code?: string;
  plate?: number;
}

interface SplitResultLike {
  dryRun?: boolean;
  plan?: {
    fitsWithoutCuts?: boolean; pieces?: unknown[]; planes?: unknown[]; counts?: unknown; occupancy?: { exact?: boolean; pieces?: number; joints?: number };
    strategy?: string; natural?: { naturalCuts?: number; straightCuts?: number; candidates?: Array<{ axis?: string; position?: number; kind?: string; used?: boolean }> };
  };
  parts?: PartLike[];
  joints?: JointLike[];
  plateCount?: number;
  /** Lotes de tarugos sueltos (`loose-dowel`), objetos aparte. */
  looseDowels?: unknown[];
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

/** Pares de imanes de las uniones con imanes: total, medidas por unión y el texto de polaridad. */
function magnetSummary(joints: JointLike[]): Record<string, unknown> {
  const withMagnets = joints.filter((j) => j.magnets && connectorCount(j) > 0);
  if (withMagnets.length === 0) return {};
  return {
    magnets: {
      pairs: withMagnets.reduce((s, j) => s + connectorCount(j), 0),
      perJoint: withMagnets.map((j) => ({ label: j.label, pairs: connectorCount(j), diameterMm: j.magnets?.magnet?.sizeMm, heightMm: j.magnets?.magnet?.heightMm })),
      polarity: MAGNET_POLARITY_TEXT,
    },
  };
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
    // Sin dividir (dryRun): las piezas reales del plan (celdas ocupadas) si las trae; si no, las celdas de la rejilla.
    pieces: parts.length > 0 ? parts.length : (r.plan?.occupancy?.pieces ?? r.plan?.pieces?.length ?? 0),
    ...(parts.length === 0 && r.plan?.occupancy
      ? { planned: { pieces: r.plan.occupancy.pieces, joints: r.plan.occupancy.joints, exact: r.plan.occupancy.exact === true } }
      : {}),
    planes: r.plan?.planes?.length ?? 0,
    ...(r.plan?.strategy === 'natural' && r.plan.natural
      ? {
          strategy: {
            kind: 'natural',
            naturalCuts: r.plan.natural.naturalCuts ?? 0,
            straightCuts: r.plan.natural.straightCuts ?? 0,
            narrowings: (r.plan.natural.candidates ?? []).map((c) => ({ axis: c.axis, positionMm: c.position, kind: c.kind, used: c.used === true })),
          },
        }
      : {}),
    counts: r.plan?.counts,
    plates: r.plateCount ?? 0,
    joints: {
      total: joints.length,
      withConnector: withConnector.length,
      withoutConnector: joints.length - withConnector.length,
      labelsWithoutConnector: joints.filter((j) => connectorCount(j) === 0).map((j) => j.label).filter(Boolean),
    },
    parts: parts.map((p) => ({ id: p.id, code: p.code, plate: p.plate })),
    ...(Array.isArray(r.looseDowels) && r.looseDowels.length > 0 ? { looseDowels: r.looseDowels } : {}),
    ...magnetSummary(joints),
    ...(r.assembly ? { assembly: r.assembly } : {}),
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    ...(r.note ? { note: r.note } : {}),
    detail: 'Summary. Pass detail=true for the full plan (planes, planned pieces and joints).',
  };
}
