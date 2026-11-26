/// <reference types="vite/client" />
/**
 * @file src/__tests__/dependencyRules.test.ts
 * @description Hace cumplir la regla de dependencias de `docs/ARCHITECTURE.md`: `src/core` y
 * `src/engine` no importan del store, de los componentes ni de React/Zustand; `src/core` tampoco
 * importa utilidades de interfaz; `src/core/commands` es un contrato puro; y nada en `src`
 * importa del servidor MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';

/** Fuentes de `src` (sin pruebas), con clave relativa a este archivo: `../core/scene/x.ts`. */
const SOURCES = import.meta.glob(
  ['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx', '!../**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Normaliza una ruta POSIX con `.` y `..` (relativa a `src`). */
function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else out.push(part);
  }
  return out.join('/');
}

/** Archivo relativo a `src` (`core/scene/x.ts`). */
const fromSrc = (key: string) => key.replace(/^\.\.\//, '');

/** Especificadores de import/export (estáticos y dinámicos). */
function importsOf(text: string): string[] {
  const specs = [...text.matchAll(/(?:import|export)\s[^'"`;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const bare = [...text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const dynamic = [...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  return [...specs, ...bare, ...dynamic];
}

/** Destino relativo a `src` (o nombre del paquete). */
function target(file: string, spec: string): string {
  if (!spec.startsWith('.')) return spec;
  const dir = file.split('/').slice(0, -1).join('/');
  return normalize(`${dir}/${spec}`);
}

function violations(layer: string, forbidden: (t: string) => boolean): string[] {
  return Object.entries(SOURCES)
    .map(([key, text]) => [fromSrc(key), text] as const)
    .filter(([file]) => file.startsWith(`${layer}/`))
    .flatMap(([file, text]) => importsOf(text)
      .map((spec) => target(file, spec))
      .filter(forbidden)
      .map((t) => `${file} -> ${t}`));
}

const UI_LAYERS = (t: string) =>
  t.startsWith('store') || t.startsWith('components') || t === 'App' || t === 'main' ||
  t === 'react' || t.startsWith('react-') || t.startsWith('react/') || t.startsWith('@react-three') ||
  t === 'zustand' || t.startsWith('zustand/');

describe('Regla de dependencias', () => {
  it('encuentra las fuentes de cada capa', () => {
    const files = Object.keys(SOURCES).map(fromSrc);
    for (const layer of ['core/scene', 'core/operations', 'core/commands', 'engine', 'store']) {
      expect(files.some((f) => f.startsWith(`${layer}/`))).toBe(true);
    }
  });

  it('src/core no importa store, componentes, React, Zustand ni utilidades de interfaz', () => {
    expect(violations('core', (t) => UI_LAYERS(t) || t.startsWith('utils') || t.startsWith('ai/'))).toEqual([]);
  });

  it('src/engine no importa store, componentes, React ni Zustand', () => {
    expect(violations('engine', UI_LAYERS)).toEqual([]);
  });

  it('src/core/commands no depende del motor ni de la escena (contrato puro)', () => {
    expect(violations('core/commands', (t) => !t.startsWith('core/commands'))).toEqual([]);
  });

  it('nada en src importa del servidor MCP', () => {
    const all = Object.keys(SOURCES)
      .map(fromSrc)
      .map((f) => f.split('/')[0])
      .filter((layer, i, arr) => arr.indexOf(layer) === i && !layer.includes('.'))
      .flatMap((layer) => violations(layer, (t) => t.includes('mcp-server')));
    expect(all).toEqual([]);
  });
});
