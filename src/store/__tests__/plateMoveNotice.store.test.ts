/**
 * @file src/store/__tests__/plateMoveNotice.store.test.ts
 * @description El aviso único de «pasó a «Placa»»: texto con plural, «Deshacer» que se retira al dejar de aplicar,
 * el mismo aviso por la paleta/menú (`runMoveToPlate`) y la cuenta por placa destino tras un arrastre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { runMoveToPlate } from '../../components/shell/actionRunners';
import { announcePiecesMoved, platesReached } from '../plateMoveNotice';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('aviso al pasar piezas a otra placa', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('por menú o paleta sale un solo aviso con «Deshacer» y plural correcto', async () => {
    const a = await addBox(20, [0, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    store().dismissAllToasts();
    store().selectObject(a.id);
    runMoveToPlate(p2.id);
    const toasts = store().toasts.filter((x) => x.text.includes('pasó'));
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toBe(`1 pieza pasó a «${p2.name}».`);
    expect(toasts[0].action?.applicable?.()).toBe(true);
    // «Deshacer» devuelve la pieza y, ya aplicado, deja de aplicar.
    store().runToastAction(toasts[0].id, toasts[0].action!);
    expect(byId(a.id)!.plateRef).not.toBe(p2.id);
    expect(toasts[0].action?.applicable?.()).toBe(false);
  });

  it('plural: varias piezas', () => {
    useKuraStore.setState({ plates: [{ id: 'p', name: 'Bases', origin: [0, 0] }], activePlateId: 'p' });
    announcePiecesMoved(3, 'p');
    expect(store().toasts.at(-1)?.text).toBe('3 piezas pasaron a «Bases».');
  });

  it('platesReached cuenta solo las piezas que cambiaron de placa, por destino', () => {
    const start = new Map<string, string | undefined>([['a', 'p1'], ['b', 'p1'], ['c', undefined]]);
    const now = [{ id: 'a', plateRef: 'p2' }, { id: 'b', plateRef: 'p1' }, { id: 'c', plateRef: 'p2' }, { id: 'x', plateRef: 'p3' }];
    expect(platesReached(start, now)).toEqual([{ plateId: 'p2', count: 2 }]);
  });
});
