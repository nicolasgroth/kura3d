/**
 * @file src/store/__tests__/magnetPlaceUx.test.ts
 * @description Colocar un imán con el motor real: no cambia la selección que había, deja un solo aviso por clic
 * (creado más la advertencia más grave) y con un campo inválido no hace nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { closeMagnetPanel, isMagnetPlacementActive, mostSevereMagnetWarning, openMagnetPanel, placeMagnetAt, useMagnetPanel } from '../magnetPanel';
import { magnetWarnings } from '../magnetWarnings';
import { resetMagnetStore, store } from './magnetTestKit';

async function setup() {
  await resetMagnetStore();
  closeMagnetPanel();
  useMagnetPanel.setState({ params: { ...MAGNET_DEFAULTS }, blocked: false, lastWall: null });
  const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
  const other = (await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { position: [80, 0, 0] }))!;
  store().selectObject(other.id, false);
  clearToasts();
  return { host, other };
}

function clearToasts() {
  // El aviso de «creado» de las primitivas no interesa: se mide solo lo que emite la colocación.
  store().dismissAllToasts();
  store().clearToastHistory();
}

describe('colocar un imán: selección y avisos', () => {
  beforeEach(async () => { await setup(); });

  it('no cambia la selección que había', async () => {
    const before = [...store().selectedIds];
    expect(before).toHaveLength(1);
    expect(await placeMagnetAt(store().objects[0].id, [0, 30, 0], [0, 1, 0])).toBe(true);
    expect(await placeMagnetAt(store().objects[0].id, [8, 30, 0], [0, 1, 0])).toBe(true);
    expect(store().selectedIds).toEqual(before);
  });

  it('deja un solo aviso por clic, con la advertencia más grave', async () => {
    const host = store().objects[0];
    // Pegado al borde: poca pared o hueco que atraviesa.
    expect(await placeMagnetAt(host.id, [14, 30, 0], [0, 1, 0])).toBe(true);
    expect(store().toasts).toHaveLength(1);
    const wall = useMagnetPanel.getState().lastWall!;
    const severe = mostSevereMagnetWarning(magnetWarnings(wall, 'es'));
    expect(severe).not.toBeNull();
    expect(store().toasts[0].text).toContain('Imán 5 × 2');
    expect(store().toasts[0].text.length).toBeGreaterThan('Imán 5 × 2'.length + 20);
    // Un segundo clic sobre el mismo punto: sigue habiendo un único aviso, el del segundo.
    expect(await placeMagnetAt(host.id, [14, 30, 0], [0, 1, 0])).toBe(true);
    expect(store().toasts).toHaveLength(1);
    expect(store().toasts[0].text).toContain('Imán 5 × 2 (2)');
  });

  it('con un campo inválido no coloca ni cambia la selección', async () => {
    useMagnetPanel.setState({ blocked: true });
    const before = [...store().selectedIds];
    const count = store().objects.length;
    expect(await placeMagnetAt(store().objects[0].id, [0, 30, 0], [0, 1, 0])).toBe(false);
    expect(store().objects).toHaveLength(count);
    expect(store().selectedIds).toEqual(before);
  });

  it('con el panel abierto la capa de colocación se queda con el clic (la pieza no se selecciona)', () => {
    expect(isMagnetPlacementActive()).toBe(false);
    openMagnetPanel();
    expect(isMagnetPlacementActive()).toBe(true);
    closeMagnetPanel();
    expect(isMagnetPlacementActive()).toBe(false);
  });
});
