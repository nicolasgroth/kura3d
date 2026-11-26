/**
 * @file src/ai/allowedHosts.ts
 * @description Lista de hosts a los que el chat IA puede enviar solicitudes. En escritorio vive en Rust
 * (`ai_allowed_hosts_get/set`, que confirma los hosts nuevos en un diálogo nativo); en web, en
 * `localStorage` (no es secreta). Mantiene una copia en memoria para validar antes de enviar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isTauriRuntime } from '../utils/platformBridge';
import { DEFAULT_ALLOWED_HOSTS, MAX_ALLOWED_HOSTS, normalizeHost } from './providerSecurity';

export const ALLOWED_HOSTS_STORAGE = 'kura3d-ai-allowed-hosts';

type Invoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;

let cached: string[] = [...DEFAULT_ALLOWED_HOSTS];

/** Normaliza y deduplica; devuelve las entradas inválidas aparte para informarlas. */
export function parseHostList(entries: readonly string[]): { hosts: string[]; invalid: string[] } {
  const hosts: string[] = [];
  const invalid: string[] = [];
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const host = normalizeHost(entry);
    if (!host) invalid.push(entry.trim());
    else if (!hosts.includes(host)) hosts.push(host);
  }
  return { hosts: hosts.slice(0, MAX_ALLOWED_HOSTS), invalid };
}

function readLocal(): string[] | null {
  try {
    const raw = localStorage.getItem(ALLOWED_HOSTS_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parseHostList(parsed.filter((h): h is string => typeof h === 'string')).hosts : null;
  } catch {
    return null;
  }
}

async function nativeInvoke(): Promise<Invoke> {
  return (await import('@tauri-apps/api/core')).invoke as Invoke;
}

/** Copia en memoria (síncrona) usada por el cliente IA. */
export function getAllowedHostsSync(): readonly string[] {
  return cached;
}

/** Carga la lista persistida. */
export async function loadAllowedHosts(invoke?: Invoke): Promise<string[]> {
  if (isTauriRuntime() || invoke) {
    const run = invoke ?? (await nativeInvoke());
    cached = await run<string[]>('ai_allowed_hosts_get', {});
  } else {
    cached = readLocal() ?? [...DEFAULT_ALLOWED_HOSTS];
  }
  return [...cached];
}

/** Guarda la lista. En escritorio, Rust pide confirmación nativa si se agregan hosts. */
export async function saveAllowedHosts(hosts: readonly string[], invoke?: Invoke): Promise<string[]> {
  const { hosts: clean } = parseHostList(hosts);
  if (isTauriRuntime() || invoke) {
    const run = invoke ?? (await nativeInvoke());
    cached = await run<string[]>('ai_allowed_hosts_set', { hosts: clean });
  } else {
    cached = clean;
    try {
      localStorage.setItem(ALLOWED_HOSTS_STORAGE, JSON.stringify(clean));
    } catch {
      // Almacenamiento bloqueado: la lista vale solo para esta pestaña.
    }
  }
  return [...cached];
}

// En web la lista se lee al importar el módulo; en escritorio la carga `loadAllowedHosts` al iniciar.
if (!isTauriRuntime()) cached = readLocal() ?? cached;
