/**
 * @file src/utils/recentProjects.test.ts
 * @description Pruebas de la lista de proyectos recientes: tope de 8, orden, duplicados, datos corruptos y borrado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_PROJECTS,
  RECENT_PROJECTS_KEY,
  addRecentProject,
  clearRecentProjects,
  isRecentRememberEnabled,
  setRecentRememberEnabled,
  loadRecentProjects,
  parseRecentProjects,
} from './recentProjects';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('proyectos recientes', () => {
  it('guarda el más reciente primero y sin duplicados', () => {
    const storage = memoryStorage();
    addRecentProject('a.kura', 1, storage);
    addRecentProject('b.kura', 2, storage);
    const list = addRecentProject('a.kura', 3, storage);
    expect(list.map((item) => item.name)).toEqual(['a.kura', 'b.kura']);
    expect(list[0].openedAt).toBe(3);
  });

  it('conserva solo los últimos 8', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 12; i += 1) addRecentProject(`p${i}.kura`, i, storage);
    const list = loadRecentProjects(storage);
    expect(list).toHaveLength(MAX_RECENT_PROJECTS);
    expect(list[0].name).toBe('p11.kura');
    expect(list.at(-1)?.name).toBe('p4.kura');
  });

  it('solo persiste nombre y fecha', () => {
    const storage = memoryStorage();
    addRecentProject('pieza.kura', 5, storage);
    const stored = JSON.parse(storage.getItem(RECENT_PROJECTS_KEY) ?? '[]') as Array<Record<string, unknown>>;
    expect(Object.keys(stored[0]).sort()).toEqual(['name', 'openedAt']);
  });

  it('ignora datos corruptos o entradas inválidas', () => {
    expect(parseRecentProjects('no es json')).toEqual([]);
    expect(parseRecentProjects('{"a":1}')).toEqual([]);
    expect(parseRecentProjects(JSON.stringify([{ name: 5, openedAt: 1 }, { name: ' ', openedAt: 1 }, null, { name: 'ok', openedAt: 2 }])))
      .toEqual([{ name: 'ok', openedAt: 2 }]);
  });

  it('ignora nombres vacíos al agregar y limpia la lista', () => {
    const storage = memoryStorage();
    expect(addRecentProject('   ', 1, storage)).toEqual([]);
    addRecentProject('x.kura', 1, storage);
    clearRecentProjects(storage);
    expect(loadRecentProjects(storage)).toEqual([]);
  });

  it('no falla si el almacenamiento lanza', () => {
    const broken = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(loadRecentProjects(broken)).toEqual([]);
    expect(addRecentProject('x.kura', 1, broken)).toHaveLength(1);
    expect(() => clearRecentProjects(broken)).not.toThrow();
  });

  it('recordar recientes viene activado; al desactivarlo se borra la lista y no se agrega nada', () => {
    const storage = memoryStorage();
    expect(isRecentRememberEnabled(storage)).toBe(true);
    addRecentProject('a.kura', 1, storage);
    setRecentRememberEnabled(false, storage);
    expect(isRecentRememberEnabled(storage)).toBe(false);
    expect(loadRecentProjects(storage)).toEqual([]);
    expect(addRecentProject('b.kura', 2, storage)).toEqual([]);
    setRecentRememberEnabled(true, storage);
    expect(addRecentProject('b.kura', 3, storage)).toHaveLength(1);
  });
});
