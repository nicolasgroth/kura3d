/**
 * @file mcp-server/src/smoothOrientTools.ts
 * @description Herramientas MCP de «Suavizar malla» (`kura_smooth_mesh`) y «Orientar para imprimir»
 * (`kura_orient_for_print`, solo lectura, y `kura_apply_orientation`). Con la app conectada van por el Command Bus
 * (`smooth_mesh`, `orient_for_print`, `apply_orientation`); sin interfaz usan los mismos esquemas y operaciones del
 * motor compartido y dan la misma respuesta. Rangos de `SMOOTH_RANGES`, `ORIENT_RANGES` y `OPERATION_RANGES`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SMOOTH_BLOCK_VOLUME_PCT } from '../../src/core/operations/smoothOperations';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { ORIENT_RANGES } from '../../src/engine/orient';
import { SMOOTH_DEFAULTS as SD, SMOOTH_RANGES as SR } from '../../src/engine/smooth';
import { ORIENT_LANGUAGES } from '../../src/store/orientCommandSchemas';
import { hexColorSchema, idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const languageSchema = z.enum(ORIENT_LANGUAGES as [string, ...string[]]);

/** Ángulo y cama del análisis (los mismos en las dos herramientas de orientar: el id del candidato depende de ellos). */
const orientInputs = {
  overhangAngleDeg: rangeSchema(ORIENT_RANGES.overhangAngleDeg).optional()
    .describe(`Overhang angle from the vertical in degrees (default ${ORIENT_RANGES.overhangAngleDeg.default}); faces steeper than this need support.`),
  bedWidthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed width along X to check fit (default: active printer profile).'),
  bedDepthMm: rangeSchema(OR.split.bedMm).optional().describe('Bed depth along Y.'),
  bedHeightMm: rangeSchema(OR.split.bedMm).optional().describe('Usable printing height along Z.'),
  marginMm: rangeSchema(OR.split.marginMm).optional().describe('Margin per side subtracted from the bed in X/Y.'),
  ignoreBed: z.boolean().optional().describe('true = do not check bed fit (fitsBed is null).'),
};

export function registerSmoothOrientTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_smooth_mesh',
    {
      title: 'Smooth mesh',
      description:
        'Smooths an object mesh with Taubin λ/μ filtering (does not shrink the part like plain Laplacian smoothing): one undo step. ' +
        'Sharp edges above sharpAngleDeg and open borders stay fixed; zoneColor limits it to the triangles painted with that color ' +
        '(with falloffRings of soft transition: up to that many edge rings outside the painted triangles also move, with ' +
        'decreasing weight). If a few triangles would fold or self-intersect, only those vertices and two rings around them ' +
        'are pinned or damped (damageProtectedVertices) and the rest gets the requested strength; only when the damage is ' +
        'widespread is the strength halved as a last resort (appliedStrength; strengthCoveragePct = % of movable vertices ' +
        'smoothed with at least 80 % of the requested strength). Returns the report in world units (object scale applied): ' +
        `volume before/after and change in % (warning SMOOTH_VOLUME_CHANGED above ${SD.volumeWarnPct} %), moved and protected ` +
        'vertices, largest displacement. The transform does not change. If |volume change| > ' + SMOOTH_BLOCK_VOLUME_PCT + ' % ' +
        '(typical of very coarse meshes: refine the mesh first with kura_refine_mesh) the result is NOT applied: applied=false, ' +
        'blockedBy "volume_changed", volumeLimitPct; pass allowVolumeChange=true to apply it anyway (forced=true).',
      inputSchema: {
        objectId: idSchema.describe('ID of the object to smooth.'),
        strength: rangeSchema(SR.strength).optional().describe(`Intensity 0.1–1 (default ${SD.strength}; λ = 0.5 · strength).`),
        iterations: rangeSchema(SR.iterations).optional().describe(`Passes (default ${SD.iterations}).`),
        preserveSharpEdges: z.boolean().optional().describe(`Keep sharp edges fixed (default ${SD.preserveSharpEdges}).`),
        sharpAngleDeg: rangeSchema(SR.sharpAngleDeg).optional()
          .describe(`Dihedral angle in degrees from which an edge counts as sharp (default ${SD.sharpAngleDeg}).`),
        zoneColor: hexColorSchema.optional().describe('Only smooth the triangles painted with this color (#rrggbb, must be on the object).'),
        falloffRings: rangeSchema(SR.falloffRings).optional()
          .describe(`Only with zoneColor (error without it): rings of neighbors with decreasing weight around the zone (default ${SD.falloffRings}; 0 = hard border).`),
        allowVolumeChange: z.boolean().optional()
          .describe(`Apply even if the volume changes more than ${SMOOTH_BLOCK_VOLUME_PCT} % (default false: not applied).`),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'smooth_mesh', { ...args }, () => ctx.headless.smoothMesh({ ...args })),
  );

  server.registerTool(
    'kura_orient_for_print',
    {
      title: 'Orient for printing',
      description:
        'Read-only. Proposes stable orientations that reduce or remove supports (candidates: current, the 6 axis rests and ' +
        'convex-hull faces), measures each one resting on the bed and returns them sorted best first: support volume (mm³, grid ' +
        'approximation), overhang area, contact area, height, footprint [X, Y], tip angle and stability, bed fit, cost, and the ' +
        'differences against the current pose. Each reason has a key with params and a sentence in the requested language. ' +
        'currentIsBest = the current pose is already among the best and has a real base; allEquivalent = no winner (e.g. a sphere); ' +
        'recommendedId is null in both cases and when the first one is the current pose. Besides axis rests and hull faces, ' +
        'near-coplanar patches of the mesh with real contact are tried (organic parts). baseStatus = noStableBase (with a ' +
        'warning in warnings) when no orientation stands on its own: it will need supports, a raft or a flat cut. ' +
        'Apply one with kura_apply_orientation (same angle and bed). Kurra Studio does not generate supports.',
      inputSchema: {
        objectId: idSchema.describe('ID of the part to analyze.'),
        ...orientInputs,
        language: languageSchema.optional().describe('Language of the reason sentences (default en).'),
      },
    },
    async (args) => dispatchWithFallback(ctx, 'orient_for_print', { ...args }, () => ctx.headless.orientForPrint({ ...args })),
  );

  server.registerTool(
    'kura_apply_orientation',
    {
      title: 'Apply print orientation',
      description:
        'Turns a part to an orientation returned by kura_orient_for_print, given by candidateId (re-analyzed with the same angle ' +
        'and bed) or by its quaternion [x, y, z, w] (user axes, relative to the current pose). The part rests on the bed (Z = 0) ' +
        'and keeps its X/Y place (keepXY, default true) or is centered. With alignFootprint (default true for candidateId, false ' +
        'for an explicit quaternion) it is then turned around the vertical so the bounding box of its footprint on the bed is the ' +
        'smallest (minimum-area rectangle over the convex hull: a cube set on a hull face lies square, not diagonal); a part ' +
        'already aligned is not turned. One undo step. Pending negatives of its group turn with ' +
        'it, and magnet pockets and screw bosses follow their part keeping their size; followers lists the IDs that moved.',
      inputSchema: {
        objectId: idSchema.describe('ID of the part to turn.'),
        candidateId: idSchema.optional().describe('Candidate id from kura_orient_for_print (e.g. "axis-z" or "hull0"). Give this or quaternion.'),
        quaternion: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional()
          .describe('Rotation [x, y, z, w] of a candidate (user axes, relative to the current pose); normalized.'),
        keepXY: z.boolean().optional().describe('Keep the center on the bed in X/Y (default true); false = center on the origin.'),
        alignFootprint: z.boolean().optional()
          .describe('Turn around the vertical for the smallest footprint box (default true with candidateId, false with quaternion).'),
        ...orientInputs,
      },
    },
    async (args) => dispatchWithFallback(ctx, 'apply_orientation', { ...args }, () => ctx.headless.applyOrientation({ ...args })),
  );
}
