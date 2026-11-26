/**
 * @file mcp-server/src/screwFitTools.ts
 * @description Herramientas MCP de roscas que enroscan: `kura_create_screw_container` (recipiente con tapa roscada por
 * la receta incorporada `kura.tapa-roscada`), `kura_create_thread_pair` (perno + tuerca o agujero roscado + perno lado
 * a lado con su holgura) y `kura_check_screw_fit` (solo lectura: interferencia y holgura mínima entre dos objetos a lo
 * largo de la hélice). Con la app conectada van por el Command Bus; sin interfaz usan las mismas operaciones puras.
 * Validación estricta con los rangos de `OPERATION_RANGES` (lo que el esquema deja pasar lo revalida el bus).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { SCREW_CONTAINER_BASES, SCREW_CONTAINER_GRIPS } from '../../src/engine/screwContainer';
import { isoThreadPairFit } from '../../src/engine/threadPairFit';
import { threadDefaults } from '../../src/engine/threadDefaults';
import { parseScrewContainer, parseScrewFit, SCREW_CONTAINER_RECIPE_ID, THREAD_PAIRS } from '../../src/core/bus/screwContainerSchema';
import { checkScrewFitObjects } from '../../src/core/operations/screwContainerOperations';
import { builtinRecipe } from '../../src/core/recipes/builtin';
import { RECIPE_LANGUAGES } from '../../src/core/recipes/limits';
import { appliedRecipeResponse, issueBusCode, issueText } from '../../src/core/recipes/run/response';
import type { SceneObject } from '../../src/types/kura';
import { HeadlessCommandError } from './headlessSupport.js';
import { idSchema, rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const SC = OR.screwContainer;

const containerShape = {
  innerDiameterMm: rangeSchema(SC.innerDiameterMm).optional().describe('Inner (free) diameter of the mouth and cavity in mm (default 50).'),
  innerHeightMm: rangeSchema(SC.innerHeightMm).optional().describe('Inner height from the floor to the mouth in mm (default 40; must exceed thread length + 2 mm).'),
  wallMm: rangeSchema(SC.wallMm).optional().describe('Wall thickness in mm (default 2).'),
  bottomMm: rangeSchema(SC.bottomMm).optional().describe('Container bottom and lid top thickness in mm (default 2).'),
  pitchMm: rangeSchema(SC.pitchMm).optional().describe('Thread pitch in mm (default 4; coarse 3–6 recommended).'),
  starts: z.number().int().min(SC.starts.min).max(SC.starts.max).optional().describe('Thread starts 1–4 (default 1); lead = starts × pitch.'),
  turns: rangeSchema(SC.turns).optional().describe('Thread turns (default 2; 1.5–3 recommended).'),
  radialClearanceMm: rangeSchema(SC.radialClearanceMm).optional().describe('Radial clearance between container and lid threads in mm (default 0.3).'),
  axialClearanceMm: rangeSchema(SC.axialClearanceMm).optional().describe('Axial play per flank in mm (default 0.45; 45° flanks already give radial clearance as axial play).'),
  grip: z.enum(SCREW_CONTAINER_GRIPS).optional().describe('Lid grip: knurl (default), flats or none.'),
  base: z.enum(SCREW_CONTAINER_BASES).optional().describe('Body base: round (default) or square with a round mouth.'),
  language: z.enum(RECIPE_LANGUAGES).optional().describe('Language of part names and messages (default: es).'),
};

function headlessFail(issue: Parameters<typeof issueText>[0] | undefined, lang: Parameters<typeof issueText>[1]): never {
  if (!issue) throw new HeadlessCommandError('precondition', 'The container could not be created.');
  throw new HeadlessCommandError(issueBusCode(issue) === 'failed' ? 'precondition' : 'invalid-params', issueText(issue, lang), { code: issue.code, path: issue.path });
}

export function registerScrewFitTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_create_screw_container',
    {
      title: 'Create container with screw lid',
      description:
        'Creates a printable jar and its screw-on lid (built-in recipe kura.tapa-roscada, editable later with the assistant): ' +
        'coarse trapezoidal thread with 45° flanks (no supports), lead-in chamfers, the lid stops on the container shoulder. ' +
        'Both parts are added side by side as ONE undo step. Returns the objects and screwFit: status ok | tight | interference, ' +
        'minClearanceMm and maxInterferenceMm3 measured along the helix (lid screwed in and backed off). Write tool.',
      inputSchema: containerShape,
    },
    async (args) =>
      dispatchWithFallback(ctx, 'create_screw_container', { ...args }, async () => {
        const lang = args.language ?? 'es';
        const answers = parseScrewContainer(args);
        const result = await ctx.headless.runRecipe({ recipe: builtinRecipe(SCREW_CONTAINER_RECIPE_ID), answers, options: { language: lang } });
        if (!result.ok) headlessFail(result.errors[0], lang);
        return { ...appliedRecipeResponse(result), screwFit: result.checks.find((c) => c.kind === 'screw_fit') ?? null };
      }),
  );

  server.registerTool(
    'kura_create_thread_pair',
    {
      title: 'Create matching ISO thread pair',
      description:
        'Creates a matching ISO metric pair side by side with the print clearance applied: bolt + nut (pair "bolt-nut") or ' +
        'negative threaded hole + bolt ("hole-bolt"), and checks that they screw together (screwFit: status, minClearanceMm, ' +
        'maxInterferenceMm3). Without pitch or length, the ISO coarse pitch and 2.5·d. Write tool.',
      inputSchema: {
        pair: z.enum(THREAD_PAIRS).default('bolt-nut').describe('Which pair to create.'),
        diameterMm: rangeSchema(OR.thread.diameterMm).default(8).describe('Nominal metric diameter in mm (M3–M64).'),
        pitchMm: rangeSchema(OR.thread.pitchMm).optional().describe('Pitch in mm (maximum d/4). Default: ISO coarse.'),
        lengthMm: rangeSchema(OR.thread.lengthMm).optional().describe('Threaded length of bolt and hole in mm (default 2.5·d). The nut uses ≈ 0.8·d.'),
        clearanceMm: rangeSchema(OR.thread.clearanceMm).optional().describe('Radial print clearance of the nut/hole in mm (default from the pitch).'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'create_thread_pair', { ...args }, async () => {
        const d = threadDefaults(args.diameterMm, 'bolt');
        const common = { diameterMm: args.diameterMm, pitchMm: args.pitchMm ?? d.pitchMm, clearanceMm: args.clearanceMm };
        const lengthMm = args.lengthMm ?? d.lengthMm;
        const nutLength = threadDefaults(args.diameterMm, 'nut').lengthMm;
        const bolt = { ...common, kind: 'bolt' as const, lengthMm, includeHead: true };
        const female = args.pair === 'bolt-nut' ? { ...common, kind: 'nut' as const, lengthMm: nutLength } : { ...common, kind: 'hole' as const, lengthMm };
        const fit = await isoThreadPairFit({ ...common, lengthMm: Math.min(lengthMm, female.lengthMm) });
        const first = await ctx.headless.createThread(args.pair === 'bolt-nut' ? bolt : female, 'free');
        const second = await ctx.headless.createThread(args.pair === 'bolt-nut' ? female : bolt, 'free');
        return { objects: [first, second], screwFit: fit };
      }),
  );

  server.registerTool(
    'kura_check_screw_fit',
    {
      title: 'Check screw fit',
      description:
        'Read-only. Checks that a female part (nut, lid, coupling) screws onto a male part where they are placed now (female in ' +
        'its final screwed position, coaxial): it backs the female off along the helix (rotate and advance leadMm per turn) at ' +
        'several positions and measures the intersection volume and the minimum clearance. status: ok (clearance ≥ 0.1 mm, no ' +
        'overlap) | tight | interference. The axis passes through the male bounding-box center along `axis` (user axes, default z).',
      inputSchema: {
        maleId: idSchema.describe('Male part (bolt, container neck).'),
        femaleId: idSchema.describe('Female part in its final screwed position.'),
        leadMm: rangeSchema(OR.screwFit.leadMm).describe('Advance per turn in mm (starts × pitch).'),
        turns: rangeSchema(OR.screwFit.turns).optional().describe('Turns to back off while measuring (default 1).'),
        samples: z.number().int().min(OR.screwFit.samples.min).max(OR.screwFit.samples.max).optional().describe('Positions measured (default 6).'),
        axis: z.enum(['x', 'y', 'z']).optional().describe('Thread axis in user axes (default z, up).'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'check_screw_fit', { ...args }, async () => {
        if (args.maleId === args.femaleId) throw new HeadlessCommandError('invalid-params', 'femaleId must be a different object than maleId.');
        const male = ctx.headless.getObject(args.maleId) as SceneObject;
        const female = ctx.headless.getObject(args.femaleId) as SceneObject;
        const report = await checkScrewFitObjects(male, female, parseScrewFit(args));
        return { dryRun: true, maleId: args.maleId, femaleId: args.femaleId, ...report };
      }),
  );
}
