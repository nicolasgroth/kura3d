/**
 * @file src/ai/providerSecurity.ts
 * @description Reglas de red y de secretos para los proveedores IA: qué URL base se acepta (alineado con
 * la CSP `connect-src` de `src-tauri/tauri.conf.json`) y cómo borrar claves de cualquier texto antes de
 * mostrarlo o registrarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Hosts remotos que la CSP de escritorio permite. Mantener sincronizado con `connect-src`. */
export const DESKTOP_PROVIDER_HOSTS = [
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.anthropic.com',
] as const;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * Indica si una URL base de proveedor está permitida.
 * - Siempre: `http://` solo hacia loopback (Ollama, LM Studio, proxies locales) o `https://`.
 * - Nunca: usuario/contraseña embebidos en la URL.
 * - Escritorio: los `https://` se limitan a los hosts oficiales que admite la CSP.
 */
export function isAllowedProviderUrl(value: string, desktop: boolean): boolean {
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
  return !desktop || (DESKTOP_PROVIDER_HOSTS as readonly string[]).includes(host);
}

// Formatos habituales de claves y parámetros de autenticación que algunos proveedores repiten en errores.
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /([?&](?:key|api_key|apikey|token)=)[^&\s"']+/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
];

/** Sustituye la clave dada y patrones de credenciales conocidos por `[redacted]`. */
export function redactSecrets(text: string, secret?: string): string {
  let result = text;
  const trimmed = secret?.trim();
  if (trimmed && trimmed.length >= 4) result = result.split(trimmed).join('[redacted]');
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match, prefix?: string) =>
      typeof prefix === 'string' && match.startsWith(prefix) ? `${prefix}[redacted]` : '[redacted]');
  }
  return result;
}
