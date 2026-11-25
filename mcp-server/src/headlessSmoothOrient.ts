/**
 * @file mcp-server/src/headlessSmoothOrient.ts
 * @description «Suavizar malla» (`smooth_mesh`) y «Orientar para imprimir» (`orient_for_print`, solo lectura;
 * `apply_orientation`) en el motor sin interfaz: mismos esquemas (`src/store/*CommandSchemas`), mismas operaciones
 * puras (`smoothObject`, `orientForPrint`, `orientApplyChange`), los negativos del grupo acompañan el giro
 * (`orientFollowPatches`) y los agregados siguen a su pieza al aplicar el cambio. Misma respuesta que el bus.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { CommandError } from '../../src/core/bus/commandErrors';
import { resolveTarget } from '../../src/core/bus/commandTargets';
import { readBoolean, type RawParams } from '../../src/core/bus/commandValidation';
import { fitBedOf } from '../../src/core/operations/fitOperations';
import { orientableObject, orientApplyChange, orientForPrint } from '../../src/core/operations/orientOperations';
import { smoothObject, smoothVolumeBlocked } from '../../src/core/operations/smoothOperations';
import { orientFollowPatches } from '../../src/core/scene/rigidFollow';
import { transformToUser } from '../../src/core/scene/userAxesContract';
import {
  findOrientCandidate,
  movedObjectIds,
  orientAnalysisToUser,
  parseApplyOrientation,
  parseOrientLanguage,
  parseOrientOptions,
  quaternionToUser,
} from '../../src/store/orientCommandSchemas';
import { parseSmoothMesh, smoothReportToUser } from '../../src/store/smoothCommandSchemas';
import { smoothTaskOptions } from '../../src/store/smoothParams';
import type { HeadlessScene } from './headlessAddons.js';
import { worldStatsOf } from './headlessSupport.js';

const view = (scene: HeadlessScene) => ({ objects: scene.objects(), selectedIds: [] });

export function headlessSmoothMesh(scene: HeadlessScene, p: RawParams) {
  const target = resolveTarget(view(scene), p, { unlocked: true });
  const params = parseSmoothMesh(p, target.mesh);
  const allowVolumeChange = readBoolean(p, 'allowVolumeChange') ?? false;
  const { report, change } = smoothObject(scene.ctx, target, smoothTaskOptions(params, target.mesh));
  // Volumen sobre el tope: no se aplica salvo `allowVolumeChange` (misma regla que la app).
  const blocked = change.patches.length > 0 && smoothVolumeBlocked(report, allowVolumeChange);
  if (blocked) return { id: target.id, ...smoothReportToUser(report, false, true) };
  // Sin vértices que mover el cambio no trae parches, pero sí el aviso.
  scene.apply(change);
  if (change.patches.length > 0) target.stats = worldStatsOf(target);
  return { id: target.id, ...smoothReportToUser(report, change.patches.length > 0, false, allowVolumeChange) };
}

function analyze(scene: HeadlessScene, p: RawParams, unlocked: boolean) {
  const target = resolveTarget(view(scene), p, { unlocked });
  if (!orientableObject(target)) {
    throw new CommandError('precondition', 'bus.error.failed', { command: 'orient_for_print' });
  }
  return { target, analysis: () => orientForPrint({ obj: target, options: parseOrientOptions(p, fitBedOf(scene.profile)) }) };
}

export function headlessOrientForPrint(scene: HeadlessScene, p: RawParams) {
  const { target, analysis } = analyze(scene, p, false);
  return { id: target.id, ...orientAnalysisToUser(analysis(), parseOrientLanguage(p)) };
}

export function headlessApplyOrientation(scene: HeadlessScene, p: RawParams) {
  const request = parseApplyOrientation(p);
  const { target, analysis } = analyze(scene, p, true);
  const quaternion = request.quaternion ?? findOrientCandidate(analysis(), request.candidateId!).quaternion;
  const before = scene.objects().map((o) => ({ ...o }));
  const change = orientApplyChange({ obj: target, quaternion, keepXY: request.keepXY, alignFootprint: request.alignFootprint });
  change.patches.push(...orientFollowPatches(scene.objects(), target, change));
  scene.apply(change);
  for (const { id } of change.patches) {
    const obj = scene.objects().find((o) => o.id === id);
    if (obj) obj.stats = worldStatsOf(obj);
  }
  return {
    id: target.id,
    applied: request.candidateId ?? 'quaternion',
    quaternion: quaternionToUser(quaternion),
    keepXY: request.keepXY,
    alignFootprint: request.alignFootprint,
    ...transformToUser(target),
    followers: movedObjectIds(before, scene.objects(), target.id),
  };
}
