/**
 * @file src/store/__tests__/menuIdeas.test.ts
 * @description Ideas de los menús de laminadores en el store: centrar en la cama (X e Y, sin tocar la altura, un paso
 * de deshacer, repetible con F4), restablecer rotación y escala, reemplazar la geometría por un archivo (conserva
 * nombre, posición, rotación, color y tipo; un paso; avisa si el tamaño cambia más de 5 %), un objeto oculto fuera de
 * la exportación y el aviso de malla pesada al importar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { t } from '../../i18n';
import { selectExportTargets } from '../exportTargets';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

/** STL ASCII de una caja `w`×`h`×`d` (12 triángulos, normales hacia fuera). */
function boxStl(w: number, h: number, d: number): ArrayBuffer {
  const v = [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0], [0, 0, d], [w, 0, d], [w, h, d], [0, h, d]];
  const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const body = tris
    .map(([a, b, c]) => `facet normal 0 0 0\nouter loop\n${[a, b, c].map((i) => `vertex ${v[i].join(' ')}`).join('\n')}\nendloop\nendfacet`)
    .join('\n');
  return new TextEncoder().encode(`solid caja\n${body}\nendsolid caja\n`).buffer as ArrayBuffer;
}

describe('Centrar en la cama', () => {
  beforeEach(() => resetStore());

  it('lleva X e Y al centro sin cambiar la altura y es un solo paso de deshacer', async () => {
    const box = await addBox(10, [40, 7, -25]);
    useKuraStore.setState({ selectedIds: [box.id] });
    const before = store().past.length;
    expect(store().centerSelectionOnBed()).toBe(true);
    const after = byId(box.id)!;
    expect(after.position[0]).toBeCloseTo(0, 6);
    expect(after.position[2]).toBeCloseTo(0, 6);
    expect(after.position[1]).toBe(7);
    expect(store().past.length).toBe(before + 1);
    store().undo();
    expect(byId(box.id)!.position).toEqual([40, 7, -25]);
  });

  it('centra la selección múltiple como bloque, conservando las posiciones relativas', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    store().centerSelectionOnBed();
    expect(byId(a.id)!.position[0]).toBeCloseTo(-15, 6);
    expect(byId(b.id)!.position[0]).toBeCloseTo(15, 6);
    expect(byId(b.id)!.position[0] - byId(a.id)!.position[0]).toBeCloseTo(30, 6);
  });

  it('no mueve objetos bloqueados y queda registrado para repetir con F4', async () => {
    const box = await addBox(10, [20, 0, 20]);
    useKuraStore.setState({ selectedIds: [box.id] });
    store().centerSelectionOnBed();
    expect(store().lastRepeatable).toEqual({ kind: 'centerOnBed' });
    const other = await addBox(10, [50, 0, 50]);
    useKuraStore.setState({ selectedIds: [other.id] });
    expect(await store().repeatLastAction()).toBe('done');
    expect(byId(other.id)!.position[0]).toBeCloseTo(0, 6);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === box.id ? { ...o, locked: true, position: [9, 0, 9] } : o)), selectedIds: [box.id] }));
    expect(store().centerSelectionOnBed()).toBe(false);
    expect(byId(box.id)!.position).toEqual([9, 0, 9]);
  });
});

describe('Restablecer rotación y escala', () => {
  beforeEach(() => resetStore());

  it('restablece rotación y escala conservando la posición, un paso cada una', async () => {
    const box = await addBox(10, [5, 0, 5]);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === box.id ? { ...o, rotation: [0.5, 1, 0], scale: [2, 2, 2] } : o)) }));
    const before = store().past.length;
    expect(store().resetObjectsRotation([box.id])).toBe(true);
    expect(store().resetObjectsScale([box.id])).toBe(true);
    const o = byId(box.id)!;
    expect(o.rotation).toEqual([0, 0, 0]);
    expect(o.scale).toEqual([1, 1, 1]);
    expect(o.position).toEqual([5, 0, 5]);
    expect(store().past.length).toBe(before + 2);
    expect(store().resetObjectsRotation([box.id])).toBe(false);
  });
});

describe('Reemplazar por archivo', () => {
  beforeEach(() => resetStore());

  it('conserva nombre, posición, rotación, color y tipo; cambia la malla en un solo paso', async () => {
    const box = await addBox(10, [30, 4, -12], { name: 'Mi pieza' });
    useKuraStore.setState((s) => ({
      objects: s.objects.map((o) => (o.id === box.id ? { ...o, rotation: [0, 0.7, 0], color: '#123456', role: 'negative' } : o)),
      selectedIds: [box.id],
    }));
    const oldMesh = byId(box.id)!.mesh;
    const before = store().past.length;
    expect(await store().replaceObjectMesh(box.id, { name: 'nueva.stl', buffer: boxStl(20, 8, 30) })).toBe(true);
    const o = byId(box.id)!;
    expect(o.name).toBe('Mi pieza');
    expect(o.position).toEqual([30, 4, -12]);
    expect(o.rotation).toEqual([0, 0.7, 0]);
    expect(o.color).toBe('#123456');
    expect((o.role === 'negative')).toBe(true);
    expect(o.mesh).not.toBe(oldMesh);
    expect(o.stats.dimensionsMm.map((v) => Math.round(v))).toEqual([20, 30, 8]);
    expect(o.primitiveType).toBeUndefined();
    expect(store().past.length).toBe(before + 1);
    store().undo();
    expect(byId(box.id)!.mesh).toBe(oldMesh);
  });

  it('avisa si el tamaño cambia más de 5 % y no avisa si casi no cambia', async () => {
    const box = await addBox(10);
    await store().replaceObjectMesh(box.id, { name: 'a.stl', buffer: boxStl(20, 10, 10) });
    expect(store().toasts.some((x) => x.text === t('es', 'toast.replaced.sizeChanged', { percent: 100 }))).toBe(true);
    useKuraStore.setState({ toasts: [] });
    await store().replaceObjectMesh(box.id, { name: 'b.stl', buffer: boxStl(20.5, 10, 10) });
    expect(store().toasts.some((x) => x.text.includes('El tamaño cambió'))).toBe(false);
  });

  it('un archivo inválido deja el objeto intacto y no agrega paso de historial', async () => {
    const box = await addBox(10);
    const before = store().past.length;
    expect(await store().replaceObjectMesh(box.id, { name: 'roto.stl', buffer: new TextEncoder().encode('nada').buffer as ArrayBuffer })).toBe(false);
    expect(store().past.length).toBe(before);
    expect(byId(box.id)!.stats.dimensionsMm[0]).toBeCloseTo(10, 3);
  });

  it('no reemplaza un objeto bloqueado', async () => {
    const box = await addBox(10);
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === box.id ? { ...o, locked: true } : o)) }));
    expect(await store().replaceObjectMesh(box.id, { name: 'a.stl', buffer: boxStl(20, 10, 10) })).toBe(false);
  });
});

describe('Ocultar excluye de la exportación', () => {
  beforeEach(() => resetStore());

  it('un objeto oculto no entra ni con alcance de escena ni de selección', async () => {
    const a = await addBox(10);
    const b = await addBox(10, [30, 0, 0]);
    store().updateObjectMeta(b.id, { visible: false });
    expect(selectExportTargets(store().objects, [], false).targets.map((o) => o.id)).toEqual([a.id]);
    expect(selectExportTargets(store().objects, [b.id], true).targets).toEqual([]);
  });
});

describe('Aviso de malla pesada al importar', () => {
  beforeEach(() => resetStore());

  it('avisa con un botón Simplificar cuando se supera el umbral y la acción pide el panel', async () => {
    const limits = OPERATION_DEFAULTS.heavyMesh as { warnTriangles: number };
    const original = limits.warnTriangles;
    limits.warnTriangles = 10;
    try {
      await store().importModelFiles([{ name: 'caja.stl', read: async () => boxStl(10, 10, 10) }]);
      const toast = store().toasts.find((x) => x.text.includes('puede ir lento'));
      expect(toast).toBeTruthy();
      expect(toast!.text).toContain('12 triángulos');
      expect(toast!.action?.label).toBe(t('es', 'import.heavy.action'));
      toast!.action!.run();
      expect(store().simplifyRequest?.id).toBe(store().objects[0].id);
    } finally {
      limits.warnTriangles = original;
    }
  });

  it('no avisa con un modelo liviano y el umbral por defecto es de 300 000 triángulos', async () => {
    expect(OPERATION_DEFAULTS.heavyMesh.warnTriangles).toBe(300_000);
    await store().importModelFiles([{ name: 'caja.stl', read: async () => boxStl(10, 10, 10) }]);
    expect(store().toasts.some((x) => x.text.includes('puede ir lento'))).toBe(false);
  });
});

describe('Forma Disco', () => {
  beforeEach(() => resetStore());

  it('agregar disco como pieza crea un cilindro bajo (alto = 10 % del diámetro) con nombre Disco', async () => {
    const box = await addBox(50);
    const piece = await store().addPieceToObject('disc', 'positive', box.id);
    expect(piece).not.toBeNull();
    expect(piece!.primitiveType).toBe('cylinder');
    const params = piece!.primitiveParams as { radius: number; height: number };
    expect(params.height).toBeCloseTo(2 * params.radius * 0.1, 6);
    expect(piece!.name).toContain('Disco');
    expect(store().lastRepeatable).toEqual({ kind: 'addPiece', shape: 'disc', mode: 'positive' });
  });

  it('como pieza negativa queda marcada como Negativo', async () => {
    const box = await addBox(50);
    const piece = await store().addPieceToObject('disc', 'negative', box.id);
    expect(piece!.role).toBe('negative');
  });
});
