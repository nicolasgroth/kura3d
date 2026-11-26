/**
 * @file src/components/viewport/__tests__/floatingBarHistory.test.ts
 * @description Barra flotante: un cambio de color (varios eventos de arrastre) y bloquear N objetos son UN paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { applyFloatingBarColor, floatingBarItems, runFloatingBarAction } from '../floatingBarActions';
import { addBox, byId, resetStore, store } from '../../../store/__tests__/storeTestUtils';

describe('barra flotante: historial de deshacer', () => {
  beforeEach(() => resetStore());

  it('un gesto de color con muchos eventos deja un solo paso y deshacer lo revierte todo', async () => {
    const a = await addBox(10);
    const b = await addBox(10);
    const original = byId(a.id)!.color;
    store().setSelection([a.id, b.id]);
    const before = store().past.length;
    applyFloatingBarColor('#111111', true);
    for (const hex of ['#222222', '#333333', '#444444']) applyFloatingBarColor(hex, false);
    expect(store().past.length).toBe(before + 1);
    expect(byId(a.id)!.color).toBe('#444444');
    expect(byId(b.id)!.color).toBe('#444444');
    store().undo();
    expect(byId(a.id)!.color).toBe(original);
    expect(store().past.length).toBe(before);
  });

  it('bloquear N objetos seleccionados es un solo paso', async () => {
    const a = await addBox(10);
    const b = await addBox(10);
    const c = await addBox(10);
    store().setSelection([a.id, b.id, c.id]);
    const before = store().past.length;
    runFloatingBarAction('lock');
    expect(store().past.length).toBe(before + 1);
    expect([a, b, c].every((o) => byId(o.id)!.locked)).toBe(true);
    store().undo();
    expect([a, b, c].some((o) => byId(o.id)!.locked)).toBe(false);
  });

  it('cada botón trae su propio ícono, sin depender del texto de la traducción', async () => {
    const a = await addBox(10);
    store().setSelection([a.id]);
    const icons = floatingBarItems(store().objects, store().selectedIds).map((i) => i.icon);
    expect(icons).toEqual(['palette', 'copy', 'eye-off', 'unlock', 'trash', 'more']);
  });
});
