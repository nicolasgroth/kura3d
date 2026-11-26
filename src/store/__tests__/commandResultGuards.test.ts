/**
 * @file src/store/__tests__/commandResultGuards.test.ts
 * @description Resultados vacíos o sin efecto nunca se aceptan como "ok": simplificar hasta vaciar,
 * cortar con el plano fuera o en el borde, comando desconocido desde MCP en solo lectura, separar
 * por color con piezas abiertas (aviso) y rangos únicos rechazados con `invalid-params`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeMeshStats, splitMeshByColorSolid } from '../../engine';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>, source: 'mcp' | 'ui' = 'mcp') =>
  store().executeCommand(
    { id: `g_${command}`, command: command as KuraCommandRequest['command'], params },
    source,
  ) as Promise<CommandBusResponse>;

describe('guardas de resultado del Command Bus', () => {
  beforeEach(() => resetStore());

  it('simplify_mesh que vaciaría la malla devuelve MESH_EMPTY y deja el objeto intacto', async () => {
    const box = await addBox(10);
    const before = byId(box.id)!.mesh;
    const res = await run('simplify_mesh', { id: box.id, toleranceMm: 100 });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('MESH_EMPTY');
    expect(byId(box.id)!.mesh).toBe(before);
    expect(byId(box.id)!.stats.triangles).toBe(12);
  });

  it.each([
    ['fuera del objeto', { axis: 'x', offset: 50 }],
    ['en el borde exacto', { axis: 'y', offset: 5 }],
    ['fuera por el lado negativo', { axis: 'z', offset: -6, keepMode: 'positive' }],
  ])('plane_cut con el plano %s da CUT_PLANE_OUTSIDE y no cambia la escena', async (_n, extra) => {
    const box = await addBox(10);
    const res = await run('plane_cut', { id: box.id, connectorType: 'none', ...extra });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('CUT_PLANE_OUTSIDE');
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
  });

  it('plane_cut dentro del objeto sigue cortando en dos piezas', async () => {
    const box = await addBox(10);
    const res = await run('plane_cut', { id: box.id, axis: 'x', offset: 1, connectorType: 'none' });
    expect(res.ok).toBe(true);
    expect(store().objects).toHaveLength(2);
  });

  it('un comando desconocido desde MCP es unknown-command también en solo lectura', async () => {
    useKuraStore.setState({ mcpConfig: { ...store().mcpConfig, readOnly: true } });
    const res = await run('format_disk', {});
    expect(res.errorCode).toBe('unknown-command');
    const write = await run('delete_object', { id: 'x' });
    expect(write.errorCode).toBe('read-only');
    useKuraStore.setState({ mcpConfig: { ...store().mcpConfig, readOnly: false } });
  });

  it.each([
    ['transform escala 0', 'transform_object', { scale: [0, 1, 1] }],
    ['transform posición 1e6', 'transform_object', { position: [1e6, 0, 0] }],
    ['hollow pared 0.1 (motor ≥ 0.2)', 'hollow_object', { wallThickness: 0.1 }],
    ['mold wallMargin 1 (motor ≥ 1.5)', 'generate_mold', { mode: 'direct_2part', wallMarginMm: 1 }],
    ['mold keyTolerance 0 (motor ≥ 0.05)', 'generate_mold', { mode: 'direct_2part', keyToleranceMm: 0 }],
    ['rosca M100 (motor ≤ 64)', 'create_thread', { kind: 'bolt', diameterMm: 100 }],
    ['corte 9 conectores', 'plane_cut', { axis: 'x', connectorCount: 9 }],
  ])('%s: invalid-params sin tocar la escena', async (_n, command, extra) => {
    const box = await addBox(10);
    const res = await run(command, { id: box.id, ...extra });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('invalid-params');
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
  });

  it('separar por color entrega sólidos cerrados sin avisos (antes: SPLIT_COLOR_NON_MANIFOLD)', async () => {
    const box = await addBox(10);
    const obj = byId(box.id)!;
    const tris = obj.mesh.indices.length / 3;
    const painted = {
      ...obj,
      mesh: { ...obj.mesh, faceColors: Array.from({ length: tris }, (_, i) => (i < 2 ? '#ff0000' : '#00ff00')) },
    };
    const { parts, warnings } = await splitMeshByColorSolid(painted);
    expect(parts).toHaveLength(2);
    expect(warnings).toEqual([]);
    for (const part of parts) expect(computeMeshStats(part.mesh).isManifold).toBe(true);
    // Un objeto de un solo color sale entero, sin avisos.
    const single = await splitMeshByColorSolid(obj);
    expect(single.parts).toHaveLength(1);
    expect(single.warnings).toEqual([]);
  });
});
