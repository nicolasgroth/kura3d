/**
 * @file src/engine/wasmScope.ts
 * @description Liberación segura de objetos WASM de Manifold (`Manifold`, `CrossSection`): un
 * ámbito que borra todo lo registrado al salir, también si algo lanza, y ayudas para un solo
 * objeto. Evita fugas de memoria del heap WASM en los caminos de error.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Cualquier objeto con memoria WASM que se libera con `delete()`. */
export interface WasmHandle {
  delete(): void;
}

/** Objetos WASM a liberar juntos. Se borran en orden inverso al registro. */
export class WasmScope {
  private handles: WasmHandle[] = [];

  /** Registra `handle` para liberarlo al cerrar el ámbito y lo devuelve. */
  track<T extends WasmHandle>(handle: T): T {
    this.handles.push(handle);
    return handle;
  }

  /** Registra varios objetos (por ejemplo, el resultado de `decompose()`). */
  trackAll<T extends WasmHandle>(handles: T[]): T[] {
    this.handles.push(...handles);
    return handles;
  }

  /** Saca `handle` del ámbito: desde ahora lo libera quien lo recibe. */
  keep<T extends WasmHandle>(handle: T): T {
    this.handles = this.handles.filter((h) => h !== handle);
    return handle;
  }

  /** Libera lo registrado. Un `delete()` que falla no impide liberar el resto. */
  dispose(): void {
    const pending = this.handles;
    this.handles = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      try {
        pending[i].delete();
      } catch {
        // Ya liberado o módulo reiniciado: no hay nada más que soltar.
      }
    }
  }
}

/** Ejecuta `fn` con un ámbito que se libera al salir (con o sin error). Usa `keep` para devolver. */
export function withWasmScope<T>(fn: (scope: WasmScope) => T): T {
  const scope = new WasmScope();
  try {
    return fn(scope);
  } finally {
    scope.dispose();
  }
}

/** Usa `handle` y lo libera siempre después. */
export function useThenDelete<H extends WasmHandle, T>(handle: H, fn: (handle: H) => T): T {
  try {
    return fn(handle);
  } finally {
    handle.delete();
  }
}

/** Usa `handle` y lo libera solo si `fn` lanza (si no, sigue siendo del llamador). */
export function deleteOnThrow<H extends WasmHandle, T>(handle: H, fn: (handle: H) => T): T {
  try {
    return fn(handle);
  } catch (err) {
    handle.delete();
    throw err;
  }
}
