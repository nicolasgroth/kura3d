/**
 * @file src/store/roleCommands.ts
 * @description Comando `set_object_role` del Command Bus: fija el rol (sólido / negativo / referencia)
 * de los objetos indicados o de la selección, en un paso de deshacer, y opcionalmente la opacidad
 * propia de una referencia. `isHole` se acepta como alias obsoleto de `role`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { OBJECT_ROLES, readRoleInput, REFERENCE_OPACITY } from '../core/scene/objectRole';
import { CommandError } from './commandErrors';
import { resolveIdsOrSelection, resolveObjects } from './commandTargets';
import { readBoolean, readEnum, readId, readNumber, type RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

/** Lee `role` (o el alias `isHole`) y `referenceOpacity`; exige al menos uno. */
export function parseSetObjectRole(p: RawParams) {
  const role = readRoleInput({ role: readEnum(p, OBJECT_ROLES, 'role'), isHole: readBoolean(p, 'isHole') });
  const referenceOpacity = readNumber(p, { min: REFERENCE_OPACITY.min, max: REFERENCE_OPACITY.max }, 'referenceOpacity', 'opacity');
  if (role === undefined && referenceOpacity === undefined) {
    throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'role', expected: OBJECT_ROLES.join(' | ') });
  }
  return { role, referenceOpacity };
}

export const ROLE_HANDLERS = {
  set_object_role: (p: RawParams, { get }: Deps) => {
    const single = readId(p, 'id', 'objectId');
    const targets = single ? resolveObjects(get(), [single], true) : resolveIdsOrSelection(get(), p, { unlocked: true });
    const { role, referenceOpacity } = parseSetObjectRole(p);
    const ids = targets.map((o) => o.id);
    if (role !== undefined) get().setObjectsRole(ids, role);
    if (referenceOpacity !== undefined) {
      for (const obj of get().objects.filter((o) => ids.includes(o.id) && o.role === 'reference')) {
        get().updateObjectMeta(obj.id, { referenceOpacity });
      }
    }
    return get().objects
      .filter((o) => ids.includes(o.id))
      .map((o) => ({ id: o.id, name: o.name, role: o.role, ...(o.referenceOpacity !== undefined ? { referenceOpacity: o.referenceOpacity } : {}) }));
  },
};
