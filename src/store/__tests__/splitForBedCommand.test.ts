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
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_split', command: 'split_for_bed' as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('split_for_bed', () => {
  beforeEach(() => resetStore());

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
