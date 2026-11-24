/**
 * @file src/store/__tests__/magnetFinalStore.test.ts
 * @description Alojamiento de imán, defectos finales con motor real: aviso viejo tras deshacer, mensaje de
 * parámetro inválido con sus valores, tapa abierta (lámina suelta), imán más ancho que la cara, aviso de curva en cara
 * plana y un único aviso corto por colocación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { closeMagnetPanel, placeMagnetAt, useMagnetPanel } from '../magnetPanel';
import { magnetWarnings, magnetWarningText } from '../magnetWarnings';
import { pickFace, resetMagnetStore, store, worldOf } from './magnetTestKit';

async function setup() {
  await resetMagnetStore();
  closeMagnetPanel();
  useMagnetPanel.setState({ params: { ...MAGNET_DEFAULTS }, blocked: false, lastWall: null });
}

describe('imán: defectos finales', () => {
  beforeEach(setup);

  it('3: tras deshacer o borrar el imán, el panel olvida su último resultado; al cerrar también', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    await placeMagnetAt(host.id, [0, 30, 0], [0, 1, 0]);
    expect(useMagnetPanel.getState().lastWall).not.toBeNull();
    store().undo();
    expect(useMagnetPanel.getState().lastWall).toBeNull();
    await placeMagnetAt(host.id, [0, 30, 0], [0, 1, 0]);
    const magnet = store().objects.find((o) => o.role === 'negative')!;
    store().deleteObjects([magnet.id]);
    expect(store().objects.some((o) => o.id === magnet.id)).toBe(false);
    expect(useMagnetPanel.getState().lastWall).toBeNull();
    await placeMagnetAt(host.id, [0, 30, 0], [0, 1, 0]);
    expect(useMagnetPanel.getState().lastWall).not.toBeNull();
    closeMagnetPanel();
    expect(useMagnetPanel.getState().lastWall).toBeNull();
  });

  it('4: parámetros inválidos por el store dan un mensaje sin marcadores sin rellenar', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    store().dismissAllToasts();
    const r = await store().addMagnetPocket({ hostId: host.id, params: { ...MAGNET_DEFAULTS, clearanceMm: 0.7 }, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(r).toBeNull();
    const text = store().toasts.map((x) => x.text).join(' | ');
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).toContain('0.7');
  });

  it('5: imán oculto cuya tapa se abre avisa del trozo suelto y recomienda el modo abierto', async () => {
    const ball = (await store().createPrimitive('sphere', { radius: 5, segments: 64 }, { position: [0, 0, 0] }))!;
    const hit = pickFace(worldOf(ball), [0.1, 40, 0.1], [0, -1, 0]);
    const placed = await store().addMagnetPocket({ hostId: ball.id, params: { ...MAGNET_DEFAULTS, hidden: true }, point: hit.point, normal: hit.normal });
    expect(placed).not.toBeNull();
    const text = magnetWarnings(placed!.wall, 'es').map((w) => magnetWarningText(w, 'es')).join(' ');
    expect(text).toMatch(/quedará a la vista/);
    expect(text).toMatch(/suelto/);
    expect(text).toMatch(/abierto/);
  });

  it('6: un imán más ancho que la cara (sale por lados opuestos) no se coloca', async () => {
    const box = (await store().createPrimitive('box', { width: 8, height: 8, depth: 8 }, { position: [0, 0, 0] }))!;
    const count = store().objects.length;
    store().dismissAllToasts();
    const r = await store().addMagnetPocket({
      hostId: box.id, params: { ...MAGNET_DEFAULTS, sizeMm: 60, heightMm: 0.5 }, point: [0, 8, 0], normal: [0, 1, 0],
    });
    expect(r).toBeNull();
    expect(store().objects).toHaveLength(count);
    expect(store().toasts.some((x) => /más grande que la pieza/.test(x.text))).toBe(true);
  });

  it('7: si el hueco se asoma por el borde de un cubo no se avisa de curva', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    let checked = 0;
    for (const x of [15, 15.4, 14.6, 13.5]) {
      const placed = await store().addMagnetPocket({ hostId: box.id, params: MAGNET_DEFAULTS, point: [x, 30, 0], normal: [0, 1, 0] });
      if (!placed || !placed.wall.through) continue;
      checked += 1;
      expect(magnetWarnings(placed.wall, 'es').map((w) => w.kind)).not.toContain('protrude');
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('8: un solo aviso corto por colocación, sin el texto largo de «aplicar restas»', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    store().dismissAllToasts();
    store().clearToastHistory();
    await placeMagnetAt(host.id, [14, 30, 0], [0, 1, 0]);
    expect(store().toasts).toHaveLength(1);
    const text = store().toasts[0].text;
    expect(text).toContain('Imán 5 × 2');
    expect(text).not.toMatch(/Aplicar restas/);
    expect(text.length).toBeLessThan(90);
    expect(store().toastHistory).toHaveLength(1);
  });
});
