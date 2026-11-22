/**
 * @file src/store/__tests__/colorSplitBus.test.ts
 * @description `split_by_color` por el Command Bus (el recorrido de la evaluación): caja 40×40×20
 * pintada en dos zonas con `paint_object` → tres sólidos cerrados que suman el volumen original,
 * sin solapes, con el color en el nombre; la profundidad se valida; y el 3MF conserva los colores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { exportSceneTo3MF } from '../../engine/io/threeMfExport';
import { read3MF } from '../../engine/io/threeMfImport';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand(
    { id: `c_${command}`, command: command as KuraCommandRequest['command'], params },
    'mcp',
  ) as Promise<CommandBusResponse>;

async function paintedBox() {
  const res = await run('create_primitive', { type: 'box', params: { width: 40, depth: 40, height: 20 }, color: '#ffffff' });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  const id = store().objects[0].id;
  expect((await run('paint_object', { id, color: '#ff0000', localPoint: [0, 0, 20] })).ok).toBe(true);
  expect((await run('paint_object', { id, color: '#0000ff', localPoint: [20, 0, 10] })).ok).toBe(true);
  return id;
}

describe('split_by_color en el bus', () => {
  beforeEach(() => resetStore());

  it('caja pintada en dos zonas: tres sólidos cerrados que suman 32000 mm³', async () => {
    const id = await paintedBox();
    const res = await run('split_by_color', { id });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const parts = store().objects;
    expect(parts.map((p) => p.color).sort()).toEqual(['#0000ff', '#ff0000', '#ffffff']);
    let sum = 0;
    for (const p of parts) {
      expect(p.stats.isManifold, p.name).toBe(true);
      expect(p.stats.volumeMm3).toBeGreaterThan(0);
      sum += p.stats.volumeMm3;
    }
    expect(Math.abs(sum - 32000) / 32000).toBeLessThan(0.001);
    // Nombre con el color (no el genérico "Parte n").
    expect(new Set(parts.map((p) => p.name)).size).toBe(3);

    // 3MF ida y vuelta: cada pieza conserva su color.
    const model = read3MF(exportSceneTo3MF(parts).slice().buffer as ArrayBuffer, 'c.3mf');
    expect(model.parts.map((p) => p.color?.toLowerCase()).sort()).toEqual(['#0000ff', '#ff0000', '#ffffff']);
  }, 60_000);

  it('la profundidad cambia la capa y fuera de rango es invalid-params sin tocar la escena', async () => {
    const id = await paintedBox();
    const bad = await run('split_by_color', { id, depthMm: 0 });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe('invalid-params');
    expect(store().objects).toHaveLength(1);
    expect((await run('split_by_color', { id, depthMm: 3 })).ok).toBe(true);
    const red = store().objects.find((o) => o.color === '#ff0000')!;
    // Con más profundidad la pieza del color es más gruesa (≈ 3 mm en Z).
    expect(red.stats.dimensionsMm[1]).toBeGreaterThan(2.5);
  }, 60_000);
});
