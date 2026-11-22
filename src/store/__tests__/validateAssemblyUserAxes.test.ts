/**
 * @file src/store/__tests__/validateAssemblyUserAxes.test.ts
 * @description El bus devuelve `split_for_bed` y `validate_assembly` en ejes del usuario (Z = altura):
 * un cubo alto partido en horizontal da planos y uniones en `'z'`, caras de unión `±z` y la segunda pieza
 * entra bajando (`'-z'`), no con la dirección interna `'-y'`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_vau', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('split_for_bed y validate_assembly con ejes del usuario', () => {
  beforeEach(() => resetStore());

  it('corte horizontal: eje z, caras ±z y la pieza de arriba entra en -z', async () => {
    const box = await addBox(300);
    const split = await run('split_for_bed', { id: box.id, bedWidthMm: 400, bedDepthMm: 400, bedHeightMm: 200, connectorType: 'dowel', connectorCount: 1 });
    expect(split.ok).toBe(true);
    const out = split.result as {
      plan: { planes: { axis: string }[] };
      joints: { axis: string; a: { face?: string }; b: { face?: string } }[];
    };
    expect(out.plan.planes.map((p) => p.axis)).toEqual(['z']);
    expect(out.joints).toHaveLength(1);
    expect(out.joints[0].axis).toBe('z');
    expect([out.joints[0].a.face, out.joints[0].b.face].sort()).toEqual(['+z', '-z']);

    const v = await run('validate_assembly', { groupId: box.id });
    expect(v.ok).toBe(true);
    const order = (v.result as { order: { step: number; direction: string }[] }).order;
    expect(order).toHaveLength(2);
    expect(order[1].direction).toBe('-z');
  }, 60_000);
});
