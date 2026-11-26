/**
 * @file src/store/__tests__/busHeadlessDefaults.test.ts
 * @description Paridad Command Bus ↔ motor headless del MCP en lo que antes divergía: `create_primitive`
 * con `rotation` y `scale` (ejes del usuario, Z = altura) da la misma caja de mundo; `plane_cut` sin
 * parámetros de conector usa los mismos valores por defecto (`OPERATION_DEFAULTS.cut`); y `paint_object`
 * del objeto entero deja el mismo color base en los dos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { toUserBox } from '../../core/scene/displayAxes';
import { applyTransformToMesh } from '../../engine';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { parsePlaneCut } from '../commandSchemas';
import type { KuraCommandRequest, SceneObject, Vec3 } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

type HeadlessObj = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale' | 'color'>;
interface HeadlessLike {
  createPrimitive(input: Record<string, unknown>): Promise<{ id: string }>;
  getObject(id: string): HeadlessObj;
  planeCut(id: string, o: Record<string, unknown>): Promise<{ parts: Array<{ id: string }> }>;
  paintObject(id: string, color: string): unknown;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'par', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

const round = (n: number) => Math.round(n * 100) / 100;
function userSize(o: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): number[] {
  const p = applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale).positions;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  const b = toUserBox({ min, max });
  return [0, 1, 2].map((a) => round(b.max[a] - b.min[a]));
}

describe('paridad bus ↔ headless', () => {
  beforeEach(() => resetStore());

  it('create_primitive aplica rotation y scale en ejes del usuario igual que el headless', async () => {
    const params = { type: 'box', width: 10, depth: 20, height: 30, rotation: [0, 0, 90], scale: [2, 1, 1], placement: 'origin' };
    const res = await run('create_primitive', params);
    expect(res.ok).toBe(true);
    const id = (res.result as { id: string }).id;
    const app = store().objects.find((o) => o.id === id)!;
    const h = await newHeadless();
    const hid = (await h.createPrimitive({ primitiveType: 'box', params: { width: 10, depth: 20, height: 30 }, rotation: [0, 0, 90], scale: [2, 1, 1], placement: 'origin' })).id;
    const head = h.getObject(hid);
    expect(userSize(app)).toEqual(userSize(head));
    // Escala ×2 en X del usuario y giro de 90° en torno a Z (altura): X ↔ Y, la altura no cambia
    expect(userSize(app)[2]).toBeCloseTo(30, 1);
    expect(app.scale).toEqual(head.scale);
    expect(app.rotation.map(round)).toEqual(head.rotation.map(round));
  }, 60_000);

  it('plane_cut sin parámetros de conector usa los valores por defecto compartidos', async () => {
    const box = await addBox(40);
    const { options } = parsePlaneCut({ objects: store().objects, selectedIds: [] } as never, { id: box.id });
    const d = OPERATION_DEFAULTS.cut;
    expect(options).toMatchObject({
      connectorType: d.connectorType, connectorSize: d.connectorSize, connectorDepth: d.connectorDepth,
      tolerance: d.tolerance, connectorCount: d.connectorCount,
    });
    // El esquema MCP (`kura_plane_cut`) usa los mismos valores: `mcp-server/src/__tests__/toolDefaultParity.test.ts`.
  });

  it('paint_object del objeto entero deja el mismo color base en la app y en el headless', async () => {
    const res = await run('create_primitive', { type: 'box', placement: 'origin', color: '#112233' });
    const id = (res.result as { id: string }).id;
    expect((await run('paint_object', { id, color: '#ff0000' })).ok).toBe(true);
    const app = store().objects.find((o) => o.id === id)!;
    const h = await newHeadless();
    const hid = (await h.createPrimitive({ primitiveType: 'box', color: '#112233', placement: 'origin' })).id;
    h.paintObject(hid, '#ff0000');
    expect(app.color.toLowerCase()).toBe(h.getObject(hid).color.toLowerCase());
    expect(app.color.toLowerCase()).toBe(OPERATION_DEFAULTS.paint.wholeSetsBaseColor ? '#ff0000' : '#112233');
  }, 60_000);
});
