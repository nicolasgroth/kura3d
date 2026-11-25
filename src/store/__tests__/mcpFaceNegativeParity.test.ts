/**
 * @file src/store/__tests__/mcpFaceNegativeParity.test.ts
 * @description Paridad Command Bus de la app ↔ MCP sin interfaz de `add_keyhole` y `add_cable_pass`, con el motor
 * real y los mismos parámetros: mismo informe, mismo lugar relativo a la pieza, un paso de deshacer en la app, y el
 * mismo bloqueo tipado (`addon-blocked`, `notRetained`) para el ojo en un cubo de 10 mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';
import type { KuraCommandRequest, SceneObject, Vec3 } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { byId, resetMagnetStore, store } from './magnetTestKit';

type Params = Record<string, unknown>;
interface HeadlessLike {
  createPrimitive(input: Params): Promise<{ id: string }>;
  getObject(id: string): SceneObject;
  addKeyhole(p: Params): Promise<any>;
  addCablePass(p: Params): Promise<any>;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

const run = (command: string, params: Params) =>
  store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

async function bus(command: string, params: Params): Promise<any> {
  const res = await run(command, params);
  expect(res.ok, `${command}: ${res.error}`).toBe(true);
  return res.result;
}

async function boxBoth(h: HeadlessLike, size: { width: number; depth: number; height: number }) {
  const app = await bus('create_primitive', { type: 'box', ...size, placement: 'origin' });
  const head = await h.createPrimitive({ primitiveType: 'box', params: size, placement: 'origin' });
  return { app: app.id as string, head: head.id };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const expectVec = (a: readonly number[], b: readonly number[], digits = 5) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
const strip = <T extends Record<string, unknown>>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

describe('paridad app ↔ sin interfaz: ojo de cerradura y paso de cable', () => {
  beforeEach(async () => {
    await resetMagnetStore();
    useKuraStore.setState({ language: 'en' });
  });

  it('add_keyhole: mismo informe y lugar; un paso de deshacer', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 60, depth: 10, height: 60 });
    const params = { face: 'back', screwMm: 4 };
    const steps = store().past.length;
    const a = await bus('add_keyhole', { hostId: host.app, ...params });
    const b = await h.addKeyhole({ hostId: host.head, ...params });
    expect(store().past.length).toBe(steps + 1);
    expect(strip(a, 'id', 'hostId', 'placement')).toEqual(strip(b, 'id', 'hostId', 'placement'));
    expect(a.report.retentionMm3).toBeGreaterThan(20);
    expect(a.params).toMatchObject({ screwMm: 4, headDiameterMm: 8.5 });
    expectVec(sub(byId(a.id).position, byId(host.app).position), sub(h.getObject(b.id).position, h.getObject(host.head).position));
    expectVec(byId(a.id).rotation, h.getObject(b.id).rotation);
  }, 60_000);

  it('add_keyhole en un cubo de 10 mm: addon-blocked notRetained en los dos caminos', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 10, depth: 10, height: 10 });
    const res = await run('add_keyhole', { hostId: host.app, face: 'back' });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('addon-blocked');
    expect(res.error).toMatch(/lip/);
    await expect(h.addKeyhole({ hostId: host.head, face: 'back' })).rejects.toMatchObject({ code: 'addon-blocked', params: { reason: 'notRetained' } });
  }, 60_000);

  it('add_cable_pass: mismo informe y lugar (ranura con profundidad medida)', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 40, depth: 30, height: 6 });
    const params = { face: 'top', shape: 'slot', widthMm: 4, lengthMm: 10 };
    const a = await bus('add_cable_pass', { hostId: host.app, ...params });
    const b = await h.addCablePass({ hostId: host.head, ...params });
    expect(strip(a, 'id', 'hostId', 'placement')).toEqual(strip(b, 'id', 'hostId', 'placement'));
    expect(a.report.through).toBe(true);
    expect(a.report.boreMm).toBeCloseTo(6, 3);
    expectVec(sub(byId(a.id).position, byId(host.app).position), sub(h.getObject(b.id).position, h.getObject(host.head).position));
  }, 60_000);

  it('parámetros inválidos: invalid-params (cuello no más angosto que la cabeza)', async () => {
    const host = await bus('create_primitive', { type: 'box', width: 60, depth: 10, height: 60, placement: 'origin' });
    const res = await run('add_keyhole', { hostId: host.id, face: 'back', headDiameterMm: 6, neckWidthMm: 6 });
    expect(res.errorCode).toBe('invalid-params');
  });
});
