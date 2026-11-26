/**
 * @file src/store/__tests__/quickActions.test.ts
 * @description Pruebas del slice de acciones rápidas: agregar pieza / pieza negativa (posición, tamaño,
 * `isHole`), cambiar tipo en un paso de deshacer, F4 (duplicar ×3, ahuecar en otro objeto, acción no
 * aplicable, sin acción), F5 (recalcular; sin interceptar en la web), F3 (búsqueda) y F2 (renombrar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeObjectWorldCenter } from '../../core/scene/sceneObjects';
import { handleFunctionKey } from '../../components/useFunctionKeys';
import { addBox, byId, resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

/** Evento mínimo (el entorno de las pruebas del store es Node, sin KeyboardEvent). */
function key(k: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const e = {
    key: k, defaultPrevented: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
    repeat: false, target: null, ...init,
    preventDefault() { this.defaultPrevented = true; },
  };
  return e as unknown as KeyboardEvent;
}
const deps = { revealLeftPanel: vi.fn() };

describe('Agregar pieza desde el menú contextual', () => {
  beforeEach(() => resetStore());

  it('pieza negativa: esfera centrada en el objeto, 40 % de su dimensión menor, isHole y seleccionada', async () => {
    const cyl = await store().createPrimitive('cylinder', { radius: 10, height: 40 }, { position: [0, 0, 0] });
    const piece = await store().addPieceToObject('sphere', 'negative', cyl!.id);
    expect(piece).not.toBeNull();
    expect(piece!.role).toBe('negative');
    expect(store().selectedIds).toEqual([piece!.id]);
    // Dimensión menor del cilindro: 20 mm (diámetro) -> lado 8 mm.
    expect(piece!.stats.dimensionsMm[0]).toBeCloseTo(8, 0);
    const [cx, cy, cz] = computeObjectWorldCenter(cyl!);
    const [px, py, pz] = computeObjectWorldCenter(piece!);
    expect(px).toBeCloseTo(cx, 1);
    expect(py).toBeCloseTo(cy, 1);
    expect(pz).toBeCloseTo(cz, 1);
  });

  it('pieza positiva: sólido apoyado sobre la cara superior del objeto', async () => {
    const box = await addBox(30);
    const piece = await store().addPieceToObject('box', 'positive', box.id);
    expect(piece!.role).toBe('solid');
    expect(piece!.stats.dimensionsMm[1]).toBeCloseTo(12, 0);
    // La base de la pieza queda en la cara superior (Y = 30).
    expect(piece!.position[1]).toBeCloseTo(30, 0);
    expect(byId(box.id)!.role).toBe('solid');
  });

  it('la pieza queda agrupada con su objeto (grupo con su nombre) y el aviso lo dice', async () => {
    const box = await addBox(30);
    const piece = await store().addPieceToObject('sphere', 'negative', box.id);
    const groupId = byId(box.id)!.groupRef;
    expect(groupId).toBeTruthy();
    expect(byId(piece!.id)!.groupRef).toBe(groupId);
    expect(store().groups.find((g) => g.id === groupId)!.name).toBe(box.name);
    expect(store().toasts.at(-1)!.text).toContain(box.name);
    // Una segunda pieza entra en el mismo grupo.
    const second = await store().addPieceToObject('box', 'positive', box.id);
    expect(byId(second!.id)!.groupRef).toBe(groupId);
    expect(store().groups).toHaveLength(1);
  });

  it('agregar pieza es un solo paso de deshacer', async () => {
    const box = await addBox(20);
    const before = store().past.length;
    await store().addPieceToObject('cone', 'negative', box.id);
    expect(store().past.length).toBe(before + 1);
    store().undo();
    expect(store().objects).toHaveLength(1);
  });

  it('cambiar tipo: explícito, un paso de deshacer y sin cambio si ya es ese tipo', async () => {
    const box = await addBox(20);
    const before = store().past.length;
    store().setObjectsRole([box.id], 'negative');
    expect(byId(box.id)!.role).toBe('negative');
    expect(store().past.length).toBe(before + 1);
    store().setObjectsRole([box.id], 'negative');
    expect(store().past.length).toBe(before + 1);
    store().undo();
    expect(byId(box.id)!.role).toBe('solid');
  });
});

describe('F4: repetir la última acción', () => {
  beforeEach(() => resetStore());

  it('sin acción previa no hace nada y avisa', async () => {
    useKuraStore.setState({ lastRepeatable: null });
    expect(await store().repeatLastAction()).toBe('none');
  });

  it('duplicar ×3: cada repetición duplica la copia seleccionada con el mismo desplazamiento', async () => {
    const box = await addBox(10, [0, 0, 0]);
    store().selectObject(box.id);
    store().duplicateObjects();
    expect(store().objects).toHaveLength(2);
    const pastBefore = store().past.length;
    for (let i = 0; i < 3; i += 1) expect(await store().repeatLastAction()).toBe('done');
    expect(store().objects).toHaveLength(5);
    // Un paso de deshacer por repetición.
    expect(store().past.length).toBe(pastBefore + 3);
    const xs = store().objects.map((o) => o.position[0]).sort((a, b) => a - b);
    expect(xs).toEqual([0, 15, 30, 45, 60]);
  });

  it('apoyar en la cama (L) reemplaza a Agrupar como última acción y F4 la repite en otro objeto', async () => {
    const a = await addBox(10, [0, 20, 0], { name: 'A' });
    const b = await addBox(10, [40, 30, 0], { name: 'B' });
    const c = await addBox(10, [80, 0, 0], { name: 'C' });
    store().groupObjects([a.id, c.id]);
    expect(store().lastRepeatable).toEqual({ kind: 'group' });
    store().dropObjectToBed(a.id);
    expect(store().lastRepeatable).toEqual({ kind: 'dropToBed' });
    // Las acciones no repetibles no borran la última repetible.
    store().deleteObjects([c.id]);
    expect(store().lastRepeatable).toEqual({ kind: 'dropToBed' });
    useKuraStore.setState({ selectedIds: [b.id] });
    expect(await store().repeatLastAction()).toBe('done');
    expect(byId(b.id)!.position[1]).toBeCloseTo(0, 3);
  });

  it('restablecer, alinear, centrar y material quedan registrados como última acción', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    store().setObjectTransform(a.id, { rotation: [0, 0.5, 0] }, true);
    store().resetObjectsRotation([a.id]);
    expect(store().lastRepeatable).toEqual({ kind: 'resetRotation' });
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    store().alignSelectedObjects('minX');
    expect(store().lastRepeatable).toEqual({ kind: 'align', mode: 'minX' });
    store().centerObjectOnBed(a.id);
    expect(store().lastRepeatable).toEqual({ kind: 'centerObjectOnBed' });
    store().setObjectMaterial(a.id, 'abs');
    expect(store().lastRepeatable).toEqual({ kind: 'material', materialPreset: 'abs' });
    useKuraStore.setState({ selectedIds: [b.id] });
    expect(await store().repeatLastAction()).toBe('done');
    expect(byId(b.id)!.materialPreset).toBe('abs');
  });

  it('ahuecar con el mismo grosor se reaplica a otro objeto', async () => {
    const a = await addBox(30, [0, 0, 0], { name: 'A' });
    const b = await addBox(30, [60, 0, 0], { name: 'B' });
    await store().hollowObject(a.id, { enabled: true, wallThickness: 3 });
    expect(store().lastRepeatable).toEqual({ kind: 'hollow', wallThickness: 3 });
    const trisBefore = byId(b.id)!.stats.triangles;
    store().selectObject(b.id);
    expect(await store().repeatLastAction()).toBe('done');
    expect(byId(b.id)!.stats.triangles).toBeGreaterThan(trisBefore);
  });

  it('una acción que no aplica a la selección se informa y no cambia la escena', async () => {
    const box = await addBox(20);
    store().selectObject(box.id);
    useKuraStore.setState({ lastRepeatable: { kind: 'applyHoles' } });
    const past = store().past.length;
    expect(await store().repeatLastAction()).toBe('notApplicable');
    expect(store().past.length).toBe(past);
    store().clearSelection();
    useKuraStore.setState({ lastRepeatable: { kind: 'mirror', axis: 'x' } });
    expect(await store().repeatLastAction()).toBe('notApplicable');
  });

  it('agregar pieza negativa es repetible sobre otro objeto', async () => {
    const a = await addBox(30, [0, 0, 0]);
    const b = await addBox(30, [60, 0, 0]);
    await store().addPieceToObject('sphere', 'negative', a.id);
    store().selectObject(b.id);
    await store().repeatLastAction();
    const holes = store().objects.filter((o) => (o.role === 'negative'));
    expect(holes).toHaveLength(2);
  });

  it('mover por delta (flechas) se repite; eliminar no se registra', async () => {
    const box = await addBox(10);
    store().selectObject(box.id);
    store().nudgeSelectedObjects([5, 0, 0]);
    await store().repeatLastAction();
    expect(byId(box.id)!.position[0]).toBe(10);
    store().deleteObjects([box.id]);
    expect(store().lastRepeatable).toEqual({ kind: 'nudge', delta: [5, 0, 0] });
  });

  it('el color aplicado se repite sobre la selección', async () => {
    const a = await addBox(10);
    const b = await addBox(10, [40, 0, 0]);
    store().updateObjectMeta(a.id, { color: '#ff0000' });
    store().selectObject(b.id);
    await store().repeatLastAction();
    expect(byId(b.id)!.color).toBe('#ff0000');
  });
});

describe('Teclas de función', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ activeDialog: null, commandPaletteOpen: false, lastRepeatable: null, sceneFilter: '' });
  });

  it('F4 repite y avisa si no hay acción', async () => {
    const e = key('F4');
    expect(handleFunctionKey(e, deps)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(store().toasts.length).toBeGreaterThan(0));
  });

  it('F5 sin Mayús no se intercepta en la web (recarga la página)', () => {
    const e = key('F5');
    expect(handleFunctionKey(e, deps)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it('Mayús+F5 recalcula el paramétrico seleccionado', async () => {
    const box = await addBox(20);
    store().selectObject(box.id);
    const pastBefore = store().past.length;
    const e = key('F5', { shiftKey: true });
    expect(handleFunctionKey(e, deps)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(store().past.length).toBe(pastBefore + 1));
  });

  it('las teclas de función no actúan con un diálogo abierto ni con Ctrl', () => {
    useKuraStore.setState({ activeDialog: 'shortcuts' });
    expect(handleFunctionKey(key('F4'), deps)).toBe(false);
    useKuraStore.setState({ activeDialog: null });
    expect(handleFunctionKey(key('F4', { ctrlKey: true }), deps)).toBe(false);
  });

  it('F2 pide renombrar el objeto seleccionado (o avisa si no hay)', async () => {
    const box = await addBox(10);
    store().clearSelection();
    useKuraStore.setState({ renameRequest: null });
    expect(handleFunctionKey(key('F2'), deps)).toBe(true);
    expect(store().renameRequest).toBeNull();
    store().selectObject(box.id);
    expect(handleFunctionKey(key('F2'), deps)).toBe(true);
    expect(store().renameRequest?.id).toBe(box.id);
  });

  it('F3 enfoca la búsqueda y, con texto, recorre los resultados', async () => {
    const a = await addBox(10, [0, 0, 0], { name: 'Pata 1' });
    const b = await addBox(10, [30, 0, 0], { name: 'Mesa' });
    const c = await addBox(10, [60, 0, 0], { name: 'Pata 2' });
    handleFunctionKey(key('F3'), deps);
    expect(store().searchFocusRequest).not.toBeNull();
    store().setSceneFilter('pata');
    expect(store().findSceneMatch('first')?.id).toBe(a.id);
    expect(store().selectedIds).toEqual([a.id]);
    handleFunctionKey(key('F3'), deps);
    expect(store().selectedIds).toEqual([c.id]);
    handleFunctionKey(key('F3'), deps);
    expect(store().selectedIds).toEqual([a.id]);
    handleFunctionKey(key('F3', { shiftKey: true }), deps);
    expect(store().selectedIds).toEqual([c.id]);
    expect(b.id).not.toBe(store().selectedIds[0]);
  });
});
