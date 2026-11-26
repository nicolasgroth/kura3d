/**
 * @file src/store/addonCommands.ts
 * @description Comandos del Command Bus de los agregados sobre una cara: `add_magnet_pocket`, `add_screw_boss`,
 * `add_keyhole` y `add_cable_pass`. Leen
 * el lugar (punto + normal o cara por nombre), llaman a las mismas acciones del store que el panel (un paso de
 * deshacer, agrupado con la pieza) y devuelven el objeto creado con su medición. Un bloqueo (hueco demasiado grande,
 * torreta más ancha que la zona) es el error tipado `addon-blocked`. Misma forma que el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { AddonBlockReason } from '../core/addons/addonBlock';
import { resolveAddonPlacement } from '../core/addons/addonPlacement';
import { isSolid } from '../core/scene/objectRole';
import {
  ADDON_HOST_KEYS,
  addonBlockedError,
  magnetResultToUser,
  parseMagnetPocketCommand,
  parseScrewBossCommand,
  screwBossResultToUser,
} from './addonCommandSchemas';
import { CommandError } from './commandErrors';
import {
  cablePassResultToUser,
  faceNegativeBlockedError,
  keyholeResultToUser,
  parseCablePassCommand,
  parseKeyholeCommand,
  type FaceNegativeBlock,
} from './faceNegativeCommandSchemas';
import { resolveTarget } from './commandTargets';
import type { RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

export const ADDON_HANDLERS = {
  add_magnet_pocket: async (p: RawParams, { get }: Deps) => {
    const host = resolveTarget(get(), p, { unlocked: true, keys: ADDON_HOST_KEYS });
    if (!isSolid(host)) throw new CommandError('precondition', 'magnet.needSolid');
    const { params, placement } = parseMagnetPocketCommand(p);
    const at = resolveAddonPlacement(host, placement, params.sizeMm / 2);
    let blocked: AddonBlockReason | null = null;
    const made = await get().addMagnetPocket({ hostId: host.id, params, ...at, onBlocked: (reason) => { blocked = reason; } });
    if (blocked) throw addonBlockedError(blocked);
    if (!made) throw new CommandError('failed', 'bus.error.failed', { command: 'add_magnet_pocket' });
    return magnetResultToUser(made, params, host.id, at);
  },

  add_screw_boss: async (p: RawParams, { get }: Deps) => {
    const host = resolveTarget(get(), p, { unlocked: true, keys: ADDON_HOST_KEYS });
    if (!isSolid(host)) throw new CommandError('precondition', 'turret.needSolid');
    const { params, placement } = parseScrewBossCommand(p);
    const at = resolveAddonPlacement(host, placement, params.outerDiameterMm / 2);
    let blocked: AddonBlockReason | null = null;
    const made = await get().addScrewBoss({ hostId: host.id, params, ...at, onBlocked: (reason) => { blocked = reason; } });
    if (blocked) throw addonBlockedError(blocked);
    if (!made) throw new CommandError('failed', 'bus.error.failed', { command: 'add_screw_boss' });
    return screwBossResultToUser(made, params, host.id, at);
  },

  add_keyhole: async (p: RawParams, { get }: Deps) => {
    const host = resolveTarget(get(), p, { unlocked: true, keys: ADDON_HOST_KEYS });
    if (!isSolid(host)) throw new CommandError('precondition', 'keyhole.needSolid');
    const { params, placement } = parseKeyholeCommand(p);
    const at = resolveAddonPlacement(host, placement, params.headDiameterMm / 2);
    let blocked: FaceNegativeBlock | null = null;
    const made = await get().addKeyhole({ hostId: host.id, params, ...at, silent: true, onBlocked: (reason) => { blocked = reason; } });
    if (blocked) throw faceNegativeBlockedError('keyhole', blocked);
    if (!made) throw new CommandError('failed', 'bus.error.failed', { command: 'add_keyhole' });
    return keyholeResultToUser(made, params, host.id, at);
  },

  add_cable_pass: async (p: RawParams, { get }: Deps) => {
    const host = resolveTarget(get(), p, { unlocked: true, keys: ADDON_HOST_KEYS });
    if (!isSolid(host)) throw new CommandError('precondition', 'cable.needSolid');
    const { params, placement } = parseCablePassCommand(p);
    const at = resolveAddonPlacement(host, placement, params.widthMm / 2);
    let blocked: FaceNegativeBlock | null = null;
    const made = await get().addCablePass({ hostId: host.id, params, ...at, silent: true, onBlocked: (reason) => { blocked = reason; } });
    if (blocked) throw faceNegativeBlockedError('cable_pass', blocked);
    if (!made) throw new CommandError('failed', 'bus.error.failed', { command: 'add_cable_pass' });
    return cablePassResultToUser(made, params, host.id, at);
  },
};
