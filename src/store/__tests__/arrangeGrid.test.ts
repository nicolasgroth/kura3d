/**
 * @file src/store/__tests__/arrangeGrid.test.ts
 * @description Pruebas de `arrange_grid`: los huecos se mueven con el sólido que perforan (aunque no
 * estén seleccionados), las piezas no se solapan y se avisa cuando la distribución no cabe en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeArrangeLayout } from '../../engine/alignment';
import { DEFAULT_PRINTER_PROFILES, type PrinterProfile, type Vec3 } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const delta = (a: Vec3, b: Vec3) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];

describe('arrange_grid', () => {
  beforeEach(() => resetStore());

  it('mueve cada hueco junto a su sólido y no por separado', async () => {
    const solid = await addBox(20, [60, 0, 60]);
    const hole = await addBox(6, [60, 4, 60], { role: 'negative' });
    const other = await addBox(15, [-70, 0, -40]);
    useKuraStore.setState({ selectedIds: [] });

    const before = { solid: byId(solid.id)!.position, hole: byId(hole.id)!.position };
    const result = store().alignSelectedObjects('arrange_grid');
    expect(result?.fitsBed).toBe(true);

    const dSolid = delta(before.solid, byId(solid.id)!.position);
    const dHole = delta(before.hole, byId(hole.id)!.position);
    dSolid.forEach((value, axis) => expect(dHole[axis]).toBeCloseTo(value, 6));
    expect(byId(other.id)!.position).not.toEqual([-70, 0, -40]);
  });

  it('con selección explícita arrastra también el hueco no seleccionado', async () => {
    const a = await addBox(20, [80, 0, 0]);
    const hole = await addBox(6, [80, 2, 0], { role: 'negative' });
    const b = await addBox(20, [-80, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    const holeBefore = byId(hole.id)!.position;
    const aBefore = byId(a.id)!.position;
    store().alignSelectedObjects('arrange_grid');
    const dA = delta(aBefore, byId(a.id)!.position);
    const dH = delta(holeBefore, byId(hole.id)!.position);
    dA.forEach((value, axis) => expect(dH[axis]).toBeCloseTo(value, 6));
  });

  it('avisa cuando la distribución no cabe en la cama', async () => {
    const tinyBed: PrinterProfile = { ...DEFAULT_PRINTER_PROFILES[0], bedWidthMm: 60, bedDepthMm: 60, maxHeightMm: 100 };
    useKuraStore.setState({ printerProfile: tinyBed });
    for (let i = 0; i < 6; i++) await addBox(40, [i * 50, 0, 0]);
    useKuraStore.setState({ selectedIds: [], toasts: [] });
    const result = store().alignSelectedObjects('arrange_grid');
    expect(result?.fitsBed).toBe(false);
    expect(store().toasts.some((t) => t.kind === 'error' && t.text.includes('60 × 60'))).toBe(true);
  });

  it('computeArrangeLayout deja huecos sueltos como pieza propia y sin solapes', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const loose = await addBox(8, [200, 0, 200], { role: 'negative' });
    const layout = computeArrangeLayout([byId(a.id)!, byId(loose.id)!], DEFAULT_PRINTER_PROFILES[0]);
    expect(Object.keys(layout.positions).sort()).toEqual([a.id, loose.id].sort());
    const [ax] = layout.positions[a.id];
    const [lx] = layout.positions[loose.id];
    expect(Math.abs(ax - lx)).toBeGreaterThanOrEqual((20 + 8) / 2 + 8 - 1e-6);
    expect(layout.fitsBed).toBe(true);
  });

  it('respeta el bus de comandos con objectIds', async () => {
    const a = await addBox(10, [90, 0, 0]);
    const b = await addBox(10, [-90, 0, 0]);
    const res = await store().executeCommand(
      { id: 'align', command: 'align_objects', params: { mode: 'minX', objectIds: [a.id, b.id] } },
      'mcp',
    );
    expect(res.ok).toBe(true);
    expect(byId(a.id)!.position[0]).toBeCloseTo(byId(b.id)!.position[0], 6);
  });
});
