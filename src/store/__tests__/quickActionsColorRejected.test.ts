/**
 * @file src/store/__tests__/quickActionsColorRejected.test.ts
 * @description La acción rápida «color» solo se registra si `updateObjectsMeta` aplicó el cambio: con la selección
 * bloqueada (o el mismo color) no queda como repetible ni renombra el paso anterior del historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('acción rápida «color» rechazada', () => {
  beforeEach(() => resetStore());

  it('pieza bloqueada: no cambia, no se registra y el historial no crece', async () => {
    const a = await addBox(10, [0, 0, 0], { name: 'A' });
    store().updateObjectsMeta([a.id], { locked: true });
    useKuraStore.setState({ lastRepeatable: null });
    const past = store().past.length;
    expect(store().updateObjectsMeta([a.id], { color: '#ff0000' })).toBe(false);
    expect(byId(a.id)!.color).not.toBe('#ff0000');
    expect(store().lastRepeatable).toBeNull();
    expect(store().past.length).toBe(past);
  });

  it('cambio aplicado: se registra', async () => {
    const a = await addBox(10, [0, 0, 0], { name: 'A' });
    useKuraStore.setState({ lastRepeatable: null });
    expect(store().updateObjectsMeta([a.id], { color: '#00ff00' })).toBe(true);
    expect(store().lastRepeatable).toMatchObject({ kind: 'color', color: '#00ff00' });
    // El mismo color otra vez no es un cambio.
    useKuraStore.setState({ lastRepeatable: null });
    expect(store().updateObjectsMeta([a.id], { color: '#00ff00' })).toBe(false);
    expect(store().lastRepeatable).toBeNull();
  });
});
