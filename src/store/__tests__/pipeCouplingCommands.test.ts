/**
 * @file src/store/__tests__/pipeCouplingCommands.test.ts
 * @description Bus del acople de tubería: `create_pipe_coupling` es escritura, agrega macho + hembra en UN paso de
 * deshacer con la procedencia de la receta (editable con el asistente) y la verificación; la holgura llega al campo de
 * la unión elegida; valores fuera de rango, de tipo o desconocidos son errores tipados y no dejan nada en la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isReadCommand } from '../../core/commands/commandPolicy';
import { resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'p', command: command as 'run_recipe', params });

describe('bus: acople de tubería', () => {
  beforeEach(() => resetStore('es'));

  it('política: crear es escritura', () => {
    expect(isReadCommand('create_pipe_coupling')).toBe(false);
  });

  it('roscado: macho y hembra en UN paso, con procedencia y verificación', async () => {
    const pastBefore = store().past.length;
    const res = await run('create_pipe_coupling', { boreDiameterMm: 16, wallMm: 1.6 });
    expect(res.ok, res.error).toBe(true);
    const out = res.result as { objects: { name: string }[]; fit: { status: string; joint: string; minClearanceMm: number } };
    expect(out.objects.map((o) => o.name)).toEqual(['Acople macho', 'Acople hembra']);
    expect(out.fit.status).toBe('ok');
    expect(out.fit.joint).toBe('thread');
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().objects).toHaveLength(2);
    expect(store().objects[0].metadata?.recipe?.id).toBe('kura.acople-tuberia');
    expect(store().objects[0].metadata?.recipe?.answers).toMatchObject({ boreDiameterMm: 16, wallMm: 1.6 });
    // Un deshacer quita las dos mitades.
    store().undo();
    expect(store().objects).toHaveLength(0);
  }, 30_000);

  it('a presión: la holgura pedida es la que se mide', async () => {
    const res = await run('create_pipe_coupling', { joint: 'press', clearanceMm: 0.25, engageMm: 12 });
    expect(res.ok, res.error).toBe(true);
    const out = res.result as { fit: { status: string; joint: string; minClearanceMm: number } };
    expect(out.fit.joint).toBe('press');
    expect(out.fit.minClearanceMm).toBeCloseTo(0.25, 1);
    expect(store().objects[0].metadata?.recipe?.answers).toMatchObject({ joint: 'press', pressClearanceMm: 0.25, engageMm: 12 });
  }, 30_000);

  it.each([
    [{ boreDiameterMm: 500 }],
    [{ wallMm: '2' }],
    [{ joint: 'glue' }],
    [{ starts: 2.5 }],
    [{ clearanceMm: -0.1 }],
  ])('%j: error tipado y escena intacta', async (params) => {
    const res = await run('create_pipe_coupling', params);
    expect(res.ok).toBe(false);
    expect(store().objects).toHaveLength(0);
  });
});
