/**
 * @file src/project/projectRoleMigration.ts
 * @description Migración del rol de objeto en `.kura`: hasta la versión 2 cada objeto guardaba
 * `isHole: boolean`; desde la 3 guarda `role` ('solid' | 'negative' | 'reference') y, si es
 * referencia, `referenceOpacity`. Aislada en su propia función para reconciliar fácilmente con otras
 * subidas de versión del formato.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isObjectRole, roleFromLegacy } from '../core/scene/objectRole';
import { check, record } from './projectSchema';

/** Primera versión del `.kura` que guarda `role` en lugar de `isHole`. */
export const ROLE_FORMAT_VERSION = 3;

/**
 * Normaliza un objeto guardado al esquema actual (con `role`). En versiones previas exige `isHole`
 * booleano y sin `role`; desde `ROLE_FORMAT_VERSION`, `role` válido y sin `isHole`. Devuelve una copia.
 */
export function migrateStoredRole(stored: unknown, version: number): unknown {
  check(record(stored));
  if (version >= ROLE_FORMAT_VERSION) {
    check(!('isHole' in stored) && isObjectRole(stored.role));
    return stored;
  }
  check(typeof stored.isHole === 'boolean' && !('role' in stored) && !('referenceOpacity' in stored));
  const { isHole, ...rest } = stored;
  return { ...rest, role: roleFromLegacy(isHole as boolean) };
}
