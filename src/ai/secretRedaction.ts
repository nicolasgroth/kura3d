/**
 * @file src/ai/secretRedaction.ts
 * @description Borrado de credenciales en textos de error y registros de proveedores IA. Dos capas:
 * (1) la clave conocida y cualquier fragmento suyo de 16+ caracteres (truncada, enmascarada, en otra
 * capitalización, partida por espacios o caracteres invisibles), buscados en tiempo lineal con un hash
 * rodante sobre el texto compactado; (2) formatos de credenciales de proveedores habituales sin clave
 * conocida (OpenAI, Anthropic, Gemini, Groq, xAI, Hugging Face, Perplexity, GitHub, AWS, cabeceras,
 * campos JSON y parámetros de URL). Ninguna expresión tiene cuantificadores anidados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

const REDACTED = '[redacted]';
/** Largo del fragmento de la clave que basta para considerarla filtrada. */
const WINDOW = 16;
/** Con menos caracteres no se buscan coincidencias partidas por espacios (evita tapar texto legítimo). */
const MIN_SPLIT_LENGTH = 8;
/** Espacios y caracteres invisibles que un proveedor o un log pueden intercalar en la clave. */
const IGNORABLE = /[\s­​-‍⁠﻿]/;

/** Patrones de credenciales conocidas. Si hay grupo 1, se conserva (nombre del campo o cabecera). */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/gi,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /\bgsk_[A-Za-z0-9]{16,}/g,
  /\bxai-[A-Za-z0-9_-]{16,}/g,
  /\bhf_[A-Za-z0-9]{16,}/g,
  /\bpplx-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /("(?:api[_-]?key|access[_-]?token|secret|token|password|authorization)"\s*:\s*")[^"]+/gi,
  /((?:x-api-key|x-goog-api-key|api-key|authorization)\s*:\s*(?:(?:Bearer|Basic|Token)\s+)?)[^\s,;"'&]{8,}/gi,
  /([?&](?:key|api[_-]?key|token|access[_-]?token|auth|secret)=)[^&\s"']+/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Indica si la unidad UTF-16 `c` es un espacio o carácter invisible ignorable. */
function isIgnorable(c: number): boolean {
  if (c === 0x20 || (c >= 0x09 && c <= 0x0d)) return true;
  if (c < 0x80) return false;
  return IGNORABLE.test(String.fromCharCode(c));
}

/** Unidad UTF-16 en minúsculas (solo cambia ASCII y las que se mantienen en una unidad). */
function lowerCode(c: number): number {
  if (c >= 0x41 && c <= 0x5a) return c + 32;
  if (c < 0x80) return c;
  const low = String.fromCharCode(c).toLowerCase();
  return low.length === 1 ? low.charCodeAt(0) : c;
}

/** Códigos del texto sin caracteres ignorables, en minúsculas, con el índice original de cada uno. */
function compactCodes(text: string): { codes: Uint16Array; origin: Int32Array; length: number } {
  const codes = new Uint16Array(text.length);
  const origin = new Int32Array(text.length);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (isIgnorable(c)) continue;
    codes[n] = lowerCode(c);
    origin[n] = i;
    n++;
  }
  return { codes, origin, length: n };
}

const BASE = 0x01000193;

/** Hash polinomial (módulo 2^32) de `codes[from, from + len)`. */
function hashOf(codes: Uint16Array, from: number, len: number): number {
  let h = 0;
  for (let i = from; i < from + len; i++) h = (Math.imul(h, BASE) + codes[i]) >>> 0;
  return h;
}

/** Contador opcional de trabajo (caracteres comparados en verificaciones), para probar la linealidad sin reloj. */
export interface ScanWork {
  compared: number;
}

function sameRun(a: Uint16Array, ai: number, b: Uint16Array, bi: number, len: number, work?: ScanWork): boolean {
  if (work) work.compared += len;
  for (let k = 0; k < len; k++) if (a[ai + k] !== b[bi + k]) return false;
  return true;
}

/**
 * Rangos `[inicio, fin)` del texto original que contienen la clave o un fragmento suyo de `WINDOW`
 * caracteres. Hash rodante sobre el texto compactado: O(n + m), sin importar si la clave repite letras.
 */
export function knownSecretRanges(text: string, secret: string, work?: ScanWork): Array<[number, number]> {
  const key = compactCodes(secret);
  if (key.length < MIN_SPLIT_LENGTH) return exactRanges(text, secret);
  const hay = compactCodes(text);
  const w = Math.min(WINDOW, key.length);
  if (hay.length < w) return [];

  // Hash de cada ventana de la clave → posiciones donde empieza (para verificar sin falsos positivos).
  const windows = new Map<number, number[]>();
  for (let i = 0; i + w <= key.length; i++) {
    const h = hashOf(key.codes, i, w);
    const list = windows.get(h);
    if (!list) windows.set(h, [i]);
    else if (list.length < 4 && !list.some((j) => sameRun(key.codes, j, key.codes, i, w, work))) list.push(i);
  }

  let pow = 1;
  for (let i = 1; i < w; i++) pow = Math.imul(pow, BASE) >>> 0;
  const ranges: Array<[number, number]> = [];
  const codes = hay.codes;
  let h = hashOf(codes, 0, w);
  for (let i = 0; i + w <= hay.length; i++) {
    if (i > 0) {
      const out = Math.imul(codes[i - 1], pow) >>> 0;
      h = (Math.imul((h - out) >>> 0, BASE) + codes[i + w - 1]) >>> 0;
    }
    const candidates = windows.get(h);
    if (!candidates || !candidates.some((j) => sameRun(key.codes, j, codes, i, w, work))) continue;
    const start = hay.origin[i];
    const end = hay.origin[i + w - 1] + 1;
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  return ranges;
}

/** Coincidencias exactas (sin distinguir mayúsculas) de una clave corta. */
function exactRanges(text: string, secret: string): Array<[number, number]> {
  const hay = text.toLowerCase();
  const needle = secret.toLowerCase();
  if (hay.length !== text.length || !needle) return [];
  const ranges: Array<[number, number]> = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    ranges.push([at, at + needle.length]);
  }
  return ranges;
}

function replaceRanges(text: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return text;
  let out = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += text.slice(cursor, start) + REDACTED;
    cursor = end;
  }
  return out + text.slice(cursor);
}

/** Sustituye la clave dada (y sus variantes y fragmentos) y patrones de credenciales conocidos por `[redacted]`. */
export function redactSecrets(text: string, secret?: string): string {
  let result = text;
  const trimmed = secret?.trim();
  if (trimmed && trimmed.length >= 4) {
    // Formas codificadas (URL, JSON): literales, tiempo lineal.
    for (const variant of new Set([encodeURIComponent(trimmed), JSON.stringify(trimmed).slice(1, -1)])) {
      if (variant !== trimmed) result = result.replace(new RegExp(escapeRegExp(variant), 'gi'), REDACTED);
    }
    result = replaceRanges(result, knownSecretRanges(result, trimmed));
  }
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match, prefix?: unknown) =>
      typeof prefix === 'string' && match.startsWith(prefix) ? `${prefix}${REDACTED}` : REDACTED);
  }
  return result;
}
