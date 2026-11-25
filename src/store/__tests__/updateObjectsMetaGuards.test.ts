/**
 * @file src/store/__tests__/updateObjectsMetaGuards.test.ts
 * @description Guardas de `updateObjectsMeta` (barra flotante): el color no cambia en piezas bloqueadas, bloquear y
 * mostrar/ocultar sí se aplican a ellas, nada cambia durante una operación del motor y sin cambios no hay paso de
 * deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

let free: string;
let locked: string;

beforeEach(async () => {
  await resetStore();
  free = (await addBox(10, [0, 0, 0], { name: 'Libre' })).id;
  locked = (await addBox(10, [30, 0, 0], { name: 'Fija' })).id;
  useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === locked ? { ...o, locked: true, color: '#111111' } : o)) }));
});

describe('updateObjectsMeta: guardas', () => {
  it('el color se aplica a las libres y no a las bloqueadas', () => {
    store().updateObjectsMeta([free, locked], { color: '#ff0000' });
    expect(byId(free)!.color).toBe('#ff0000');
    expect(byId(locked)!.color).toBe('#111111');
  });

  it('bloquear/desbloquear y ocultar sí se aplican a las bloqueadas', () => {
    store().updateObjectsMeta([locked], { visible: false });
    expect(byId(locked)!.visible).toBe(false);
    store().updateObjectsMeta([locked], { locked: false });
    expect(byId(locked)!.locked).toBe(false);
  });

  it('solo piezas bloqueadas y un color: no cambia nada ni guarda paso de deshacer', () => {
    const past = store().past.length;
    const before = store().objects;
    store().updateObjectsMeta([locked], { color: '#ff0000' });
    expect(store().objects).toBe(before);
    expect(store().past.length).toBe(past);
  });

  it('durante una operación del motor no cambia nada', () => {
    useKuraStore.setState({ busyOperation: 'boolean' } as never);
    const before = store().objects;
    store().updateObjectsMeta([free], { color: '#ff0000' });
    store().updateObjectsMeta([free], { locked: true });
    expect(store().objects).toBe(before);
  });
});
