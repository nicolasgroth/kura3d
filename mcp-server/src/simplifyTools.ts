/**
 * @file mcp-server/src/simplifyTools.ts
 * @description Herramienta MCP `kura_simplify_mesh` (Simplificar con verificación: modos «lossless», «tolerance» y
 * «target»). Con la app conectada va por el Command Bus (`simplify_mesh`); sin interfaz usa el mismo esquema
 * (`src/core/bus/simplifySchema.ts`) y la misma operación del motor, y devuelve el mismo informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_DEFAULTS as OD, OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import {
  LOSSLESS_LIMITS,
  SIMPLIFY_DESTRUCTIVE_LIMITS as SDL,
  SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM,
  SIMPLIFY_MODES,
  SIMPLIFY_NOTICE_LIMITS as SNL,
  SIMPLIFY_ON_DESTRUCTIVE,
  SIMPLIFY_SAFE_MIN_REDUCTION_REL,
  SIMPLIFY_WARN_LIMITS as SWL,
} from '../../src/engine/simplify';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

export function registerSimplifyTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_simplify_mesh',
    {
      title: 'Simplify 3D mesh',
      description:
        'Lowers the triangle count (for low-memory computers) with Manifold simplify and verifies the result against the ' +
        'original: one undo step (none with dryRun). Modes: "lossless" simplifies at ' + LOSSLESS_LIMITS.toleranceMm + ' mm and applies only if the ' +
        'genus (through holes) is unchanged, |volume change| < ' + LOSSLESS_LIMITS.maxVolumePct + ' % and the sampled deviation < ' +
        LOSSLESS_LIMITS.maxDeviationMm + ' mm; "tolerance" (default) uses toleranceMm (default ' + OD.simplify.toleranceMm +
        ' mm; it is a ceiling: the engine tries a fixed 1-2-5 ladder of tolerances up to it and applies the one that leaves the ' +
        'fewest triangles, so a larger tolerance never leaves more triangles, and the returned toleranceMm is the one actually ' +
        'used, which may be lower than requested; the tolerance does NOT bound the real deviation); "target" searches the tolerance (bisection, capped iterations ' +
        'and time) that leaves targetTriangles or targetPercent of the current triangles, and returns what it reached if it ' +
        'cannot; if the closest result loses through holes, it prefers the best one that keeps them within ' +
        Math.round(SWL.genusSlackRel * 100) + ' % above the target (target.genusPreserved). Genus is summed per body. If ' +
        'the applied result changes the genus, warnings carries SIMPLIFY_GENUS_CHANGED (same channel as SIMPLIFY_VOLUME_CHANGED). Returns the report: applied, triangles before/after, volume change %, genus before/after, maxDeviationMm ' +
        '(sampled, a lower bound), limits (the part notice and destructive limits: noticeVolumePct, noticeDeviationMm, ' +
        'destructiveVolumePct, destructiveDeviationMm, minSideMm, minTriangles) and rejectedBy (lossless). applied=false leaves the object untouched. ' +
        'TWO LEVELS (tolerance and target). WARNINGS (applied as requested, listed in warnings): genus_changed, ' +
        'volume_changed when |volume change| > ' + SNL.volumePct + ' %, deviation_high when the deviation exceeds the larger of ' +
        SNL.deviationMinMm + ' mm and ' + SNL.deviationRelDiag * 100 + ' % of the bounding-box diagonal, target_not_reached, ' +
        'no_reduction (lossless uses its own limits above). Asking few triangles of a coarse mesh is expected to warn, not to block. ' +
        'DESTRUCTIVE (listed in destructive; not applied as requested): it closes through holes while the ' +
        'deviation exceeds ' + SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM + ' mm (holes_lost; thinner tunnels than a printer resolves ' +
        'only warn with genus_changed), |volume change| > ' + SDL.volumePct + ' % (volume_changed), the deviation exceeds ' +
        SDL.deviationRelMinSide * 100 + ' % of the smallest bounding-box side, i.e. the thickness (deviation_high), or fewer ' +
        'triangles remain than ' + SDL.minTrianglesHoledBase + ' + ' + SDL.minTrianglesPerHole + ' per through hole (' +
        SDL.minTrianglesBase + ' without holes) (too_few_triangles). destructive lists the reasons and safe carries the best safe alternative (fewest triangles that ' +
        'is not destructive and removes at least ' + SIMPLIFY_SAFE_MIN_REDUCTION_REL * 100 + ' % of the triangles: toleranceMm, ' +
        'triangles, volumeAfterMm3, volumeChangePct, genusAfter, maxDeviationMm; null if none). onDestructive decides: ' +
        '"safe" (default) applies the safe version instead (appliedVariant="safe": the report numbers are the safe ones and ' +
        'requested carries the requested ones) or nothing if safe is null (appliedVariant="none"); "block" applies nothing; ' +
        '"force" applies the requested result (forced=true). allowDestructive=true is an alias of onDestructive="force". ' +
        'appliedVariant is "requested", "safe" or "none". dryRun=true returns the same report without changing the scene ' +
        'or the undo history (dryRun=true in the answer; applied/appliedVariant say what WOULD be applied). ' +
        'Parameters that do not belong to the mode are rejected with invalid-params (toleranceMm only in tolerance; ' +
        'targetTriangles/targetPercent only in target; allowDestructive/onDestructive not in lossless).',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to simplify.'),
        mode: z.enum(SIMPLIFY_MODES as [string, ...string[]]).optional()
          .describe('lossless | tolerance | target. Default: target if targetTriangles/targetPercent is given, else tolerance.'),
        toleranceMm: rangeSchema(OR.simplify.toleranceMm).optional()
          .describe(`Mode tolerance only: Manifold simplify tolerance in mm (default ${OD.simplify.toleranceMm}).`),
        targetTriangles: rangeSchema(OR.simplify.targetTriangles).optional().describe('Mode target only: triangles to leave.'),
        targetPercent: rangeSchema(OR.simplify.targetPercent).optional().describe('Mode target only: % of the current triangles to keep.'),
        onDestructive: z.enum(SIMPLIFY_ON_DESTRUCTIVE as [string, ...string[]]).optional()
          .describe('Modes tolerance/target: safe (default: apply the safe version instead, or nothing) | block | force.'),
        allowDestructive: z.boolean().optional()
          .describe('Alias of onDestructive="force" (apply the destructive result anyway).'),
        dryRun: z.boolean().optional()
          .describe('true: return the same report without applying (no scene or undo-history change).'),
      },
    },
    async (args) =>
      dispatchWithFallback(
        ctx,
        'simplify_mesh',
        { ...args, id: args.objectId },
        () => ctx.headless.simplifyMeshParams({ ...args })
      )
  );
}
