/**
 * @file src/store/__tests__/storeGuards.test.ts
 * @description Pruebas de las guardas del store: historial bloqueado durante operaciones y arrastres,
 * saneado de `setObjectTransform`, entradas obsoletas tras un `await`, objetos bloqueados en
 * booleanas, resta vacía tipada, límite común de historial e i18n del sufijo de copia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { encodeProject, MAX_UNDO_HISTORY } from '../../project/projectCodec';
import { subtractOrEmpty } from '../sceneOperationGuards';
import { captureProject, useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('Historial bloqueado durante operaciones y arrastres', () => {
  beforeEach(() => resetStore());

  it('undo, redo y borrar no hacen nada mientras hay busyOperation', async () => {
    const box = await addBox(10);
    store().setObjectTransform(box.id, { position: [5, 0, 0] }, true);
    useKuraStore.setState({ busyOperation: 'simplify' });
    store().undo();
    expect(byId(box.id)!.position).toEqual([5, 0, 0]);
    store().deleteObjects([box.id]);
    expect(byId(box.id)).toBeDefined();
    useKuraStore.setState({ busyOperation: null, toasts: [] });
    store().undo();
    expect(byId(box.id)!.position).toEqual([0, 0, 0]);
    store().redo();
    expect(byId(box.id)!.position).toEqual([5, 0, 0]);
  });

  it('undo durante un arrastre se rechaza y el commit posterior no empuja un snapshot viejo', async () => {
    const box = await addBox(10);
    const pastBefore = store().past.length;
    store().setObjectTransform(box.id, { position: [3, 0, 0] });
    store().setObjectTransform(box.id, { position: [7, 0, 0] });
    store().undo();
    expect(byId(box.id)!.position).toEqual([7, 0, 0]);
    expect(store().toasts.some((t) => t.text.includes('Espera'))).toBe(true);
    store().commitTransformSnapshot();
    expect(store().past.length).toBe(pastBefore + 1);
    store().undo();
    expect(byId(box.id)!.position).toEqual([0, 0, 0]);
  });
});

describe('setObjectTransform sanea el parche', () => {
  beforeEach(() => resetStore());

  it('descarta NaN, infinitos y vectores mal formados', async () => {
    const box = await addBox(10);
    store().setObjectTransform(box.id, { position: [Number.NaN, 0, 0] }, true);
    store().setObjectTransform(box.id, { rotation: [0, Infinity, 0] }, true);
    store().setObjectTransform(box.id, { position: [1, 2] as unknown as [number, number, number] }, true);
    expect(byId(box.id)!.position).toEqual([0, 0, 0]);
    expect(byId(box.id)!.rotation).toEqual([0, 0, 0]);
    expect(() => encodeProject(captureProject(store()))).not.toThrow();
  });

  it('acota la escala a un mínimo positivo', async () => {
    const box = await addBox(10);
    store().setObjectTransform(box.id, { scale: [0, -2, 1] }, true);
    const [sx, sy, sz] = byId(box.id)!.scale;
    expect(sx).toBeGreaterThan(0);
    expect(sy).toBeGreaterThan(0);
    expect(sz).toBe(1);
  });
});

describe('Operaciones asíncronas no escriben sobre estado viejo', () => {
  beforeEach(() => resetStore());

  it('cancela la booleana si el objetivo se movió durante el cálculo', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const b = await addBox(10, [5, 0, 0]);
    const pending = store().runBooleanOnSelection('union', a.id, b.id);
    // Edición concurrente (p. ej. otro cliente) antes de que termine el cálculo.
    useKuraStore.setState((s) => ({
      objects: s.objects.map((o) => (o.id === a.id ? { ...o, position: [50, 0, 0] } : o)),
    }));
    expect(await pending).toBeNull();
    expect(store().objects.map((o) => o.id).sort()).toEqual([a.id, b.id].sort());
    expect(byId(a.id)!.position).toEqual([50, 0, 0]);
  });

  it('runBooleanOnSelection no consume objetos bloqueados', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const b = await addBox(10, [5, 0, 0]);
    store().updateObjectMeta(a.id, { locked: true });
    expect(await store().runBooleanOnSelection('subtract', a.id, b.id)).toBeNull();
    expect(store().objects).toHaveLength(2);
  });

  it('applyHolesOnSolids no recorta sólidos bloqueados', async () => {
    const solid = await addBox(20, [0, 0, 0]);
    await addBox(6, [0, 0, 0], { isHole: true });
    store().updateObjectMeta(solid.id, { locked: true });
    useKuraStore.setState({ selectedIds: [] });
    await store().applyHolesOnSolids();
    expect(byId(solid.id)!.stats.volumeMm3).toBeCloseTo(8000, 0);
    expect(store().objects.some((o) => o.isHole)).toBe(true);
  });
});

describe('Resta vacía detectada por geometría', () => {
  beforeEach(() => resetStore());

  it('devuelve null cuando el hueco contiene al sólido', async () => {
    const small = await addBox(5, [0, 0, 0]);
    const hole = await addBox(30, [0, -5, 0], { isHole: true });
    expect(await subtractOrEmpty(small, hole)).toBeNull();
  });

  it('devuelve la malla cuando la resta deja volumen', async () => {
    const big = await addBox(20, [0, 0, 0]);
    const hole = await addBox(5, [0, 0, 0], { isHole: true });
    const res = await subtractOrEmpty(big, hole);
    expect(res).not.toBeNull();
  });

  it('applyHolesOnSolids elimina el sólido contenido y conserva el resto', async () => {
    const inner = await addBox(4, [100, 0, 0]);
    await addBox(20, [100, -2, 0], { isHole: true });
    const other = await addBox(10, [-60, 0, 0]);
    useKuraStore.setState({ selectedIds: [] });
    await store().applyHolesOnSolids();
    expect(byId(inner.id)).toBeUndefined();
    expect(byId(other.id)).toBeDefined();
    expect(store().objects.some((o) => o.isHole)).toBe(false);
  });
});

describe('Límite común de historial e i18n', () => {
  beforeEach(() => resetStore());

  it('el historial nunca supera MAX_UNDO_HISTORY y el proyecto sigue guardable', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= MAX_UNDO_HISTORY + 5; i++) {
      store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    }
    for (let i = 0; i < 3; i++) store().undo();
    const { past, future } = store();
    expect(past.length + future.length).toBeLessThanOrEqual(MAX_UNDO_HISTORY);
    expect(() => encodeProject(captureProject(store()))).not.toThrow();
  });

  it('el sufijo de copia sale del diccionario del idioma activo', async () => {
    await resetStore('de');
    const box = await addBox(10, [0, 0, 0], { name: 'Teil' });
    const [copy] = store().duplicateObjects([box.id]);
    expect(copy.name).toBe('Teil (Kopie)');
  });

  it('el nombre de rosca sale del diccionario', async () => {
    await resetStore('en');
    const bolt = await store().createThreadObject({
      kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 12, clearanceMm: 0.25, includeHead: false,
    });
    expect(bolt?.name.startsWith('Bolt M8')).toBe(true);
  });
});
