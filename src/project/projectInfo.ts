/**
 * @file src/project/projectInfo.ts
 * @description Datos del proyecto (`info` del .kura, desde la versión 5): descripción, notas, autor, fechas de
 * creación y de última modificación (ISO 8601 UTC) y tiempo de trabajo. Funciones puras: topes, limpieza de texto
 * (siempre texto plano, nunca HTML), validación estricta para lo que viene de un archivo o del borrador, y
 * normalización (un campo vacío no se guarda). El autor lo escribe la persona: nada se rellena solo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export interface ProjectInfo {
  /** Texto corto de una línea. */
  description?: string;
  /** Texto largo (varias líneas). */
  notes?: string;
  /** Autor opcional, escrito por la persona. */
  author?: string;
  /** Fecha de creación (ISO 8601 UTC). Un proyecto abierto sin fecha queda sin ella: no se inventa. */
  createdAt?: string;
  /** Fecha del último guardado (ISO 8601 UTC). */
  modifiedAt?: string;
  /** Segundos de trabajo acumulados con la app en primer plano y actividad reciente. */
  workSeconds?: number;
}

export const PROJECT_INFO_LIMITS = {
  description: 500,
  notes: 20_000,
  author: 120,
  /** Cien años: un contador mayor no es creíble. */
  maxWorkSeconds: 100 * 365 * 24 * 3600,
  minYear: 2000,
  maxYear: 2100,
} as const;

type TextField = 'description' | 'notes' | 'author';
const TEXT_FIELDS: readonly TextField[] = ['description', 'notes', 'author'];
const FIELDS: readonly string[] = [...TEXT_FIELDS, 'createdAt', 'modifiedAt', 'workSeconds'];

// Controles C0 (salvo tab y salto de línea), DEL, C1, separadores de línea Unicode y marcas bidireccionales que
// pueden falsear lo que se ve (U+202A–202E, U+2066–2069).
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS_GLOBAL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;

/**
 * Limpia un texto que escribe la persona o un agente: sin controles, bidi ni sustitutos sueltos; recorta al tope.
 * No recorta espacios (se llama en cada tecla): eso lo hace `compactInfo` al guardar.
 */
export function cleanInfoText(value: string, field: TextField): string {
  const multiline = field === 'notes';
  let text = value.replace(/\r\n?/g, '\n').replace(UNSAFE_CHARS_GLOBAL, '');
  text = text.replace(new RegExp(LONE_SURROGATE.source, 'g'), '');
  if (!multiline) text = text.replace(/[\n\t]+/g, ' ');
  return text.slice(0, PROJECT_INFO_LIMITS[field]).replace(/[\ud800-\udbff]$/, '');
}

/** Fecha ISO 8601 UTC real (no `2026-02-31`) y dentro de un rango creíble. */
export function isValidInfoDate(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 30) return false;
  const m = ISO_UTC.exec(v);
  if (!m) return false;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return false;
  const year = Number(m[1]);
  if (year < PROJECT_INFO_LIMITS.minYear || year > PROJECT_INFO_LIMITS.maxYear) return false;
  // Ida y vuelta: rechaza días o horas imposibles que algunos intérpretes corrigen en silencio.
  return new Date(ms).toISOString().slice(0, 19) === v.slice(0, 19);
}

export function isCleanInfoText(v: unknown, field: TextField): v is string {
  return typeof v === 'string' && v.length <= PROJECT_INFO_LIMITS[field]
    && !UNSAFE_CHARS.test(v) && !LONE_SURROGATE.test(v)
    && (field === 'notes' || !/[\n\t]/.test(v));
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Validación estricta de `info` tal como viene de un archivo o borrador: solo los campos declarados, tipos exactos,
 * topes de largo, fechas ISO UTC reales y texto sin caracteres de control.
 */
export function validStoredInfo(v: unknown): v is ProjectInfo {
  if (!isPlain(v)) return false;
  if (!Object.keys(v).every((k) => FIELDS.includes(k))) return false;
  for (const field of TEXT_FIELDS) if (v[field] !== undefined && !isCleanInfoText(v[field], field)) return false;
  for (const field of ['createdAt', 'modifiedAt'] as const) if (v[field] !== undefined && !isValidInfoDate(v[field])) return false;
  const work = v.workSeconds;
  return work === undefined || (Number.isSafeInteger(work) && (work as number) >= 0 && (work as number) <= PROJECT_INFO_LIMITS.maxWorkSeconds);
}

/** Copia sin campos vacíos; `undefined` si no queda nada (un proyecto sin datos no guarda `info`). */
export function compactInfo(info: ProjectInfo | undefined): ProjectInfo | undefined {
  if (!info) return undefined;
  const out: ProjectInfo = {};
  for (const field of TEXT_FIELDS) {
    const text = field === 'notes' ? info[field]?.replace(/\s+$/, '') : info[field]?.trim();
    if (text && text.trim()) out[field] = text;
  }
  if (info.createdAt) out.createdAt = info.createdAt;
  if (info.modifiedAt) out.modifiedAt = info.modifiedAt;
  if (info.workSeconds && info.workSeconds > 0) out.workSeconds = Math.floor(info.workSeconds);
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `true` si lo que la persona escribe (o la fecha de creación) es igual; ignora la fecha de guardado y el reloj de trabajo. */
export function sameInfoContent(a: ProjectInfo | undefined, b: ProjectInfo | undefined): boolean {
  if (a === b) return true;
  // Se compara lo que se guardaría: espacios finales y campos vacíos no cuentan como cambio.
  const x = compactInfo(a), y = compactInfo(b);
  return TEXT_FIELDS.every((f) => (x?.[f] ?? '') === (y?.[f] ?? '')) && (x?.createdAt ?? '') === (y?.createdAt ?? '');
}

/** Ahora en ISO 8601 UTC con segundos (sin milisegundos: la fecha no necesita más). */
export function infoNow(now: number = Date.now()): string {
  return new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Lo que se guarda en recientes: solo descripción corta y fecha de modificación, nunca las notas. */
export const RECENT_DESCRIPTION_MAX = 140;
