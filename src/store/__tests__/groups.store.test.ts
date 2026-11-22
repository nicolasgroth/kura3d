/**
 * @file src/store/__tests__/groups.store.test.ts
 * @description Grupos en el store: agrupar/desagrupar con un paso de deshacer, clic que elige el grupo,
 * entrar y salir, ojo y candado heredados, duplicar la estructura, transformación rígida del conjunto,
 * combinar (volumen = suma) y separar cuerpos, herencia de grupo en operaciones y guardado .kura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { gizmoRigidDelta, selectionBox, selectionPivot } from '../../core/scene/groupTransform';
import { captureProject } from '../projectDocument';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const paint = (id: string, color: string) =>
  useKuraStore.setState((st) => ({ objects: st.objects.map((o) => (o.id === id ? { ...o, color } : o)) }));

async function fourBoxes() {
  const a = await addBox(10, [0, 0, 0], { name: 'A' });
  const b = await addBox(10, [20, 0, 0], { name: 'B' });
  const c = await addBox(10, [40, 0, 0], { name: 'C' });
  const d = await addBox(10, [60, 0, 0], { name: 'D' });
  return { a, b, c, d };
}

describe('grupos en el store', () => {
  beforeEach(() => resetStore());

  it('agrupa, selecciona el grupo con un clic y desagrupa; cada acción es un paso', async () => {
    const { a, b } = await fourBoxes();
    const steps = store().past.length;
    const g = store().groupObjects([a.id, b.id])!;
    expect(g.name).toBe('Grupo 1');
    expect(store().past.length).toBe(steps + 1);
    store().selectObject(a.id);
    expect([...store().selectedIds].sort()).toEqual([a.id, b.id].sort());
    expect(store().enterGroup(a.id)).toBe(true);
    expect(store().selectedIds).toEqual([a.id]);
    store().selectObject(b.id);
    expect(store().selectedIds).toEqual([b.id]);
    expect(store().exitGroup()).toBe(true);
    expect(store().selectedIds.length).toBe(2);
    store().undo();
    expect(store().groups).toEqual([]);
    store().redo();
    expect(store().groups).toHaveLength(1);
    expect(store().ungroupObjects(g.id)).toBe(1);
    expect(store().groups).toEqual([]);
  });

  it('ocultar y bloquear un grupo afecta a sus miembros', async () => {
    const { a, b, c } = await fourBoxes();
    const g = store().groupObjects([a.id, b.id])!;
    store().setGroupFlag(g.id, 'locked', true);
    expect(byId(a.id)!.locked && byId(b.id)!.locked).toBe(true);
    expect(byId(c.id)!.locked).toBe(false);
    // Bloqueados: no se mueven.
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    store().nudgeSelectedObjects([5, 0, 0]);
    expect(byId(a.id)!.position[0]).toBe(0);
    expect(store().transformSelectionRigid({ translate: [5, 0, 0] }, { recordHistory: true })).toBe(false);
    store().setGroupFlag(g.id, 'visible', false);
    expect(byId(a.id)!.visible).toBe(false);
    expect(store().groups[0]).toMatchObject({ visible: false, locked: true });
  });

  it('F2 con un grupo entero seleccionado pide renombrar el grupo, no su primer objeto', async () => {
    const { a, b, c } = await fourBoxes();
    const g = store().groupObjects([a.id, b.id])!;
    store().selectObject(a.id);
    expect(store().requestRename()).toBe(true);
    expect(store().renameRequest).toMatchObject({ id: g.id, group: true });
    store().setSelection([c.id]);
    expect(store().requestRename()).toBe(true);
    expect(store().renameRequest).toMatchObject({ id: c.id });
    expect(store().renameRequest?.group).toBeUndefined();
  });

  it('duplicar un grupo duplica su estructura', async () => {
    const { a, b } = await fourBoxes();
    store().groupObjects([a.id, b.id]);
    store().duplicateObjects([a.id, b.id]);
    expect(store().groups).toHaveLength(2);
    const twin = store().groups.find((x) => x.name.includes('copia'))!;
    expect(store().objects.filter((o) => o.groupRef === twin.id)).toHaveLength(2);
  });

  it('mueve, gira y escala el conjunto como cuerpo rígido (proporcional)', async () => {
    const { a, b } = await fourBoxes();
    store().groupObjects([a.id, b.id]);
    expect(store().transformSelectionRigid({ scale: 2 }, { recordHistory: true })).toBe(true);
    const pa = byId(a.id)!, pb = byId(b.id)!;
    expect(pb.position[0] - pa.position[0]).toBeCloseTo(40);
    expect(pa.scale).toEqual([2, 2, 2]);
    store().transformSelectionRigid({ rotation: [0, Math.PI, 0] }, { recordHistory: true });
    expect(byId(a.id)!.position[0]).toBeGreaterThan(byId(b.id)!.position[0]);
    store().undo();
    store().undo();
    expect(byId(a.id)!.scale).toEqual([1, 1, 1]);
  });

  it('ruta del gizmo: escalar el grupo lo deja apoyado en la cama y girar no lo hunde', async () => {
    const { a, b, c } = await fourBoxes();
    store().groupObjects([a.id, b.id, c.id]);
    const members = () => store().objects.filter((o) => store().selectedIds.includes(o.id));
    const minY = () => selectionBox(members())!.min.y;
    expect(minY()).toBeCloseTo(0, 5);
    // Igual que GroupTransformGizmo: base del arrastre, nodo auxiliar en el centro, sin pivote propio.
    const baseline = members().map((o) => ({ id: o.id, position: o.position, rotation: o.rotation, scale: o.scale }));
    const start = selectionPivot(members());
    for (const f of [1.4, 2]) {
      const delta = gizmoRigidDelta('scale', start, { position: start, rotation: [0, 0, 0], scale: [f, 1, 1] });
      expect(store().transformSelectionRigid(delta, { baseline })).toBe(true);
    }
    store().commitTransformSnapshot();
    expect(minY()).toBeCloseTo(0, 4);
    expect(byId(a.id)!.scale).toEqual([2, 2, 2]);
    // Mover por el gizmo traslada exactamente lo arrastrado.
    const before = byId(a.id)!.position[0];
    const s2 = selectionPivot(members());
    const base2 = members().map((o) => ({ id: o.id, position: o.position, rotation: o.rotation, scale: o.scale }));
    store().transformSelectionRigid(gizmoRigidDelta('translate', s2, { position: [s2[0] + 7, s2[1], s2[2]], rotation: [0, 0, 0], scale: [1, 1, 1] }), { baseline: base2 });
    store().commitTransformSnapshot();
    expect(byId(a.id)!.position[0]).toBeCloseTo(before + 7, 5);
    expect(minY()).toBeCloseTo(0, 4);
    // Girar en Y (vertical interna) no cambia la altura del conjunto.
    const s3 = selectionPivot(members());
    const base3 = members().map((o) => ({ id: o.id, position: o.position, rotation: o.rotation, scale: o.scale }));
    store().transformSelectionRigid(gizmoRigidDelta('rotate', s3, { position: s3, rotation: [0, Math.PI / 3, 0], scale: [1, 1, 1] }), { baseline: base3 });
    store().commitTransformSnapshot();
    expect(minY()).toBeCloseTo(0, 4);
  });

  it('combina sin booleanas (volumen = suma) y separa los cuerpos', async () => {
    const { a, b } = await fourBoxes();
    const total = a.stats.volumeMm3 + b.stats.volumeMm3;
    const combined = store().combineObjects([a.id, b.id], 'Par')!;
    expect(combined.name).toBe('Par');
    expect(combined.stats.volumeMm3).toBeCloseTo(total, 1);
    expect(store().objects).toHaveLength(3);
    const parts = await store().separateBodies(combined.id);
    expect(parts).toHaveLength(2);
    expect(parts.reduce((n, p) => n + p.stats.volumeMm3, 0)).toBeCloseTo(total, 1);
  });

  it('separar cuerpos conserva el color de cada cuerpo (combinar → separar)', async () => {
    const { a, b, c } = await fourBoxes();
    paint(a.id, '#ff0000');
    paint(b.id, '#00ff00');
    paint(c.id, '#0000ff');
    const combined = store().combineObjects([a.id, b.id, c.id])!;
    expect(new Set(combined.mesh.faceColors)).toEqual(new Set(['#ff0000', '#00ff00', '#0000ff']));
    const parts = await store().separateBodies(combined.id);
    expect(parts).toHaveLength(3);
    const colors = parts.map((p) => byId(p.id)!.color.toLowerCase()).sort();
    expect(colors).toEqual(['#0000ff', '#00ff00', '#ff0000']);
    // Un solo color por cuerpo: pasa a color base, sin colores por cara.
    expect(parts.every((p) => !byId(p.id)!.mesh.faceColors?.length)).toBe(true);
  });

  it('separar piezas conserva la pintura por cara de cada isla', async () => {
    const { a, b } = await fourBoxes();
    paint(a.id, '#ff0000');
    const combined = store().combineObjects([a.id, b.id])!;
    // Pinta la mitad de las caras del cuerpo de B (las últimas) de azul: B queda bicolor.
    const fc = [...combined.mesh.faceColors!];
    const total = fc.length;
    for (let f = total - 4; f < total; f++) fc[f] = '#0000ff';
    useKuraStore.setState((st) => ({ objects: st.objects.map((o) => (o.id === combined.id ? { ...o, mesh: { ...o.mesh, faceColors: fc } } : o)) }));
    const parts = await store().splitDisconnectedObject(combined.id);
    expect(parts).toHaveLength(2);
    const multi = parts.map((p) => byId(p.id)!).find((p) => p.mesh.faceColors?.length);
    expect(multi).toBeDefined();
    expect(new Set(multi!.mesh.faceColors).has('#0000ff')).toBe(true);
    const single = parts.map((p) => byId(p.id)!).find((p) => !p.mesh.faceColors?.length)!;
    expect(single.color.toLowerCase()).toBe('#ff0000');
  });

  it('lo que reemplaza a un miembro hereda su grupo', async () => {
    const { a, b, c } = await fourBoxes();
    const g = store().groupObjects([a.id, b.id, c.id])!;
    const combined = store().combineObjects([a.id, b.id])!;
    expect(combined.groupRef).toBe(g.id);
    const parts = await store().separateBodies(combined.id);
    expect(parts.every((p) => byId(p.id)!.groupRef === g.id)).toBe(true);
  });

  it('se guarda y reabre con la jerarquía', async () => {
    const { a, b, c } = await fourBoxes();
    const inner = store().groupObjects([a.id, b.id], 'Interno')!;
    const outer = store().groupObjects([a.id, b.id, c.id], 'Externo')!;
    const doc = decodeProject(encodeProject(captureProject(store())));
    expect(doc.groups?.map((g) => g.name).sort()).toEqual(['Externo', 'Interno']);
    expect(doc.groups?.find((g) => g.id === inner.id)?.parentId).toBe(outer.id);
    expect(doc.objects.find((o) => o.id === c.id)?.groupRef).toBe(outer.id);
    // El historial también lleva los grupos.
    expect(doc.past.some((s) => s.groups?.length === 1)).toBe(true);
  });

  it('un proyecto sin grupos abre igual y no guarda el campo', async () => {
    await fourBoxes();
    const doc = decodeProject(encodeProject(captureProject(store())));
    expect(doc.groups).toBeUndefined();
    expect(doc.objects.every((o) => o.groupRef === undefined)).toBe(true);
  });

  it('Command Bus: group_objects, combine_objects, separate_bodies, ungroup y jerarquía en get_scene_state', async () => {
    const { a, b, c, d } = await fourBoxes();
    const run = (command: string, params: Record<string, unknown> = {}) =>
      store().executeCommand({ id: `t_${command}`, command: command as never, params }) as Promise<{ ok: boolean; result?: any }>;
    const grouped = await run('group_objects', { ids: [a.id, b.id], name: 'Bus' });
    expect(grouped.ok).toBe(true);
    const state = await run('get_scene_state');
    expect(state.result.groups[0]).toMatchObject({ name: 'Bus', parentId: null, objectIds: [a.id, b.id] });
    expect(state.result.objects.find((o: { id: string }) => o.id === a.id).groupId).toBe(grouped.result.id);
    const combined = await run('combine_objects', { ids: [c.id, d.id] });
    expect(combined.ok).toBe(true);
    expect((await run('combine_objects', { ids: [a.id] })).ok).toBe(false);
    const separated = await run('separate_bodies', { id: combined.result.id });
    expect(separated.result).toHaveLength(2);
    expect((await run('ungroup', { groupId: grouped.result.id })).ok).toBe(true);
    expect(store().groups).toEqual([]);
  });
});
