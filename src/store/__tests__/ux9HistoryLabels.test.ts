/**
 * @file src/store/__tests__/ux9HistoryLabels.test.ts
 * @description Lote ux9: cada paso del historial dice su acción real (agrupar, desagrupar, renombrar, ocultar,
 * mostrar, bloquear, desbloquear, parámetro de primitiva, color, mover, rotar y escalar), en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, type SceneObject } from '../../types/kura';
import { fakeBox } from '../../test/fakeObjects';
import { describeChange } from '../historyLabels';

const baseA: SceneObject = { ...fakeBox('a', 'Cubo 1'), primitiveParams: { width: 10, height: 10, depth: 10 } };
const baseB: SceneObject = fakeBox('b', 'Cubo 2');
const a = (): SceneObject => ({ ...baseA });
const b = (): SceneObject => ({ ...baseB });
const label = (before: SceneObject[], after: SceneObject[], groups = false, lang: 'es' | 'en' = 'es') => describeChange(lang, before, after, groups);

describe('historial: cada paso dice su acción', () => {
  it('agrupar y desagrupar', () => {
    expect(label([a(), b()], [{ ...a(), groupRef: 'g' }, { ...b(), groupRef: 'g' }], true)).toBe('Agrupar 2 objetos');
    expect(label([{ ...a(), groupRef: 'g' }, { ...b(), groupRef: 'g' }], [a(), b()], true)).toBe('Desagrupar 2 objetos');
  });

  it('renombrar', () => {
    expect(label([a()], [{ ...a(), name: 'Tapa' }])).toBe('Renombrar a "Tapa"');
  });

  it('ocultar y mostrar', () => {
    expect(label([a()], [{ ...a(), visible: false }])).toBe('Ocultar "Cubo 1"');
    expect(label([{ ...a(), visible: false }], [a()])).toBe('Mostrar "Cubo 1"');
  });

  it('bloquear y desbloquear', () => {
    expect(label([a()], [{ ...a(), locked: true }])).toBe('Bloquear "Cubo 1"');
    expect(label([{ ...a(), locked: true }], [a()])).toBe('Desbloquear "Cubo 1"');
  });

  it('cambiar un parámetro de primitiva dice cuál', () => {
    const after = { ...a(), primitiveParams: { width: 25, height: 10, depth: 10 }, mesh: { ...baseA.mesh } };
    expect(label([a()], [after])).toBe('Cambiar ancho de Cubo 1');
    expect(label([a()], [after], false, 'en')).toBe('Change width of Cubo 1');
  });

  it('cambiar color', () => {
    expect(label([a()], [{ ...a(), color: '#ff0000' }])).toBe('Cambiar color de "Cubo 1"');
  });

  it('mover, rotar y escalar', () => {
    expect(label([a()], [{ ...a(), position: [5, 0, 0] }])).toBe('Mover Cubo 1');
    expect(label([a()], [{ ...a(), rotation: [0, 1, 0] }])).toBe('Rotar Cubo 1');
    expect(label([a()], [{ ...a(), scale: [2, 2, 2] }])).toBe('Escalar Cubo 1');
  });

  it('ya no dice «Cambiar N objetos» ni «Editar malla» para esas acciones', () => {
    const texts = [
      label([a(), b()], [{ ...a(), groupRef: 'g' }, { ...b(), groupRef: 'g' }], true),
      label([a()], [{ ...a(), primitiveParams: { width: 25, height: 10, depth: 10 }, mesh: { ...baseA.mesh } }]),
    ];
    for (const text of texts) expect(text).not.toMatch(/Cambiar \d+ objetos|Editar malla/);
  });

  it('todas las acciones tienen texto en los 6 idiomas', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const out = [
        describeChange(code, [a()], [{ ...a(), name: 'X' }], false),
        describeChange(code, [a()], [{ ...a(), visible: false }], false),
        describeChange(code, [a()], [{ ...a(), locked: true }], false),
        describeChange(code, [a(), b()], [{ ...a(), groupRef: 'g' }, { ...b(), groupRef: 'g' }], true),
        describeChange(code, [a()], [{ ...a(), primitiveParams: { width: 25, height: 10, depth: 10 } }], false),
      ];
      for (const text of out) expect(text, code).not.toMatch(/ux9\.|\{/);
    }
  });
});
