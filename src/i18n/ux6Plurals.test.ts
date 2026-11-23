/**
 * @file src/i18n/ux6Plurals.test.ts
 * @description Concordancia de número en los avisos de reparación, importación y recuperación (claves
 * `realesUi.*`, `realesMotor.*`, `engineWarning.REPAIR_*`, `import.openMeshMany`): cada texto se recorre
 * con count 1 y 2 en los 6 idiomas; en es, en, de y fr el singular y el plural difieren, y no quedan marcas
 * de plural sin resolver. Casos concretos en español e inglés.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t, type TranslationKey } from './index';
import type { LanguageCode } from '../types/kura';

const LANGS: LanguageCode[] = ['es', 'en', 'de', 'fr', 'hi', 'zh'];

/** Clave → parámetro que manda el número (los demás se fijan en 3). */
const CASES: Array<[TranslationKey, string]> = [
  ['engineWarning.REPAIR_LARGE_HOLES_FILLED', 'count'],
  ['engineWarning.REPAIR_HOLES_LEFT', 'count'],
  ['engineWarning.MESH_WELDED_IMPLICITLY', 'edges'],
  ['repair.diag.open', 'edges'],
  ['engineError.MESH_REPAIR_FAILED', 'holes'],
  ['realesMotor.sceneRestored', 'count'],
  ['realesMotor.openMeshShared', 'edges'],
  ['realesMotor.repairAllDone', 'pieces'],
  ['realesMotor.repairAllPartial', 'pieces'],
  ['realesUi.mesh.openOther', 'count'],
  ['realesUi.import.parts', 'total'],
  ['realesUi.recovery.reminder', 'count'],
  ['realesUi.split.glueSummary', 'count'],
  ['import.openMeshMany', 'count'],
];

const params = (driver: string, n: number) => ({
  count: 3, edges: 3, holes: 3, boundary: 3, nonManifold: 3, pieces: 3, closed: 3, total: 3, done: 1, groups: 3,
  sizeMm: 30, tol: 0.01, name: 'pieza.stl', list: 'a, b', [driver]: n,
});

describe('plurales de los avisos de reparación e importación', () => {
  it.each(CASES)('%s concuerda con 1 y 2 en los 6 idiomas', (key, driver) => {
    for (const lang of LANGS) {
      const one = t(lang, key, params(driver, 1));
      const two = t(lang, key, params(driver, 2));
      expect(one, `${lang} ${key}`).not.toMatch(/\{\w+(\?[^}]*)?\}/);
      expect(two, `${lang} ${key}`).not.toMatch(/\{\w+(\?[^}]*)?\}/);
      if (['es', 'en', 'de', 'fr'].includes(lang)) expect(one, `${lang} ${key}`).not.toBe(two.replace(/\b2\b/g, '1'));
    }
  });

  it('textos concretos en singular', () => {
    expect(t('es', 'engineWarning.REPAIR_LARGE_HOLES_FILLED', { count: 1, sizeMm: 30 })).toBe(
      'Se cerró 1 agujero grande (de 30 mm) con una tapa: revisa que la forma sea la esperada.',
    );
    expect(t('es', 'engineWarning.REPAIR_LARGE_HOLES_FILLED', { count: 2, sizeMm: 30 })).toBe(
      'Se cerraron 2 agujeros grandes (el mayor de 30 mm) con una tapa: revisa que la forma sea la esperada.',
    );
    expect(t('en', 'engineWarning.REPAIR_LARGE_HOLES_FILLED', { count: 1, sizeMm: 30 })).toBe(
      '1 large hole (30 mm) was closed with a cap: check the shape is what you expect.',
    );
    expect(t('es', 'engineWarning.REPAIR_HOLES_LEFT', { count: 1, sizeMm: 4 })).toBe('Quedó 1 agujero sin cerrar (de 4 mm): revisa el modelo.');
    expect(t('es', 'realesMotor.repairAllDone', { closed: 1, total: 1, pieces: 1 })).toBe('Mallas reparadas y cerradas: 1 de 1 (1 pieza).');
    expect(t('es', 'realesUi.import.parts', { done: 1, total: 1 })).toBe('1 de 1 pieza');
    expect(t('es', 'realesUi.mesh.openOther', { count: 1 })).toBe('Abierta: 1 borde libre');
    expect(t('es', 'import.openMeshMany', { count: 4, list: 'a' })).toBe('4 piezas tienen la malla abierta (a): revísalas antes de imprimir.');
    expect(t('es', 'realesMotor.openMeshShared', { name: 'x', count: 2, edges: 1 })).toBe('La malla «x», usada en 2 piezas, está abierta (1 borde suelto).');
    expect(t('fr', 'realesUi.split.glueSummary', { count: 1, total: 3 })).toMatch(/^1 sur 3 jonctions est à coller/);
  });
});
