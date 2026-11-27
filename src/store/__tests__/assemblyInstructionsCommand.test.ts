/**
 * @file src/store/__tests__/assemblyInstructionsCommand.test.ts
 * @description Comando de solo lectura `get_assembly_instructions` del bus sobre una división real: pasos en ejes del
 * usuario con frase en inglés, lista de materiales con los tarugos sueltos del grupo, la escena no cambia, política de
 * lectura y errores tipados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isReadCommand, toolAccess } from '../../core/commands/commandPolicy';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_ai', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

interface Out {
  groupId: string;
  model: string;
  steps: Array<{ index: number; code: string; base: boolean; text: string; direction: { axis: string } | null; joins: Array<{ method: string; count: number }> }>;
  materials: { printedParts: number; looseDowels: Array<{ count: number }>; text: string[] };
}

describe('get_assembly_instructions', () => {
  beforeEach(() => resetStore());

  it('devuelve pasos y materiales de una división en dos piezas sin cambiar la escena', async () => {
    expect(isReadCommand('get_assembly_instructions')).toBe(true);
    expect(toolAccess('kura_get_assembly_instructions')).toBe('read');
    const box = await addBox(300);
    const split = await run('split_for_bed', { id: box.id, bedWidthMm: 400, bedDepthMm: 400, bedHeightMm: 200, connectorType: 'loose-dowel', connectorSize: 3, connectorDepth: 6, connectorCount: 1 });
    expect(split.ok).toBe(true);
    const before = JSON.stringify(store().objects.map((o) => [o.id, o.position, o.rotation]));
    const res = await run('get_assembly_instructions', { groupId: box.id });
    expect(res.ok).toBe(true);
    const out = res.result as Out;
    expect(out.groupId).toBe(box.id);
    expect(out.steps).toHaveLength(2);
    expect(out.steps[0]).toMatchObject({ index: 1, base: true, direction: null });
    expect(out.steps[0].text).toMatch(/^Place .+ as the base/);
    // La caja de 300 mm de alto en una cama de 200: el corte es horizontal y la pieza de arriba baja (−Z del usuario).
    expect(out.steps[1].direction?.axis).toBe('-z');
    expect(out.steps[1].joins[0].method).toBe('loose-dowel');
    expect(out.steps[1].text).toMatch(/^Join .+ by its bottom face: \d+ loose dowels? of/);
    expect(out.materials.printedParts).toBe(2);
    expect(out.materials.looseDowels).toHaveLength(1);
    expect(out.materials.text[0]).toMatch(/^2 printed parts: /);
    expect(JSON.stringify(store().objects.map((o) => [o.id, o.position, o.rotation]))).toBe(before);
  }, 60_000);

  it('tipa los errores', async () => {
    const box = await addBox(20);
    expect((await run('get_assembly_instructions', {})).errorCode).toBe('invalid-params');
    expect((await run('get_assembly_instructions', { groupId: 'nada' })).errorCode).toBe('not-found');
    expect((await run('get_assembly_instructions', { ids: [box.id] })).errorCode).toBe('precondition');
  });
});
