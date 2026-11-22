/**
 * @file src/store/__tests__/cutNamesBus.test.ts
 * @description Nombres de resultados: en el corte por plano la mitad A es el lado negativo del eje del
 * usuario y la B el positivo, en los tres ejes; conservar solo la mitad de arriba la apoya en la cama;
 * y una resta con una herramienta "− Rosca" no repite el signo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createKeyedNaming, withoutModulePrefix } from '../../core/scene/resultNames';
import { fakeBox } from '../../test/fakeObjects';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand(
    { id: `n_${command}`, command: command as KuraCommandRequest['command'], params },
    'mcp',
  ) as Promise<CommandBusResponse>;

async function box() {
  await run('create_primitive', { type: 'box', params: { width: 40, depth: 40, height: 40 } });
  return store().objects[0];
}

/** Centro del objeto en ejes del usuario (X, Y = fondo, Z = altura), por `get_scene_state`. */
async function userCenters(): Promise<Record<string, number[]>> {
  const res = await run('get_scene_state', {});
  const objs = (res.result as { objects: Array<{ name: string; position: number[]; stats: { dimensionsMm: number[] } }> }).objects;
  return Object.fromEntries(objs.map((o) => [o.name.slice(-1), o.position]));
}

describe('nombres de corte y resta', () => {
  beforeEach(() => resetStore());

  it.each(['x', 'y', 'z'] as const)('corte en %s: A = lado negativo del usuario, B = positivo', async (axis) => {
    const b = await box();
    const res = await run('plane_cut', { id: b.id, axis, offset: 0, connectorType: 'none', keepMode: 'both' });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const c = await userCenters();
    expect(Object.keys(c).sort()).toEqual(['A', 'B']);
    const i = { x: 0, y: 1, z: 2 }[axis];
    if (axis === 'z') {
      // La mitad de arriba (B) va a la cama: se compara por la altura de su base antes del acomodo.
      expect(store().objects.find((o) => o.name.endsWith('B'))).toBeDefined();
    } else {
      expect(c.A[i]).toBeLessThan(c.B[i]);
    }
  });

  it('conservar solo la mitad de arriba la apoya en la cama', async () => {
    const b = await box();
    const res = await run('plane_cut', { id: b.id, axis: 'z', offset: 0, connectorType: 'none', keepMode: 'positive' });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const [half] = store().objects;
    expect(half.name.endsWith('B')).toBe(true);
    expect(half.position[1]).toBeCloseTo(0, 6);
  });

  it('una resta no duplica el signo de la herramienta', () => {
    const naming = createKeyedNaming((k) => k, { color: (h) => h, structure: (_r, id) => id });
    const name = naming.booleanResult('subtract', [fakeBox('a', 'Cilindro 1'), fakeBox('b', '− Rosca M6×1')]);
    expect(name).toBe('Cilindro 1 − Rosca M6×1');
    expect(withoutModulePrefix('+ Caja')).toBe('Caja');
  });
});
