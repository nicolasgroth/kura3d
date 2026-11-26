/**
 * @file src/core/recipes/run/opTable.ts
 * @description Tabla única `op` del formato → comando real del Command Bus (o operación propia del ejecutor), con
 * los argumentos que acepta cada paso. Es la lista blanca de la ejecución: una `op` fuera de la tabla, o un
 * argumento que la tabla no nombra, es un error tipado antes de tocar el motor. La prueba `opTable.test.ts` exige
 * que la tabla cubra exactamente `RECIPE_OPS` y que cada comando exista en el bus.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { KuraCommandName } from '../../commands/commandNames';
import { RECIPE_OPS } from '../schema/parts';
import { createPrimitiveOp, createThreadOp, importSvgOp } from './ops/createOps';
import { booleanOp, combineOp, convexHullOp } from './ops/csgOps';
import { alignOp, hollowOp, mirrorOp, planeCutOp, transformOp } from './ops/modifyOps';
import type { OpRunner } from './ops/opSupport';
import { placeOp } from './ops/placeOp';
import { screwContainerOp } from './ops/screwContainerOp';
import { SCREW_CONTAINER_NUMBER_KEYS } from '../../bus/screwContainerSchema';
import { pipeCouplingOp } from './ops/pipeCouplingOp';
import { PIPE_COUPLING_NUMBER_KEYS } from '../../bus/pipeCouplingSchema';

export type RecipeOp = (typeof RECIPE_OPS)[number];

export interface RecipeOpSpec {
  /** Comando del bus que ejecuta el paso; `null` para operaciones propias del ejecutor (`recipe.*`). */
  readonly command: KuraCommandName | null;
  /** Argumentos aceptados. `target`/`tools`/`objectIds` reciben `"@paso"` (el bus usa ids: `targetId`, `toolIds`…). */
  readonly args: readonly string[];
  readonly run: OpRunner;
}

const PLACEMENT = ['position', 'rotation', 'scale'] as const;

export const RECIPE_OP_TABLE: Readonly<Record<RecipeOp, RecipeOpSpec>> = Object.freeze({
  create_primitive: {
    command: 'create_primitive',
    args: ['type', 'params', ...PLACEMENT],
    run: createPrimitiveOp,
  },
  transform_object: { command: 'transform_object', args: ['target', ...PLACEMENT, 'dropToBed'], run: transformOp },
  boolean_operation: { command: 'boolean_operation', args: ['op', 'target', 'tools'], run: booleanOp },
  convex_hull: { command: 'convex_hull', args: ['objectIds'], run: convexHullOp },
  mirror_object: { command: 'mirror_object', args: ['target', 'axis'], run: mirrorOp },
  hollow_object: { command: 'hollow_object', args: ['target', 'wallThickness', 'drainHole', 'drainHoleRadius'], run: hollowOp },
  create_thread: {
    command: 'create_thread',
    args: ['kind', 'diameterMm', 'pitchMm', 'lengthMm', 'clearanceMm', 'includeHead', 'position'],
    run: createThreadOp,
  },
  create_screw_container: {
    // El paso crea UNA pieza (`part`); el comando del bus crea el par con esta misma receta.
    command: 'create_screw_container',
    args: ['part', ...SCREW_CONTAINER_NUMBER_KEYS, 'grip', 'base', 'position'],
    run: screwContainerOp,
  },
  create_pipe_coupling: {
    // El paso crea UNA mitad (`part`); el comando del bus crea el par con esta misma receta.
    command: 'create_pipe_coupling',
    args: ['part', 'joint', ...PIPE_COUPLING_NUMBER_KEYS, 'position'],
    run: pipeCouplingOp,
  },
  import_svg: { command: 'import_svg', args: ['svgContent', 'depth', 'targetWidth', 'curveSegments', 'position'], run: importSvgOp },
  plane_cut: {
    command: 'plane_cut',
    args: ['target', 'axis', 'offset', 'connectorType', 'connectorSize', 'connectorDepth', 'tolerance', 'connectorCount', 'keepMode'],
    run: planeCutOp,
  },
  combine_objects: { command: 'combine_objects', args: ['objectIds'], run: combineOp },
  align_objects: { command: 'align_objects', args: ['objectIds', 'mode'], run: alignOp },
  'recipe.place': { command: null, args: ['target', 'anchor', 'to', 'relativeTo', 'relativeAnchor'], run: placeOp },
} satisfies Record<RecipeOp, RecipeOpSpec>);

export function opSpec(op: string): RecipeOpSpec | undefined {
  return Object.prototype.hasOwnProperty.call(RECIPE_OP_TABLE, op) ? RECIPE_OP_TABLE[op as RecipeOp] : undefined;
}
