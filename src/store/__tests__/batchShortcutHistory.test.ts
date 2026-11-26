/**
 * @file src/store/__tests__/batchShortcutHistory.test.ts
 * @description Los atajos que recorren la selección (H alterna Sólido/Negativo, L apoya en la cama) son UN paso de
 * deshacer sin importar cuántas piezas haya elegidas, y un solo Ctrl+Z los revierte todos. También cubre la
 * decisión de Ctrl+Mayús+U (restas o unión) que sale del manejador de teclado al store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { addBox, byId, resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

describe('H y L con varias piezas: un solo paso de deshacer', () => {
  beforeEach(() => resetStore());

  it('H alterna el rol de las 3 piezas elegidas en un paso y un Ctrl+Z las devuelve', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [40, 0, 0], { role: 'negative' });
    const c = await addBox(10, [80, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id, b.id, c.id] });
    const before = store().past.length;
    expect(store().toggleSelectionRole()).toBe(true);
    expect(store().past.length).toBe(before + 1);
    expect(byId(a.id)!.role).toBe('negative');
    expect(byId(b.id)!.role).toBe('solid');
    expect(byId(c.id)!.role).toBe('negative');
    store().undo();
    expect(byId(a.id)!.role).toBe('solid');
    expect(byId(b.id)!.role).toBe('negative');
    expect(byId(c.id)!.role).toBe('solid');
  });

  it('H no toca referencias y sin piezas alternables no deja paso de deshacer', async () => {
    const ref = await addBox(10, [0, 0, 0], { role: 'reference' });
    useKuraStore.setState({ selectedIds: [ref.id] });
    const before = store().past.length;
    expect(store().toggleSelectionRole()).toBe(false);
    expect(store().past.length).toBe(before);
    expect(byId(ref.id)!.role).toBe('reference');
    useKuraStore.setState({ selectedIds: [] });
    expect(store().toggleSelectionRole()).toBe(false);
  });

  it('H omite las piezas bloqueadas y, si todas lo están, no hace nada ni suma paso', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [40, 0, 0]);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === b.id ? { ...o, locked: true } : o)) }));
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    const before = store().past.length;
    expect(store().toggleSelectionRole()).toBe(true);
    expect(store().past.length).toBe(before + 1);
    expect(byId(a.id)!.role).toBe('negative');
    expect(byId(b.id)!.role ?? 'solid').toBe('solid');
    useKuraStore.setState({ selectedIds: [b.id] });
    const repeatable = store().lastRepeatable;
    expect(store().toggleSelectionRole()).toBe(false);
    expect(store().past.length).toBe(before + 1);
    expect(byId(b.id)!.role ?? 'solid').toBe('solid');
    expect(store().lastRepeatable).toEqual(repeatable);
  });

  it('L apoya 3 piezas en la cama con un solo paso y un Ctrl+Z las devuelve a su altura', async () => {
    const a = await addBox(10, [0, 20, 0]);
    const b = await addBox(10, [40, 30, 0]);
    const c = await addBox(10, [80, 40, 0]);
    const before = store().past.length;
    const moved = store().dropObjectsToBed([a.id, b.id, c.id]);
    expect(moved).toHaveLength(3);
    expect(store().past.length).toBe(before + 1);
    for (const id of [a.id, b.id, c.id]) expect(byId(id)!.position[1]).toBeCloseTo(0, 3);
    expect(store().lastRepeatable).toEqual({ kind: 'dropToBed' });
    store().undo();
    expect(byId(a.id)!.position[1]).toBeCloseTo(20, 3);
    expect(byId(b.id)!.position[1]).toBeCloseTo(30, 3);
    expect(byId(c.id)!.position[1]).toBeCloseTo(40, 3);
  });

  it('L omite las piezas bloqueadas y no deja paso si no hay nada que apoyar', async () => {
    const a = await addBox(10, [0, 20, 0]);
    const b = await addBox(10, [40, 30, 0]);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === b.id ? { ...o, locked: true } : o)) }));
    const before = store().past.length;
    expect(store().dropObjectsToBed([a.id, b.id])).toEqual([a.id]);
    expect(store().past.length).toBe(before + 1);
    expect(byId(b.id)!.position[1]).toBeCloseTo(30, 3);
    expect(store().dropObjectsToBed([b.id])).toEqual([]);
    expect(store().dropObjectsToBed([])).toEqual([]);
    expect(store().past.length).toBe(before + 1);
  });

  it('F4 tras L repite el apoyo como un solo paso aunque haya varias piezas elegidas', async () => {
    const a = await addBox(10, [0, 20, 0]);
    const b = await addBox(10, [40, 30, 0]);
    const c = await addBox(10, [80, 40, 0]);
    store().dropObjectToBed(a.id);
    useKuraStore.setState({ selectedIds: [b.id, c.id] });
    const before = store().past.length;
    expect(await store().repeatLastAction()).toBe('done');
    expect(store().past.length).toBe(before + 1);
    expect(byId(b.id)!.position[1]).toBeCloseTo(0, 3);
    expect(byId(c.id)!.position[1]).toBeCloseTo(0, 3);
  });
});

describe('Ctrl+Mayús+U: restar o unir', () => {
  beforeEach(() => resetStore());

  it('sin nada aplicable no hace nada', async () => {
    const a = await addBox(10, [0, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id] });
    expect(await store().applyHolesOrUnion()).toBeNull();
  });

  it('con un hueco y un sólido en la selección aplica las restas', async () => {
    const solid = await addBox(20, [0, 0, 0]);
    const hole = await addBox(8, [0, 6, 0], { role: 'negative' });
    useKuraStore.setState({ selectedIds: [solid.id, hole.id] });
    expect(await store().applyHolesOrUnion()).toBe('applyHoles');
  });

  it('con una sola pieza elegida y huecos y sólidos en la escena aplica las restas', async () => {
    const solid = await addBox(20, [0, 0, 0]);
    await addBox(8, [0, 6, 0], { role: 'negative' });
    useKuraStore.setState({ selectedIds: [solid.id] });
    expect(await store().applyHolesOrUnion()).toBe('applyHoles');
  });

  it('con dos sólidos elegidos los une', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [5, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    expect(await store().applyHolesOrUnion()).toBe('union');
  });

  it('si las restas no ocurren (hueco sin contacto) devuelve null y no registra la acción', async () => {
    const solid = await addBox(10, [0, 0, 0]);
    const hole = await addBox(4, [200, 0, 0], { role: 'negative' });
    useKuraStore.setState({ selectedIds: [solid.id, hole.id], lastRepeatable: null });
    const before = store().past.length;
    expect(await store().applyHolesOrUnion()).toBeNull();
    expect(store().past.length).toBe(before);
    expect(store().lastRepeatable).toBeNull();
  });

  it('si la unión no ocurre (pieza bloqueada) devuelve null y no registra la acción', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [5, 0, 0]);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === b.id ? { ...o, locked: true } : o)) }));
    useKuraStore.setState({ selectedIds: [a.id, b.id], lastRepeatable: null });
    expect(await store().applyHolesOrUnion()).toBeNull();
    expect(store().lastRepeatable).toBeNull();
  });
});
