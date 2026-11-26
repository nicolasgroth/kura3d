/**
 * @file src/__tests__/repoRules.test.ts
 * @description Hace cumplir reglas del repositorio: versión única de la marca, cabecera de autoría
 * en todo archivo de código, uso del envoltorio de preferencias en lugar de `localStorage` directo,
 * lista explícita de claves de almacenamiento (no sensibles) en `src/ai` y `src/utils`, y marca de
 * los exportadores recibida por parámetro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';

// El tope por defecto (5 s) no alcanza con la máquina cargada (esta prueba recorre el repo o usa el motor).
vi.setConfig({ testTimeout: 60_000 });
import { BRAND } from '../brand';

// El frontend no incluye @types/node: se tipa solo lo que usa esta prueba.
interface NodeFs {
  readdirSync: (dir: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
}
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const { readdirSync, readFileSync, statSync } = nodeFs;

const ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const join = (...p: string[]) => p.join('/');
const relative = (from: string, to: string) => to.slice(from.length + 1);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '.git',
  '.claude',
  '.eval-tmp',
  '.playwright-mcp',
  'test-results',
  'playwright-report',
]);

function walk(dir: string, exts: readonly string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const rel = (p: string) => relative(ROOT, p).replaceAll('\\', '/');
const isTestFile = (f: string) => /\.test\.tsx?$/.test(f) || f.includes('__tests__');
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('reglas del repositorio', () => {
  it('BRAND.version coincide con package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    expect(BRAND.version).toBe(pkg.version);
  });

  it('todo .ts/.tsx/.rs lleva la cabecera de autoría', () => {
    const files = walk(ROOT, ['.ts', '.tsx', '.rs']);
    expect(files.length).toBeGreaterThan(100);
    const missing = files
      .filter((f) => {
        const head = readFileSync(f, 'utf8').slice(0, 5000);
        if (f.endsWith('.rs')) return !/Autor:\s*Nicolás Groth/.test(head);
        return !(
          head.includes('@file') &&
          head.includes('@description') &&
          /@author Nicolás Groth <ngroth@gmail\.com>/.test(head) &&
          head.includes('@organization ISGROTH') &&
          head.includes('@license MIT')
        );
      })
      .map(rel);
    expect(missing).toEqual([]);
  });

  it('los lectores y escritores de formatos no importan la marca ni la escriben literal (la reciben por parámetro)', () => {
    const files = walk(join(ROOT, 'src', 'engine', 'io'), ['.ts']).filter((f) => !isTestFile(f));
    expect(files.length).toBeGreaterThan(10);
    const offenders = files
      .filter((f) => {
        const code = stripComments(readFileSync(f, 'utf8'));
        return /from ['"][./]*brand['"]/.test(code) || new RegExp(BRAND.name, 'i').test(code);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('src/ai y src/utils solo usan claves de almacenamiento de la lista explícita', () => {
    // localStorage: preferencias y listas no sensibles. sessionStorage: los únicos sitios de secretos en web.
    const LOCAL_KEYS = new Set([
      'kura3d-ai-allowed-hosts', // hosts de IA permitidos (nombres de host)
      'kura3d-mcp-config', // configuración MCP sin token (se lee solo para migrar el token antiguo)
      'kura3d-mcp-repo-path', // ruta del repositorio para el fragmento de configuración MCP
      'kura3d-recent-projects', // nombre de archivo y fecha
      'kura3d-recent-info', // descripción corta y fecha de modificación de recientes (nunca las notas)
      'kura3d-recent-remember', // preferencia «recordar recientes»
    ]);
    const SESSION_KEYS = new Set(['kura3d-ai-session-keys', 'kura3d-mcp-session-token']);
    // Archivos que pueden tocar localStorage directamente (el resto pasa por los almacenes de arriba).
    const DIRECT_LOCAL = new Set(['src/ai/allowedHosts.ts', 'src/ai/apiKeyStore.ts', 'src/utils/recentProjects.ts', 'src/utils/recentProjectInfo.ts']);
    const files = [
      ...walk(join(ROOT, 'src', 'ai'), ['.ts', '.tsx']),
      ...walk(join(ROOT, 'src', 'utils'), ['.ts', '.tsx']),
    ].filter((f) => !isTestFile(f));
    const unknownKeys: string[] = [];
    const directUse: string[] = [];
    const seen = new Set<string>();
    for (const f of files) {
      const code = stripComments(readFileSync(f, 'utf8'));
      for (const m of code.matchAll(/['"`](kura3d-[a-z0-9-]+)['"`]/g)) {
        seen.add(m[1]);
        if (!LOCAL_KEYS.has(m[1]) && !SESSION_KEYS.has(m[1])) unknownKeys.push(`${rel(f)}: ${m[1]}`);
      }
      if (/\blocalStorage\b/.test(code) && !DIRECT_LOCAL.has(rel(f))) directUse.push(rel(f));
    }
    expect(seen.size, 'la búsqueda de claves debe encontrar las conocidas').toBeGreaterThanOrEqual(6);
    expect(unknownKeys, 'clave nueva: agrégala a la lista si no es secreta').toEqual([]);
    expect(directUse).toEqual([]);
    // Las claves de sesión (secretos) nunca se usan con localStorage
    const misuse = files.filter((f) => {
      const code = stripComments(readFileSync(f, 'utf8'));
      return /localStorage[\s\S]{0,80}(SESSION_KEYS_STORAGE|MCP_SESSION_TOKEN_KEY)/.test(code);
    });
    expect(misuse.map(rel)).toEqual([]);
  });

  it('componentes y store no usan localStorage/sessionStorage directamente', () => {
    const files = [
      ...walk(join(ROOT, 'src', 'components'), ['.ts', '.tsx']),
      ...walk(join(ROOT, 'src', 'store'), ['.ts', '.tsx']),
    ].filter((f) => !isTestFile(f) && !f.endsWith('preferencesStorage.ts'));
    const offenders = files
      .filter((f) => /\b(localStorage|sessionStorage)\b/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
