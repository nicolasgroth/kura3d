/**
 * @file src/core/bus/commandErrors.ts
 * @description Errores tipados del Command Bus y de las operaciones del store. Cada error lleva un
 * código estable (para pruebas, IA y MCP) y una clave i18n con sus parámetros; el texto se resuelve
 * en el idioma activo solo al responder, nunca se compara por regex.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { TranslationKey } from '../../i18n';

/** Códigos estables de rechazo del Command Bus. */
export type CommandErrorCode =
  | 'read-only'
  | 'unknown-command'
  | 'invalid-params'
  | 'not-found'
  | 'no-target'
  | 'ambiguous-target'
  | 'locked'
  | 'busy'
  | 'stale-input'
  | 'precondition'
  | 'failed';

type Params = Record<string, string | number>;

/** Error tipado del Command Bus: código + clave i18n + parámetros de interpolación. */
export class CommandError extends Error {
  readonly code: CommandErrorCode;
  readonly key: TranslationKey;
  readonly params: Params;

  constructor(code: CommandErrorCode, key: TranslationKey, params: Params = {}) {
    super(`${code}: ${key}`);
    this.name = 'CommandError';
    this.code = code;
    this.key = key;
    this.params = params;
  }
}

/** Códigos de fallo de las operaciones asíncronas del store. */
export type StoreOperationErrorCode = 'stale-input' | 'locked' | 'empty-result';

/**
 * Error tipado lanzado dentro de las operaciones del store. `message` ya viene traducido para que
 * los `catch` existentes (que muestran `err.message` en un toast) sigan funcionando sin cambios.
 */
export class StoreOperationError extends Error {
  readonly code: StoreOperationErrorCode;

  constructor(code: StoreOperationErrorCode, message: string) {
    super(message);
    this.name = 'StoreOperationError';
    this.code = code;
  }
}

/** Indica si un valor es un `StoreOperationError` con el código dado. */
export function isStoreOperationError(
  err: unknown,
  code?: StoreOperationErrorCode,
): err is StoreOperationError {
  return err instanceof StoreOperationError && (code === undefined || err.code === code);
}
