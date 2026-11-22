/**
 * @file src/store/operationErrors.ts
 * @description Puente entre los errores/avisos tipados del motor y la interfaz: traduce un error
 * de operación al idioma activo (`localizeEngineError`), recuerda el último error para que el
 * Command Bus pueda devolver su código estable (`errorCode`) y convierte avisos del motor en textos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { localizeEngineErrorForUser, localizeEngineWarningForUser } from './userEngineMessages';
import {
  isEngineError,
  type EngineErrorCode,
  type EngineWarning,
} from '../engine/engineErrors';
import type { LanguageCode } from '../types/kura';

/** Fallo traducido de una operación, con el código del motor si lo había. */
export interface OperationFailure {
  message: string;
  engineCode?: EngineErrorCode;
}

/** Registro del último error de operación del store (uno por store). */
export interface OperationErrorTracker {
  /** Guarda el error y devuelve su texto en `lang`. */
  record(err: unknown, lang: LanguageCode): string;
  /** Devuelve el último fallo registrado y lo olvida. */
  take(): OperationFailure | null;
  /** Olvida cualquier fallo previo (al empezar un comando). */
  clear(): void;
}

/** Crea un registro de errores de operación. */
export function createOperationErrorTracker(): OperationErrorTracker {
  let last: OperationFailure | null = null;
  return {
    record(err, lang) {
      const message = localizeEngineErrorForUser(lang, err);
      last = { message, engineCode: isEngineError(err) ? err.code : undefined };
      return message;
    },
    take() {
      const value = last;
      last = null;
      return value;
    },
    clear() {
      last = null;
    },
  };
}

/** Textos localizados de los avisos del motor (vacío si no hay). */
export function localizeWarnings(lang: LanguageCode, warnings: readonly EngineWarning[] | undefined): string[] {
  return (warnings ?? []).map((warning) => localizeEngineWarningForUser(lang, warning));
}
