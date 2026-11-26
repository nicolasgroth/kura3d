/**
 * @file src/store/__tests__/screwFitCommands.test.ts
 * @description Bus de roscas que enroscan: política (crear es escritura, comprobar es lectura), `create_screw_container`
 * agrega cuerpo + tapa en UN paso de deshacer con la procedencia de la receta (editable con el asistente) y el resultado
 * del enroscado; `create_thread_pair` crea la pareja lado a lado sin solaparse; `check_screw_fit` rechaza ids repetidos o
 * desconocidos y avance fuera de rango sin tocar la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isReadCommand } from '../../core/commands/commandPolicy';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 's', command: command as 'run_recipe', params });

describe('bus: roscas que enroscan', () => {
  beforeEach(() => resetStore('es'));

  it('política: crear es escritura; comprobar, lectura', () => {
    expect(isReadCommand('check_screw_fit')).toBe(true);
    expect(isReadCommand('create_screw_container')).toBe(false);
    expect(isReadCommand('create_thread_pair')).toBe(false);
  });

  it('create_screw_container: cuerpo y tapa en UN paso, con procedencia y enroscado', async () => {
    const pastBefore = store().past.length;
    const res = await run('create_screw_container', { innerDiameterMm: 40, innerHeightMm: 30 });
    expect(res.ok, res.error).toBe(true);
    const out = res.result as { objects: { id: string; name: string }[]; screwFit: { status: string; minClearanceMm: number } };
    expect(out.objects.map((o) => o.name)).toEqual(['Recipiente', 'Tapa roscada']);
    expect(out.screwFit.status).toBe('ok');
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().objects[0].metadata?.recipe?.id).toBe('kura.tapa-roscada');
    expect(store().objects[0].metadata?.recipe?.answers).toMatchObject({ innerDiameterMm: 40, innerHeightMm: 30 });
  }, 30_000);

  it('create_screw_container: valor fuera de rango es error tipado y no deja nada', async () => {
    const res = await run('create_screw_container', { pitchMm: 50 });
    expect(res.ok).toBe(false);
    expect(store().objects).toHaveLength(0);
  });

  it('create_thread_pair: perno + tuerca lado a lado, con enroscado', async () => {
    const res = await run('create_thread_pair', { pair: 'bolt-nut', diameterMm: 8 });
    expect(res.ok, res.error).toBe(true);
    const out = res.result as { objects: { id: string }[]; screwFit: { status: string } };
    expect(out.objects).toHaveLength(2);
    expect(out.screwFit.status).toBe('ok');
    const [a, b] = store().objects;
    expect(Math.abs(a.position[0] - b.position[0])).toBeGreaterThan(8);
  }, 30_000);

  it('check_screw_fit: mismo objeto, id desconocido o avance inválido son errores', async () => {
    const box = await addBox(10);
    const other = await addBox(10);
    expect((await run('check_screw_fit', { maleId: box.id, femaleId: box.id, leadMm: 4 })).ok).toBe(false);
    expect((await run('check_screw_fit', { maleId: box.id, femaleId: 'nada', leadMm: 4 })).ok).toBe(false);
    expect((await run('check_screw_fit', { maleId: box.id, femaleId: other.id, leadMm: 0 })).ok).toBe(false);
    expect((await run('check_screw_fit', { maleId: box.id, femaleId: other.id })).ok).toBe(false);
  });
});
