/**
 * @file src/project/recoveryFlush.ts
 * @description Registro del autoguardado de recuperación activo para pedirle un borrador al momento
 * (p. ej. antes de importar un modelo grande que podría agotar la memoria), sin acoplar el store al
 * hook de React que lo arranca.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Flush = () => Promise<void>;

let active: Flush | null = null;

/** El hook de recuperación registra su controlador (null al desmontarse). */
export function registerRecoveryFlush(flush: Flush | null): void {
  active = flush;
}

/** Escribe el borrador ahora si hay cambios pendientes; false si no hay autoguardado activo. */
export async function flushRecoveryDraft(): Promise<boolean> {
  if (!active) return false;
  await active();
  return true;
}
