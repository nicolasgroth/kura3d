/**
 * @file src/store/__tests__/splitForBedCommand.test.ts
 * @description Comando `split_for_bed` del Command Bus: `dryRun` devuelve el plan sin cambiar la
 * escena, la ejecución reemplaza el objeto por piezas con `metadata.split`, rangos inválidos dan
 * `invalid-params` y el exceso de piezas llega como error tipado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { parseSplitForBed } from '../splitCommandSchemas';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_split', command: 'split_for_bed' as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('split_for_bed', () => {
  beforeEach(() => resetStore());

  it('el refuerzo de uniones débiles viene apagado por defecto y se enciende con reinforceWeakJoints', async () => {
    const box = await addBox(300);
    const req = (extra: Record<string, unknown> = {}) =>
      parseSplitForBed(store(), { id: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, ...extra });
    expect(req().execute.reinforceWeakJoints).toBe(OPERATION_DEFAULTS.split.reinforceWeakJoints);
    expect(req().execute.reinforceWeakJoints).toBe(false);
    expect(req({ reinforceWeakJoints: true }).execute.reinforceWeakJoints).toBe(true);
  });

  it('el tamaño del conector es automático por defecto; un número se respeta tal cual y un valor inválido es error', async () => {
    const box = await addBox(300);
    const req = (extra: Record<string, unknown> = {}) =>
      parseSplitForBed(store(), { id: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, ...extra });
    expect(OPERATION_DEFAULTS.split.connectorSize).toBe('auto');
    expect(req().execute.connector?.sizeAuto).toBe(true);
    expect(req({ connectorSize: 'auto' }).execute.connector?.sizeAuto).toBe(true);
    const fixed = req({ connectorSize: 6 }).execute.connector;
    expect(fixed?.size).toBe(6);
    expect(fixed?.sizeAuto).toBeUndefined();
    expect(() => req({ connectorSize: 'grande' })).toThrow();
    expect(req({ connectorType: 'none' }).execute.connector).toBeNull();
  });

  it('dryRun devuelve el plan sin tocar la escena; la ejecución deja piezas con metadata', async () => {
    const box = await addBox(300);
    const bed = { bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 };
    const dry = await run({ id: box.id, dryRun: true, ...bed });
    expect(dry.ok).toBe(true);
    const plan = (dry.result as { plan: { pieces: unknown[] } }).plan;
    expect(plan.pieces.length).toBe(8);
    expect(byId(box.id)).toBeDefined();
    const res = await run({ id: box.id, ...bed });
    expect(res.ok).toBe(true);
    expect(byId(box.id)).toBeUndefined();
    const parts = store().objects.filter((o) => o.metadata?.split?.groupId === box.id);
    expect(parts).toHaveLength(8);
    expect(parts.map((p) => p.metadata!.split!.code).sort()).toEqual(['A1a', 'A1b', 'A2a', 'A2b', 'B1a', 'B1b', 'B2a', 'B2b']);
  }, 60_000);

  it('valida rangos y tipa el exceso de piezas', async () => {
    const box = await addBox(300);
    expect((await run({ id: box.id, maxPieces: 0 })).errorCode).toBe('invalid-params');
    expect((await run({ id: box.id, labels: 'painted' })).errorCode).toBe('invalid-params');
    const tooMany = await run({ id: box.id, dryRun: true, bedWidthMm: 20, bedDepthMm: 20, bedHeightMm: 20, maxPieces: 8 });
    expect(tooMany.ok).toBe(false);
  });
});
