/**
 * @file src/store/__tests__/splitManualCutsCommand.test.ts
 * @description `split_for_bed` con cortes a mano (`cuts`): conversión de ejes del usuario a los del motor (eje,
 * signo de la posición y ángulos), rechazo estricto de entradas inválidas, `dryRun` con el plan a mano y el error
 * tipado de planos que se cruzan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseSplitForBed } from '../splitCommandSchemas';
import { internalCutToUser, userCutToInternal } from '../../core/scene/splitManualCutAxes';
import { cutNormal } from '../../engine/split/splitManualCuts';
import { fromUserVector } from '../../core/scene/displayAxes';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_split_manual', command: 'split_for_bed' as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;
const BED = { bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 };

describe('cortes a mano: ejes del usuario', () => {
  it('Y del usuario es −Z del motor: posición con signo y ángulos reordenados, con la misma normal', () => {
    const user = { axis: 'y' as const, positionMm: 10, tiltDeg: [5, -8] as [number, number] };
    const engine = userCutToInternal(user);
    expect(engine.axis).toBe('z');
    expect(engine.positionMm).toBe(-10);
    // Normal del usuario llevada al motor = normal del corte del motor (salvo signo)
    const nu = cutNormal('y', user.tiltDeg);
    const fromUser = fromUserVector([nu[0], nu[1], nu[2]]);
    const ne = cutNormal('z', engine.tiltDeg ?? [0, 0]);
    const dot = fromUser[0] * ne[0] + fromUser[1] * ne[1] + fromUser[2] * ne[2];
    expect(Math.abs(dot)).toBeCloseTo(1, 9);
    expect(internalCutToUser(engine)).toEqual(user);
  });

  it('acepta la lista válida y la pasa al plan en ejes del motor', async () => {
    const box = await addBox(300);
    const req = parseSplitForBed(store(), { id: box.id, ...BED, cuts: [{ axis: 'z', positionMm: 100 }, { axis: 'x', positionMm: 20, tiltDeg: [10, 0] }] });
    expect(req.plan.manualCuts).toEqual([
      { axis: 'y', positionMm: 100, tiltDeg: undefined },
      { axis: 'x', positionMm: 20, tiltDeg: [0, -10] },
    ]);
    expect(parseSplitForBed(store(), { id: box.id, ...BED }).plan.manualCuts).toBeUndefined();
  });

  it('rechaza entradas inválidas con invalid-params', async () => {
    const box = await addBox(300);
    const bad = [
      [],
      'x=10',
      [{ axis: 'w', positionMm: 0 }],
      [{ axis: 'x', positionMm: '10' }],
      [{ axis: 'x', positionMm: Number.NaN }],
      [{ axis: 'x', positionMm: 0, tiltDeg: [60, 0] }],
      [{ axis: 'x', positionMm: 0, tiltDeg: [10] }],
      [{ axis: 'x', positionMm: 0, color: 'red' }],
      Array.from({ length: 25 }, () => ({ axis: 'x', positionMm: 0 })),
    ];
    for (const cuts of bad) {
      expect(() => parseSplitForBed(store(), { id: box.id, ...BED, cuts })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    }
  });
});

describe('cortes a mano: comando', () => {
  beforeEach(() => resetStore());

  it('dryRun devuelve el plan a mano sin tocar la escena', async () => {
    const box = await addBox(300);
    const dry = await run({ id: box.id, dryRun: true, ...BED, connectorType: 'none', cuts: [{ axis: 'x', positionMm: -40 }, { axis: 'x', positionMm: 60 }, { axis: 'z', positionMm: 150 }] });
    expect(dry.ok).toBe(true);
    const plan = (dry.result as { plan: { manual?: boolean; planes: Array<{ axis: string; position: number }>; pieces: unknown[] } }).plan;
    expect(plan.manual).toBe(true);
    expect(plan.planes.map((p) => [p.axis, Math.round(p.position)])).toEqual([['x', -40], ['x', 60], ['z', 150]]);
    expect(plan.pieces).toHaveLength(6);
    expect(byId(box.id)).toBeDefined();
  });

  it('planos del mismo eje que se cruzan llegan como error tipado', async () => {
    const box = await addBox(300);
    const res = await run({ id: box.id, dryRun: true, ...BED, cuts: [{ axis: 'x', positionMm: 0, tiltDeg: [40, 0] }, { axis: 'x', positionMm: 20 }] });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).toContain('SPLIT_MANUAL_CUTS_CROSS');
  });
});
