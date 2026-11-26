/**
 * @file src/store/exclusiveOperation.ts
 * @description Exclusión mutua de las operaciones asíncronas del store. `runExclusive` rechaza
 * (con aviso) una operación si ya hay otra en curso o un arrastre sin confirmar, marca
 * `busyOperation`, reporta el error y libera el bloqueo solo si lo tomó ella misma.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export interface ExclusiveRunnerDeps {
  /** true si hay una operación en curso o una interacción que bloquea la escena. */
  isLocked: () => boolean;
  setBusy: (name: string | null) => void;
  /** Aviso al rechazar por bloqueo. */
  onRejected: () => void;
  /** Reporte por defecto de un error de la operación. */
  onError: (err: unknown) => void;
}

export interface ExclusiveOptions {
  /** Reemplaza el reporte de error por defecto. */
  onError?: (err: unknown) => void;
}

export type RunExclusive = <T>(
  name: string,
  fallback: T,
  fn: () => Promise<T>,
  options?: ExclusiveOptions,
) => Promise<T>;

/** Crea el `runExclusive` del store. La comprobación y la toma del bloqueo son síncronas (sin carrera). */
export function createExclusiveRunner(deps: ExclusiveRunnerDeps): RunExclusive {
  return async (name, fallback, fn, options) => {
    if (deps.isLocked()) {
      deps.onRejected();
      return fallback;
    }
    deps.setBusy(name);
    try {
      return await fn();
    } catch (err) {
      (options?.onError ?? deps.onError)(err);
      return fallback;
    } finally {
      deps.setBusy(null);
    }
  };
}
