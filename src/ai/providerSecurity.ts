/**
 * @file src/ai/providerSecurity.ts
 * @description Reglas de red y de secretos para los proveedores IA. Una URL de proveedor se acepta si es
 * `https://` hacia un host de la lista permitida del usuario (por defecto los oficiales) o hacia loopback,
 * o `http://` solo hacia loopback. Es la misma regla que aplica el proxy nativo en
 * `src-tauri/src/ai_hosts.rs`, que en escritorio es quien decide. Reexporta `redactSecrets`
 * (`secretRedaction.ts`), que borra claves de cualquier texto antes de mostrarlo o registrarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Hosts oficiales permitidos por defecto. Mantener igual que `DEFAULT_HOSTS` en `ai_hosts.rs`. */
export const DEFAULT_ALLOWED_HOSTS: readonly string[] = [
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'dashscope-intl.aliyuncs.com',
  'dashscope.aliyuncs.com',
  'dashscope-us.aliyuncs.com',
  '*.maas.aliyuncs.com',
  'openrouter.ai',
];

export const MAX_ALLOWED_HOSTS = 64;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Normaliza una entrada de la lista (`api.example.com` o `*.example.com`); `null` si no es válida. */
export function normalizeHost(raw: string): string | null {
  const host = raw.trim().replace(/\.$/, '').toLowerCase();
  const wildcard = host.startsWith('*.');
  const name = wildcard ? host.slice(2) : host;
  const labels = name.split('.');
  if (!name || host.length > 253 || labels.length < (wildcard ? 2 : 1)) return null;
  return labels.every((label) => LABEL.test(label)) ? host : null;
}

function hostMatches(pattern: string, host: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return host.length > suffix.length && host.endsWith(suffix);
  }
  return pattern === host;
}

/** Indica si `value` es loopback admitido (`127.0.0.1` o `localhost`). */
export function isLoopbackUrl(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Indica si una URL de proveedor está permitida por la lista `allowedHosts`.
 * Nunca: usuario/contraseña embebidos, esquemas distintos de http/https, http remoto.
 */
export function isAllowedProviderUrl(value: string, allowedHosts: readonly string[] = DEFAULT_ALLOWED_HOSTS): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'http:') return LOOPBACK_HOSTS.has(host);
  if (url.protocol !== 'https:') return false;
  if (LOOPBACK_HOSTS.has(host)) return true;
  return allowedHosts.some((pattern) => hostMatches(pattern, host));
}

// El borrado de claves vive en `secretRedaction.ts`; se reexporta para los consumidores existentes.
export { redactSecrets } from './secretRedaction';
