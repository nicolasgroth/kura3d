/**
 * @file src/core/recipes/run/ops/createOps.ts
 * @description Pasos que crean objetos: `create_primitive`, `create_thread` e `import_svg`. Leen sus argumentos con
 * los MISMOS validadores y rangos del Command Bus (`commandSchemas`) y generan la malla con las operaciones puras del
 * motor. `position` es el centro de la base (ejes del usuario, mm), `rotation` en grados y `scale` por eje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createPrimitive, createThread, importSvg, primitiveMesh } from '../../../operations/creationOperations';
import { parseCreatePrimitive, parseImportSvg, parseThread } from '../../../bus/commandSchemas';
import { readVec3 } from '../../../bus/commandValidation';
import { plainArgs } from '../args';
import { guarded, positionFromUser, rotationFromUserDeg, scaleFromUserAxes, type OpRunner } from './opSupport';

const DEFAULT_COLOR = '#94a3b8';

export const createPrimitiveOp: OpRunner = async (call) => {
  const raw = plainArgs(call.args, call.at);
  const input = await guarded(call, () => parseCreatePrimitive(raw));
  const mesh = await guarded(call, () => primitiveMesh(input.type, input.params));
  const obj = await guarded(call, () => createPrimitive(call.ctx, {
    type: input.type,
    params: input.params,
    name: call.name,
    color: DEFAULT_COLOR,
    position: positionFromUser(input.position),
    rotation: rotationFromUserDeg(input.rotation),
    scale: scaleFromUserAxes(input.scale),
    mesh,
  }));
  return [obj];
};

export const createThreadOp: OpRunner = async (call) => {
  const raw = plainArgs(call.args, call.at);
  const options = await guarded(call, () => parseThread(raw));
  const position = await guarded(call, () => readVec3(raw, 'position'));
  const obj = await guarded(call, () => createThread(call.ctx, options, { name: call.name, position: positionFromUser(position) }));
  // La rosca nace con el rol de su tipo (agujero = negativo); dentro de la receta todo es un sólido de trabajo.
  return [{ ...obj, role: 'solid' }];
};

export const importSvgOp: OpRunner = async (call) => {
  const raw = plainArgs(call.args, call.at);
  const input = await guarded(call, () => parseImportSvg(raw));
  const position = await guarded(call, () => readVec3(raw, 'position'));
  const obj = await guarded(call, () => importSvg(
    call.ctx,
    { svgContent: input.svgContent, name: call.name, depth: input.depth, targetWidth: input.targetWidth, curveSegments: input.curveSegments },
    { name: call.name, color: DEFAULT_COLOR, place: () => positionFromUser(position) },
  ));
  return [obj];
};
