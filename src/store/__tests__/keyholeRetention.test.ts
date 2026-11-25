/**
 * @file src/store/__tests__/keyholeRetention.test.ts
 * @description El ojo de cerradura solo se coloca si el labio retiene la cabeza, con el motor real: en un cubo de
 * 10 mm (cara más chica que la ranura) no queda material sobre la cabeza en el extremo de la ranura y se bloquea con
 * el motivo tipado `notRetained`, sin paso de historial; en una placa de 60 mm el labio queda entero.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { KEYHOLE_DEFAULTS } from '../../core/addons/keyholePresets';
import { KEYHOLE_MIN_RETENTION_RATIO } from '../../core/operations/keyholeRetention';
import type { Vec3 } from '../../types/kura';
import { resetMagnetStore, store } from './magnetTestKit';

const P = KEYHOLE_DEFAULTS;
const BACK: Vec3 = [0, 0, 1];
const keyholes = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'keyhole');

describe('ojo de cerradura: retención de la cabeza', () => {
  beforeEach(resetMagnetStore);

  it('cubo de 10 mm: el labio no retiene; no se coloca y el motivo es notRetained', async () => {
    const cube = (await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { position: [0, 0, 0] }))!;
    const steps = store().past.length;
    let reason: string | null = null;
    const placed = await store().addKeyhole({ hostId: cube.id, params: P, point: [0, 5, 5], normal: BACK, onBlocked: (r) => { reason = r; } });
    expect(placed).toBeNull();
    expect(reason).toBe('notRetained');
    expect(keyholes()).toHaveLength(0);
    expect(store().past.length).toBe(steps);
    // Sin `onBlocked`, el aviso de error lo dice.
    await store().addKeyhole({ hostId: cube.id, params: P, point: [0, 5, 5], normal: BACK });
    expect(store().toasts.some((t) => t.kind === 'error' && /labio/.test(t.text))).toBe(true);
  });

  it('placa de 60 mm: el labio queda entero y el informe trae la retención', async () => {
    const plate = (await store().createPrimitive('box', { width: 60, height: 60, depth: 10 }, { position: [0, 0, 0] }))!;
    const placed = (await store().addKeyhole({ hostId: plate.id, params: P, point: [0, 30, 5], normal: BACK }))!;
    const { retentionMm3, retentionIdealMm3 } = placed.report;
    expect(retentionIdealMm3).toBeGreaterThan(20);
    expect(retentionMm3! / retentionIdealMm3!).toBeGreaterThan(0.99);
    expect(KEYHOLE_MIN_RETENTION_RATIO).toBe(0.6);
  });
});
