/// <reference types="vite/client" />
/**
 * @file src/store/__tests__/storeComposition.test.ts
 * @description Comprueba que la composición de slices expone todos los campos y acciones que
 * declara `KuraStoreState` (la composición usa un cast, así que un slice olvidado no lo detecta tsc).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import storeTypesSource from '../storeTypes.ts?raw';
import { useKuraStore } from '../useKuraStore';

function declaredKeys(): string[] {
  const source = storeTypesSource;
  const start = source.indexOf('export interface KuraStoreState {');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  // Miembros de primer nivel: dos espacios de sangría y `nombre:` o `nombre?:`.
  return [...body.matchAll(/^ {2}([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]);
}

describe('Composición del store', () => {
  it('cada miembro de KuraStoreState existe en el estado inicial', () => {
    const keys = declaredKeys();
    expect(keys.length).toBeGreaterThan(100);
    const state = useKuraStore.getState() as unknown as Record<string, unknown>;
    // `projectLocation` es opcional y arranca sin valor.
    const missing = keys.filter((k) => !(k in state) && k !== 'projectLocation');
    expect(missing).toEqual([]);
  });
});
