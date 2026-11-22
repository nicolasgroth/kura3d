/**
 * @file mcp-server/src/config.ts
 * @description Resolución única de la configuración de seguridad del servidor MCP de Kura3D
 * a partir de opciones programáticas, argumentos CLI y variables de entorno (en ese orden de
 * prioridad). Incluye la lectura del token desde archivo y su persistencia atómica al rotarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { readFileSync } from 'node:fs';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** Longitud mínima aceptada para un token configurado por entorno o archivo. */
export const MIN_TOKEN_LENGTH = 16;
/** Formato exigido a un token nuevo recibido por rotación (32–256 caracteres URL-safe). */
export const ROTATION_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,256}$/;
/** Tamaño máximo por defecto de un mensaje WebSocket entrante (64 MiB: cubre STL base64 grandes). */
export const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024 * 1024;
/** Puerto por defecto del puente. */
export const DEFAULT_BRIDGE_PORT = 17432;

/** Configuración de seguridad resuelta del puente y las herramientas. */
export interface ResolvedBridgeConfig {
  port: number;
  /** Token vigente; vacío significa que el puente no se habilita. */
  authToken: string;
  /** Archivo donde se lee y persiste el token (rotación persistente) o `null`. */
  tokenFile: string | null;
  /** Solo lectura impuesto por el operador del servidor (CLI/env/opciones). */
  readOnly: boolean;
  rateLimitPerMin: number;
  maxMessageBytes: number;
  /** Directorio raíz permitido para exportaciones a disco. */
  exportDir: string;
  /** Intentos de autenticación fallidos tolerados por minuto antes de responder 429. */
  authFailureLimitPerMin: number;
}

/** Opciones programáticas (tienen prioridad sobre CLI y entorno). */
export interface BridgeConfigOverrides {
  port?: number;
  authToken?: string;
  tokenFile?: string;
  readOnly?: boolean;
  rateLimitPerMin?: number;
  maxMessageBytes?: number;
  exportDir?: string;
  authFailureLimitPerMin?: number;
}

/** Interpreta booleanos de CLI/entorno: `true/1/yes/on` y `false/0/no/off`. */
/** Intentos fallidos (401) tolerados por minuto antes de responder 429; se mira antes del token. */
export const DEFAULT_AUTH_FAILURE_LIMIT_PER_MIN = 10;

export function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off', ''].includes(v)) return false;
  return undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : undefined;
}

/** Extrae `--flag`, `--flag=valor` o `--flag valor` de los argumentos CLI. */
export function parseCliArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > 2) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[arg.slice(2)] = next;
        i++;
      } else {
        out[arg.slice(2)] = 'true';
      }
    }
  }
  return out;
}

/** Lee un token desde archivo; devuelve cadena vacía si no existe o no es legible. */
export function readTokenFile(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

/** Persiste el token de forma atómica (archivo temporal + rename) con permisos 0600. */
export async function writeTokenFile(path: string, token: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, path);
  try {
    await chmod(path, 0o600);
  } catch {
    // En Windows chmod solo afecta el bit de solo lectura; los permisos dependen de la ACL del perfil.
  }
}

/**
 * Resuelve la configuración efectiva. Prioridad: opciones > CLI (`--read-only`, `--port`,
 * `--token-file`, `--export-dir`, `--rate-limit`, `--max-message-bytes`) > entorno (`KURA_*`).
 * El token se toma de opciones, luego del archivo de token y por último de `KURA_BRIDGE_TOKEN`.
 */
export function resolveBridgeConfig(
  overrides: BridgeConfigOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = []
): ResolvedBridgeConfig {
  const cli = parseCliArgs(argv);

  const tokenFileRaw = overrides.tokenFile ?? cli['token-file'] ?? env.KURA_BRIDGE_TOKEN_FILE;
  const tokenFile = tokenFileRaw && tokenFileRaw.trim() ? resolve(tokenFileRaw.trim()) : null;
  const fileToken = tokenFile ? readTokenFile(tokenFile) : '';
  const authToken = (overrides.authToken ?? (fileToken || env.KURA_BRIDGE_TOKEN) ?? '').trim();

  const readOnly =
    overrides.readOnly ??
    parseBooleanFlag(cli['read-only']) ??
    parseBooleanFlag(env.KURA_BRIDGE_READ_ONLY) ??
    false;

  const exportDirRaw = overrides.exportDir ?? cli['export-dir'] ?? env.KURA_EXPORT_DIR;
  const exportDir = resolve(
    exportDirRaw && exportDirRaw.trim() ? exportDirRaw.trim() : join(homedir(), 'Kura3D', 'exports')
  );

  return {
    port: overrides.port ?? parsePort(cli.port) ?? parsePort(env.KURA_BRIDGE_PORT) ?? DEFAULT_BRIDGE_PORT,
    authToken,
    tokenFile,
    readOnly,
    rateLimitPerMin:
      overrides.rateLimitPerMin ??
      parsePositiveInt(cli['rate-limit']) ??
      parsePositiveInt(env.KURA_BRIDGE_RATE_LIMIT) ??
      120,
    maxMessageBytes:
      overrides.maxMessageBytes ??
      parsePositiveInt(cli['max-message-bytes']) ??
      parsePositiveInt(env.KURA_BRIDGE_MAX_MESSAGE_BYTES) ??
      DEFAULT_MAX_MESSAGE_BYTES,
    exportDir,
    authFailureLimitPerMin: overrides.authFailureLimitPerMin ?? DEFAULT_AUTH_FAILURE_LIMIT_PER_MIN,
  };
}
