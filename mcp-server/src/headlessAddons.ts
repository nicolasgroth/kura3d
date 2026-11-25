/**
 * @file mcp-server/src/headlessAddons.ts
 * @description Agregados sobre una cara en el motor sin interfaz: alojamiento de imán (`add_magnet_pocket`) y
 * torreta para tornillo (`add_screw_boss`). Mismos esquemas, lugar, vecinos, nombres, operación y bloqueos que el
 * Command Bus de la app (`src/store/addonCommandSchemas`, `src/core/addons`), con la misma respuesta. La escena sin
 * interfaz no tiene grupos: el agregado queda ligado a su pieza por `metadata.addon.hostId` (y la sigue igual).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { magnetBlockReason } from '../../src/core/addons/addonBlock';
import { magnetPocketName, screwBossNames } from '../../src/core/addons/addonNames';
import { nearbyAddons, nearbyNegatives, placedMeshOf } from '../../src/core/addons/addonNeighbors';
import { resolveAddonPlacement } from '../../src/core/addons/addonPlacement';
import { CommandError } from '../../src/core/bus/commandErrors';
import { resolveTarget } from '../../src/core/bus/commandTargets';
import type { RawParams } from '../../src/core/bus/commandValidation';
import { createMagnetPocket } from '../../src/core/operations/magnetOperations';
import { change, type OperationContext, type SceneChange } from '../../src/core/operations/operationTypes';
import { createScrewBoss } from '../../src/core/operations/screwBossOperations';
import { isSolid } from '../../src/core/scene/objectRole';
import {
  ADDON_HOST_KEYS,
  addonBlockedError,
  magnetResultToUser,
  parseMagnetPocketCommand,
  parseScrewBossCommand,
  screwBossResultToUser,
} from '../../src/store/addonCommandSchemas';
import type { PrinterProfile } from '../../src/types/kura';
import type { HeadlessSceneObject } from './headlessSupport.js';

/** Lo que las operaciones sin interfaz necesitan de la escena. */
export interface HeadlessScene {
  /** Objetos vivos en orden de escena (se leen de nuevo tras cada cambio). */
  objects: () => HeadlessSceneObject[];
  ctx: OperationContext;
  profile: PrinterProfile;
  /** Aplica el cambio (con la regla de los agregados que siguen a su pieza). */
  apply: (change: SceneChange) => void;
}

/** Pieza anfitriona: sólido desbloqueado (mismos errores tipados que el bus). */
function hostOf(scene: HeadlessScene, p: RawParams, needSolidKey: 'magnet.needSolid' | 'turret.needSolid') {
  const host = resolveTarget({ objects: scene.objects(), selectedIds: [] }, p, { unlocked: true, keys: ADDON_HOST_KEYS });
  if (!isSolid(host)) throw new CommandError('precondition', needSolidKey);
  return host;
}

const takenNames = (scene: HeadlessScene) => new Set(scene.objects().map((o) => o.name));

export async function headlessAddMagnetPocket(scene: HeadlessScene, p: RawParams) {
  const host = hostOf(scene, p, 'magnet.needSolid');
  const { params, placement } = parseMagnetPocketCommand(p);
  const at = resolveAddonPlacement(host, placement);
  const made = await createMagnetPocket(scene.ctx, {
    host: { id: host.id, ...placedMeshOf(host) },
    params,
    ...at,
    name: magnetPocketName(params, 'en', takenNames(scene)),
    pendingNegatives: nearbyNegatives(scene.objects(), host).map(placedMeshOf),
  });
  const blocked = magnetBlockReason(made);
  if (blocked) throw addonBlockedError(blocked);
  scene.apply(change({ added: [made.obj] }));
  return magnetResultToUser(made, params, host.id, at);
}

export async function headlessAddScrewBoss(scene: HeadlessScene, p: RawParams) {
  const host = hostOf(scene, p, 'turret.needSolid');
  const { params, placement } = parseScrewBossCommand(p);
  const at = resolveAddonPlacement(host, placement);
  const made = await createScrewBoss(scene.ctx, {
    host: { id: host.id, color: host.color, ...placedMeshOf(host) },
    params,
    ...at,
    names: screwBossNames(params, 'en', takenNames(scene)),
    nearbyAddons: nearbyAddons(scene.objects(), host).map(placedMeshOf),
  });
  if (made.spansFace) throw addonBlockedError('tooWide');
  scene.apply(change({ added: [made.post, made.hole] }));
  return screwBossResultToUser(made, params, host.id, at);
}
