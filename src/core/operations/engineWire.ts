/**
 * @file src/core/operations/engineWire.ts
 * @description Protocolo entre el hilo principal y el Worker del motor: mensajes, serialización
 * de `EngineError` (código + parámetros), buffers transferibles de mallas, copia de entradas y
 * nombres diferidos (el Worker no tiene i18n: cada nombre viaja como token y el hilo principal
 * lo resuelve con su `ResultNaming` real).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { EngineError, isEngineError, type EngineErrorCode, type EngineMessageParams } from '../../engine/engineErrors';
import type { ResultNaming } from '../scene/resultNames';
import type { ObjectBuildPolicy } from '../scene/sceneObjects';
import type { SceneObject } from '../../types/kura';

export interface EngineTaskRequest {
  type: 'run';
  id: number;
  task: string;
  args: unknown;
  policy: ObjectBuildPolicy;
}

export interface NamingCall {
  method: keyof ResultNaming;
  args: unknown[];
}

export type SerializedError =
  | { kind: 'engine'; code: EngineErrorCode; params: EngineMessageParams; message: string }
  | { kind: 'other'; message: string };

export type EngineTaskResponse =
  | { type: 'progress'; id: number; phase: string }
  | { type: 'done'; id: number; result: unknown; names: NamingCall[] }
  | { type: 'error'; id: number; error: SerializedError };

export function serializeError(err: unknown): SerializedError {
  if (isEngineError(err)) return { kind: 'engine', code: err.code, params: { ...err.params }, message: err.message };
  return { kind: 'other', message: err instanceof Error ? err.message : String(err) };
}

/** Reconstruye el error en el hilo principal (`EngineError` con su código y parámetros). */
export function deserializeError(e: SerializedError): Error {
  return e.kind === 'engine' ? new EngineError(e.code, e.params) : new Error(e.message);
}

const isTyped = (v: unknown): v is Float32Array | Uint32Array | Uint8Array | Float64Array | Uint16Array | Int32Array =>
  ArrayBuffer.isView(v) && !(v instanceof DataView);

/** Buffers de todas las vistas tipadas alcanzables (sin repetir), para transferir sin clonar. */
export function collectTransferables(value: unknown): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  const seen = new Set<object>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (isTyped(v)) {
      if (v.buffer instanceof ArrayBuffer) out.add(v.buffer);
      return;
    }
    for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child);
  };
  walk(value);
  return [...out];
}

/**
 * Copia profunda con vistas tipadas en buffers propios y compactos: las entradas viven en el
 * store y el historial, así que se envía una copia y esa copia se transfiere (no se desliga la
 * malla del editor). Comparte referencias repetidas.
 */
export function copyForTransfer<T>(value: T): T {
  const memo = new Map<unknown, unknown>();
  const copy = (v: unknown): unknown => {
    if (!v || typeof v !== 'object') return v;
    if (memo.has(v)) return memo.get(v);
    if (isTyped(v)) {
      const c = v.slice();
      memo.set(v, c);
      return c;
    }
    if (Array.isArray(v)) {
      const arr: unknown[] = [];
      memo.set(v, arr);
      for (const item of v) arr.push(copy(item));
      return arr;
    }
    const obj: Record<string, unknown> = {};
    memo.set(v, obj);
    for (const [k, child] of Object.entries(v)) obj[k] = copy(child);
    return obj;
  };
  return copy(value) as T;
}

const TOKEN = '\u0000kn';
const TOKEN_RE = /\u0000kn(\d+)\u0000/g;
const OBJ_REF = '__kuraObjectRef';

const isSceneObject = (v: unknown): v is SceneObject =>
  !!v && typeof v === 'object' && 'id' in v && 'mesh' in v && 'name' in v;

/** `ResultNaming` del Worker: devuelve tokens y registra cada llamada (objetos por ID). */
export function createRecordingNaming(): { naming: ResultNaming; calls: NamingCall[] } {
  const calls: NamingCall[] = [];
  const encode = (arg: unknown): unknown =>
    isSceneObject(arg) ? { [OBJ_REF]: arg.id } : Array.isArray(arg) ? arg.map(encode) : arg;
  const naming = new Proxy({} as ResultNaming, {
    get: (_t, method) => (...args: unknown[]) => {
      calls.push({ method: method as keyof ResultNaming, args: args.map(encode) });
      return `${TOKEN}${calls.length - 1}\u0000`;
    },
  });
  return { naming, calls };
}

/**
 * Reemplaza los tokens de nombre en `result` (in situ: es la copia recibida del Worker) con el
 * nombre real. Los objetos referidos se buscan entre `known` (entradas) y los del propio resultado.
 */
export function resolveNames(result: unknown, calls: NamingCall[], naming: ResultNaming, known: SceneObject[]): void {
  if (calls.length === 0) return;
  const byId = new Map<string, SceneObject>(known.map((o) => [o.id, o]));
  const visited = new Set<object>();
  const index = (v: unknown) => {
    if (!v || typeof v !== 'object' || visited.has(v) || ArrayBuffer.isView(v)) return;
    visited.add(v);
    if (isSceneObject(v) && !byId.has(v.id)) byId.set(v.id, v);
    for (const child of Array.isArray(v) ? v : Object.values(v)) index(child);
  };
  index(result);
  const decode = (arg: unknown): unknown => {
    if (Array.isArray(arg)) return arg.map(decode);
    if (arg && typeof arg === 'object' && OBJ_REF in arg) return byId.get((arg as Record<string, string>)[OBJ_REF]);
    return arg;
  };
  const resolved = calls.map((c) => (naming[c.method] as (...a: unknown[]) => string)(...c.args.map(decode)));
  const fix = (s: string) => s.replace(TOKEN_RE, (_m, i: string) => resolved[Number(i)] ?? '');
  const done = new Set<object>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object' || done.has(v) || ArrayBuffer.isView(v)) return;
    done.add(v);
    const rec = v as Record<string, unknown>;
    for (const [k, child] of Object.entries(rec)) {
      if (typeof child === 'string' && child.includes(TOKEN)) rec[k] = fix(child);
      else walk(child);
    }
  };
  walk(result);
}
