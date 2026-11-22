/**
 * @file mcp-server/src/headlessQueue.ts
 * @description Cola FIFO del motor headless: las llamadas MCP concurrentes se ejecutan una tras
 * otra, así una operación que espera al motor (booleana, corte, molde) no ve la escena cambiada a
 * mitad de camino por otra llamada. Un fallo no detiene la cola.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Serializa tareas síncronas o asíncronas en orden de llegada. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private depth = 0;

  /** Encola `task`; se ejecuta cuando terminan todas las anteriores. */
  run<T>(task: () => Promise<T> | T): Promise<T> {
    this.depth++;
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => this.depth--,
      () => this.depth--,
    );
    return next;
  }

  /** Tareas encoladas o en curso. */
  get size(): number {
    return this.depth;
  }
}
