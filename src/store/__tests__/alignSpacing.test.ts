/**
 * @file src/store/__tests__/alignSpacing.test.ts
 * @description `align_objects` con `spacingMm`: en modos de alineación se acepta y se ignora
 * (`ignoredParams`); en `arrange_grid` solo vale el paso fijo del motor (otro valor: invalid-params).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (params: Record<string, unknown>) =>
  store().executeCommand({ id: 'al', command: 'align_objects' as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('align_objects con spacingMm', () => {
  beforeEach(() => resetStore());

  it('minZ acepta spacingMm y lo informa como ignorado', async () => {
    const a = await addBox(10);
    const b = await addBox(10);
    const res = await run({ objectIds: [a.id, b.id], mode: 'minZ', spacingMm: 20 });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect((res.result as { ignoredParams?: string[] }).ignoredParams).toEqual(['spacingMm']);
  });

  it('arrange_grid rechaza un paso distinto del fijo y acepta el fijo', async () => {
    const a = await addBox(10);
    const b = await addBox(10);
    const bad = await run({ objectIds: [a.id, b.id], mode: 'arrange_grid', spacingMm: 20 });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe('invalid-params');
    const ok = await run({ objectIds: [a.id, b.id], mode: 'arrange_grid', spacingMm: 8 });
    expect(ok.ok).toBe(true);
    expect((ok.result as { ignoredParams?: string[] }).ignoredParams).toBeUndefined();
  });
});
