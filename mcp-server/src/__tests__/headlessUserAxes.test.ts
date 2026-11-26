/**
 * @file mcp-server/src/__tests__/headlessUserAxes.test.ts
 * @description Paridad app ↔ MCP: el modo sin interfaz usa los ejes del usuario (X derecha, Y fondo,
 * Z arriba), igual que el Command Bus. Secuencia: cubo 10×20×30 → subir Z+10 → girar Z 90° → cortar por Z
 * → alinear abajo → dividir para la cama. Las expectativas se calculan con `displayAxes` (misma capa que
 * usa el bus) sobre la malla interna real, y se comparan con lo que devuelve cada herramienta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { fromUserVector, toUserBox } from '../../../src/core/scene/displayAxes';
import { applyTransformToMesh } from '../../../src/engine/index';
import type { Vec3 } from '../../../src/types/kura';
import { createKuraMcpServer } from '../index.js';
import type { KuraHeadlessEngine } from '../headlessEngine.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function session() {
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'axes', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    if (r.isError) throw new Error(text);
    return JSON.parse(text) as T;
  };
  return { call, headless };
}

interface Summary { id: string; position: Vec3; rotation: Vec3; scale: Vec3; stats: { dimensionsMm: Vec3 } }

/** Caja de mundo en ejes del usuario, medida sobre la malla interna real. */
function userWorldBox(headless: KuraHeadlessEngine, id: string) {
  const o = headless.getObject(id);
  const p = applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale).positions;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  return toUserBox({ min, max });
}

const close = (a: number[], b: number[], digits = 3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('MCP sin interfaz con ejes del usuario (paridad con el bus)', () => {
  it('cubo 10×20×30 → Z+10 → giro Z 90° → corte por Z → alinear abajo', async () => {
    const { call, headless } = await session();
    const box = await call<Summary>('kura_create_primitive', {
      primitiveType: 'box', params: { width: 10, depth: 20, height: 30 }, placement: 'origin',
    });
    // Ancho = X, fondo = Y, alto = Z del usuario.
    close(box.stats.dimensionsMm, [10, 20, 30]);
    // La posición devuelta es la del usuario: la interna es (x, z, −y).
    close(headless.getObject(box.id).position, fromUserVector(box.position));

    const up = await call<Summary>('kura_transform_object', { objectId: box.id, position: [box.position[0], box.position[1], box.position[2] + 10] });
    close(up.position, [box.position[0], box.position[1], box.position[2] + 10]);
    // Subir en Z del usuario es subir en Y interno.
    expect(headless.getObject(box.id).position[1]).toBeCloseTo(box.position[2] + 10, 6);

    const turned = await call<Summary>('kura_transform_object', { objectId: box.id, rotation: [0, 0, Math.PI / 2] });
    close(turned.rotation, [0, 0, Math.PI / 2], 6);
    // Girar en Z (vertical) intercambia ancho y fondo; la altura no cambia.
    close(turned.stats.dimensionsMm, [20, 10, 30]);
    const state = await call<{ objects: Summary[] }>('kura_get_scene_state', {});
    close(state.objects[0].stats.dimensionsMm, [20, 10, 30]);

    const beforeCut = userWorldBox(headless, box.id);
    const cut = await call<{ parts: Summary[] }>('kura_plane_cut', { objectId: box.id, axis: 'z', offset: 0, keepMode: 'both' });
    expect(cut.parts).toHaveLength(2);
    for (const part of cut.parts) close(part.stats.dimensionsMm, [20, 10, 15]);

    const aligned = await call<{ objects: Summary[]; mode: string }>('kura_align_objects', { objectIds: cut.parts.map((p) => p.id), mode: 'minZ' });
    expect(aligned.mode).toBe('minZ');
    const zMins = cut.parts.map((p) => userWorldBox(headless, p.id).min[2]);
    // "Abajo" = mismo Z mínimo para las dos mitades (el de la más baja).
    expect(zMins[0]).toBeCloseTo(zMins[1], 4);
    expect(Math.min(...zMins)).toBeCloseTo(beforeCut.min[2], 4);
  }, 60_000);

  it('corte por Y conserva la mitad del fondo con keepMode positive', async () => {
    const { call, headless } = await session();
    const box = await call<Summary>('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 20, height: 10 }, placement: 'origin' });
    const full = userWorldBox(headless, box.id);
    const cut = await call<{ parts: Summary[] }>('kura_plane_cut', { objectId: box.id, axis: 'y', offset: 5, keepMode: 'positive' });
    expect(cut.parts).toHaveLength(1);
    // Plano en Y = centro + 5 (fondo): la mitad + mide 5 mm de fondo, no 15.
    close(cut.parts[0].stats.dimensionsMm, [10, 5, 10]);
    expect(full.max[1] - full.min[1]).toBeCloseTo(20, 4);
  }, 60_000);

  it('dividir para la cama: plano, uniones, piezas y direcciones de armado en Z', async () => {
    const { call } = await session();
    const tall = await call<Summary>('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 300 }, placement: 'origin' });
    const res = await call<{
      plan: { planes: { axis: string }[]; counts: { x: number; y: number; z: number }; pieces: { sizeMm: Vec3 }[] };
      joints: { axis: string; a: { face?: string }; b: { face?: string } }[];
      parts: Summary[];
    }>('kura_split_for_bed', {
      objectId: tall.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'none', detail: true, axes: ['z'],
    });
    expect(res.plan.planes.map((p) => p.axis)).toEqual(['z']);
    expect(res.plan.counts).toEqual({ x: 1, y: 1, z: 2 });
    for (const piece of res.plan.pieces) expect(piece.sizeMm[2]).toBeLessThanOrEqual(200);
    expect(res.joints.map((j) => j.axis)).toEqual(['z']);
    expect([res.joints[0].a.face, res.joints[0].b.face].sort()).toEqual(['+z', '-z']);
    for (const part of res.parts) expect(part.stats.dimensionsMm[2]).toBeCloseTo(150, 0);

    const v = await call<{ order: { direction: string }[] }>('kura_validate_assembly', { groupId: tall.id });
    expect(v.order).toHaveLength(2);
    expect(v.order[1].direction).toBe('-z');
  }, 60_000);

  it('detectar estructuras, espejo, proyección y posición explícita en ejes del usuario', async () => {
    const { call, headless } = await session();
    const box = await call<Summary>('kura_create_primitive', {
      primitiveType: 'box', params: { width: 10, depth: 20, height: 30 }, position: [5, 7, 15],
    });
    close(box.position, [5, 7, 15]);
    close(headless.getObject(box.id).position, fromUserVector([5, 7, 15]));
    const det = await call<{ regions: { dimensionsMm: Vec3; centerMm: Vec3 }[] }>('kura_detect_structures', { objectId: box.id });
    close(det.regions[0].dimensionsMm, [10, 20, 30], 1);

    // Proyección por defecto: cara frontal (−Y del usuario), igual que el bus.
    const before = userWorldBox(headless, box.id);
    await call('kura_project_on_surface', { objectId: box.id, kind: 'text', text: 'A', mode: 'emboss', depthMm: 1, widthMm: 6 });
    const after = userWorldBox(headless, box.id);
    expect(after.min[1]).toBeLessThan(before.min[1] - 0.5);
    expect(after.max[2]).toBeCloseTo(before.max[2], 3);

    // Proyección '+z' = cara superior.
    const top = await call<Summary>('kura_create_primitive', { primitiveType: 'box', params: { width: 20, depth: 20, height: 10 } });
    const t0 = userWorldBox(headless, top.id);
    await call('kura_project_on_surface', { objectId: top.id, kind: 'text', text: 'A', mode: 'emboss', depthMm: 1, widthMm: 6, axis: '+z' });
    expect(userWorldBox(headless, top.id).max[2]).toBeGreaterThan(t0.max[2] + 0.5);

    const mirrored = await call<{ id: string; stats: { dimensionsMm: Vec3 } }>('kura_mirror_object', { objectId: box.id, axis: 'z' });
    expect(mirrored.id).toBe(box.id);
  }, 60_000);

  it('molde bivalvo: splitAxis y (fondo) separa las mitades en Y del usuario', async () => {
    const { call, headless } = await session();
    const box = await call<Summary>('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 10, height: 10 } });
    const mold = await call<{ parts: Summary[] }>('kura_generate_mold', { objectId: box.id, mode: 'direct_2part', splitAxis: 'y', placement: 'origin' });
    expect(mold.parts).toHaveLength(2);
    const [a, b] = mold.parts.map((p) => userWorldBox(headless, p.id));
    // Las mitades quedan una delante de la otra (Y), a la misma altura.
    expect(Math.abs((a.min[1] + a.max[1]) - (b.min[1] + b.max[1]))).toBeGreaterThan(1);
    expect(a.min[2]).toBeCloseTo(b.min[2], 3);
  }, 60_000);
});
