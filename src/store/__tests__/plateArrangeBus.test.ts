/**
 * @file src/store/__tests__/plateArrangeBus.test.ts
 * @description Comando `arrange_on_plates`: con `dryRun` no cambia escena, placas ni historial y devuelve el plan;
 * sin él aplica en un paso de deshacer; valida parámetros e ids; es de escritura (no corre en solo lectura).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { COMMAND_ACCESS } from '../../core/commands/commandPolicy';
import type { CommandBusResponse } from '../commandBus';
import type { KuraCommandRequest } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const run = async (params: Record<string, unknown>) =>
  (await store().executeCommand({ id: 'a', command: 'arrange_on_plates' as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

type Result = { dryRun: boolean; placed: string[]; platesUsed: string[]; platesCreated: number; unplaced: unknown[]; assignments: Array<{ id: string; plate: string | null }> };

describe('Command Bus: arrange_on_plates', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', customBedDimensions: { width: 200, depth: 200, height: 200 } });
    for (let i = 0; i < 3; i++) await addBox(120, [i * 10, 0, 0]);
  });

  it('dryRun no cambia nada y devuelve el plan', async () => {
    const before = { objects: store().objects, plates: store().plates, past: store().past.length };
    const res = await run({ dryRun: true, criterion: 'compact', spacingMm: 3, marginMm: 2 });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.dryRun).toBe(true);
    expect(r.placed).toHaveLength(3);
    expect(r.platesCreated).toBe(3);
    expect(r.assignments.map((a) => a.plate)).toEqual(['implicit', 'new:0', 'new:1']);
    expect(store().objects).toBe(before.objects);
    expect(store().plates).toBe(before.plates);
    expect(store().past.length).toBe(before.past);
  });

  it('sin dryRun aplica en un paso de deshacer', async () => {
    const past = store().past.length;
    const res = await run({});
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.dryRun).toBe(false);
    expect(store().plates).toHaveLength(3);
    expect(r.platesUsed.every((id) => store().plates.some((p) => p.id === id))).toBe(true);
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(store().plates).toEqual([]);
  });

  it('valida parámetros, ids y placas', async () => {
    expect((await run({ criterion: 'random' })).ok).toBe(false);
    expect((await run({ spacingMm: -1 })).ok).toBe(false);
    expect((await run({ orient: 'sideways' })).ok).toBe(false);
    const missing = await run({ ids: ['nope'] });
    expect(missing.ok).toBe(false);
    expect(missing.errorCode).toBe('not-found');
    const plate = await run({ plateIds: ['nope'] });
    expect(plate.errorCode).toBe('not-found');
  });

  it('es un comando de escritura', () => {
    expect(COMMAND_ACCESS.arrange_on_plates).toBe('write');
  });
});
