/**
 * @file src/store/__tests__/visibilityShortcut.test.ts
 * @description Mayús+H en el visor: oculta la selección y, pulsada de nuevo, vuelve a mostrar lo recién
 * ocultado; sin selección muestra todo lo oculto. Cada pulsación es un solo paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('Mayús+H: ocultar y volver a mostrar', () => {
  beforeEach(() => resetStore('es'));

  it('oculta lo seleccionado y la segunda pulsación lo vuelve a mostrar', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    store().setSelection([a.id, b.id]);
    store().toggleSelectionVisibility();
    expect(byId(a.id)!.visible).toBe(false);
    expect(byId(b.id)!.visible).toBe(false);
    store().toggleSelectionVisibility();
    expect(byId(a.id)!.visible).toBe(true);
    expect(byId(b.id)!.visible).toBe(true);
  });

  it('sin selección muestra todo lo oculto, en un solo paso de deshacer', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    store().setSelection([a.id, b.id]);
    store().toggleSelectionVisibility();
    store().setSelection([]);
    const steps = store().past.length;
    store().toggleSelectionVisibility();
    expect(store().objects.every((o) => o.visible)).toBe(true);
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(byId(a.id)!.visible).toBe(false);
    expect(byId(b.id)!.visible).toBe(false);
  });
});
