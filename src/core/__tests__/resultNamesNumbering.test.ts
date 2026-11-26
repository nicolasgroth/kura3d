/**
 * @file src/core/__tests__/resultNamesNumbering.test.ts
 * @description Nombres de objetos nuevos: número = menor libre para ese tipo en la escena vigente
 * (no un contador global) y mitades de corte con sufijo propio, separado con « · » como en Dividir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { resetStore, store } from '../../store/__tests__/storeTestUtils';
import { fakeBox } from '../../test/fakeObjects';
import { createKeyedNaming, nextNumberedName } from '../scene/resultNames';

const naming = createKeyedNaming((key, params) => t('es', key, params), { color: (h) => h, structure: (_r, id) => id });

describe('numeración de nombres', () => {
  it('usa el menor número libre de esa etiqueta', () => {
    expect(nextNumberedName('Caja', [])).toBe('Caja 1');
    expect(nextNumberedName('Caja', ['Caja 1', 'Caja 3', 'Cilindro 2'])).toBe('Caja 2');
    expect(nextNumberedName('Caja', ['Caja 1', 'Caja 2'])).toBe('Caja 3');
    // Otros nombres que empiezan igual no ocupan número.
    expect(nextNumberedName('Caja', ['Caja 1 · mitad A (X−)', 'Caja grande 1'])).toBe('Caja 1');
  });

  describe('en el store', () => {
    beforeEach(() => resetStore('es'));

    it('con una sola caja en la escena, la nueva no hereda el número de objetos anteriores', async () => {
      for (let i = 0; i < 4; i += 1) await store().createPrimitive('cylinder', { radius: 5, height: 5 }, { placement: 'free' });
      const box = await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' });
      expect(box!.name).toBe('Cubo 1');
      store().deleteObjects([box!.id]);
      const again = await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' });
      expect(again!.name).toBe('Cubo 1');
      const second = await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' });
      expect(second!.name).toBe('Cubo 2');
    });
  });
});

describe('nombres de mitades de corte', () => {
  it('las dos mitades se distinguen y usan el separador « · » de Dividir', () => {
    const src = fakeBox('a', 'Caja 1');
    const a = naming.cutHalf(src, 'a', 'X');
    const b = naming.cutHalf(src, 'b', 'X');
    expect(a).not.toBe(b);
    expect(a).toBe('Caja 1 · mitad A (X−)');
    expect(b).toBe('Caja 1 · mitad B (X+)');
  });
});
