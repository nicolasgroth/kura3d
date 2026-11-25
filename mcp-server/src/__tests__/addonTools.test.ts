/**
 * @file mcp-server/src/__tests__/addonTools.test.ts
 * @description `kura_add_magnet_pocket` y `kura_add_screw_boss` sin interfaz, con el motor real: lugar por cara o por
 * punto + normal, volumen que quita el imán al restarlo (π·r²·h de la holgura), bloqueo tipado `addon-blocked`,
 * entradas inválidas, torreta que tras unir el poste y restar el agujero deja un solo cuerpo cerrado, y la regla de
 * que imán y torreta conservan su medida y siguen a la pieza cuando el MCP la mueve, gira o escala.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import * as engine from '../../../src/engine/index';
import type { SceneObject, Vec3 } from '../../../src/types/kura';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const raw = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('') };
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await raw(name, args);
    expect(r.error, r.text).toBe(false);
    return JSON.parse(r.text);
  };
  return { raw, call, headless };
}

const worldVolume = (o: SceneObject) => engine.computeMeshStats(engine.applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale)).volumeMm3;

/** Punto de la cara del agregado (base + ancla sobre su eje +Y local), en mundo. */
function addonFacePoint(o: SceneObject): Vec3 {
  const addon = o.metadata!.addon!;
  const anchor = addon.kind === 'magnet_pocket' ? 0 : addon.anchorMm;
  const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...o.rotation, 'XYZ'));
  const base = new THREE.Vector3(...o.position);
  if (addon.kind === 'magnet_pocket') {
    // El imán abierto: base en el fondo del hueco (alto + holgura bajo la cara).
    const bottom = addon.params.heightMm + addon.params.depthClearanceMm;
    return base.addScaledVector(axis, bottom * o.scale[1]).toArray() as Vec3;
  }
  return base.addScaledVector(axis, anchor * o.scale[1]).toArray() as Vec3;
}

describe('MCP: alojamiento de imán sin interfaz', () => {
  it('coloca el imán en la cara superior y al restarlo quita el volumen del hueco', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 30, depth: 30, height: 30 }, placement: 'origin' });
    const res = await call('kura_add_magnet_pocket', { hostId: box.id, face: 'top', sizeMm: 5, heightMm: 2, clearanceMm: 0.2, depthClearanceMm: 0.2 });
    expect(res).toMatchObject({ hostId: box.id, role: 'negative', pocket: { shape: 'round', widthMm: 5.2, depthMm: 2.2 } });
    expect(res.placement.normal.map((n: number) => Math.round(n * 1e6) / 1e6)).toEqual([0, 0, 1]);
    expect(res.wall.through).toBe(false);
    expect(res.wall.minWallMm).toBeGreaterThan(10);
    expect(res.warnings).toEqual([]);
    const magnet = headless.getObject(res.id);
    expect(magnet.metadata?.addon).toMatchObject({ kind: 'magnet_pocket', hostId: box.id });

    const before = worldVolume(headless.getObject(box.id));
    const cut = await call('kura_boolean_operation', { targetId: box.id, toolIds: [res.id], operation: 'subtract' });
    const after = headless.getObject(cut.resultId);
    const removed = before - worldVolume(after);
    const expected = Math.PI * 2.6 * 2.6 * 2.2;
    expect(Math.abs(removed - expected) / expected).toBeLessThan(0.01);
    expect(engine.computeMeshStats(after.mesh).isManifold).toBe(true);
  }, 60_000);

  it('por punto y normal da lo mismo que por cara, y el desplazamiento mueve la boca', async () => {
    const { call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 20, height: 20 }, placement: 'origin' });
    const byFace = await call('kura_add_magnet_pocket', { hostId: box.id, face: 'front', faceOffsetMm: [8, 0] });
    const byPoint = await call('kura_add_magnet_pocket', { hostId: box.id, point: byFace.placement.point, normal: [0, -1, 0] });
    for (let k = 0; k < 3; k++) expect(byPoint.placement.point[k]).toBeCloseTo(byFace.placement.point[k], 6);
    expect(byFace.placement.normal[1]).toBeCloseTo(-1, 6);
    expect(byFace.placement.point[0] - box.position[0]).toBeCloseTo(8, 6);
    // El segundo queda superpuesto con el primero: aviso tipado.
    expect(byPoint.warnings.map((w: { code: string }) => w.code)).toContain('MAGNET_OVERLAP');
    expect(byPoint.name).not.toBe(byFace.name);
  }, 60_000);

  it('bloquea con addon-blocked y valida las entradas', async () => {
    const { call, raw } = await connect();
    const small = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 8, depth: 8, height: 8 }, placement: 'origin' });
    const big = await raw('kura_add_magnet_pocket', { hostId: small.id, face: 'top', sizeMm: 20, heightMm: 6 });
    expect(big.error).toBe(true);
    expect(big.text).toContain('[addon-blocked]');
    expect(big.text).toMatch(/"reason":"(tooBig|spansFace)"/);
    expect((await raw('kura_add_magnet_pocket', { hostId: small.id, face: 'top', sizeMm: 100 })).error).toBe(true);
    const both = await raw('kura_add_magnet_pocket', { hostId: small.id, face: 'top', point: [0, 0, 8], normal: [0, 0, 1] });
    expect(both.text).toContain('[invalid-params]');
    const none = await raw('kura_add_magnet_pocket', { hostId: small.id });
    expect(none.text).toContain('[invalid-params]');
    const miss = await raw('kura_add_magnet_pocket', { hostId: small.id, face: 'top', faceOffsetMm: [50, 0] });
    expect(miss.text).toContain('faceOffsetMm');
    const missing = await raw('kura_add_magnet_pocket', { hostId: 'nope', face: 'top' });
    expect(missing.text).toContain('[not-found]');
  }, 60_000);
});

describe('MCP: torreta para tornillo sin interfaz', () => {
  it('tornillo directo M5 desde la tabla (antes invalid-params)', async () => {
    const { call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 30 }, placement: 'origin' });
    const res = await call('kura_add_screw_boss', { hostId: box.id, face: 'top', type: 'screw', nominalMm: 5 });
    expect(res.params).toMatchObject({ type: 'screw', nominalMm: 5, holeDiameterMm: 4.2, holeDepthMm: 12, heightMm: 14, outerDiameterMm: 12.5 });
  });

  it('crea poste y agujero desde la tabla; unir y restar deja un solo cuerpo cerrado', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 20 }, placement: 'origin' });
    const res = await call('kura_add_screw_boss', { hostId: box.id, face: 'top', type: 'screw', nominalMm: 3 });
    expect(res.params).toMatchObject({ type: 'screw', nominalMm: 3, holeDiameterMm: 2.5, holeDepthMm: 8, heightMm: 10, outerDiameterMm: 7.5 });
    expect(res.report).toMatchObject({ exits: false, collides: false, intoHostMm: 0 });
    expect(res.report.wallMm).toBeCloseTo(2.5, 6);
    expect(headless.getObject(res.post.id).metadata?.addon).toMatchObject({ kind: 'screw_boss', part: 'post', hostId: box.id });
    expect(headless.getObject(res.hole.id).role).toBe('negative');

    // «Aplicar restas»: el poste se une a la pieza y el agujero corta un solo cuerpo.
    const hostVol = worldVolume(headless.getObject(box.id));
    const merged = await call('kura_boolean_operation', { targetId: box.id, toolIds: [res.post.id], operation: 'union' });
    const cut = await call('kura_boolean_operation', { targetId: merged.resultId, toolIds: [res.hole.id], operation: 'subtract' });
    const single = await call('kura_split_disconnected', { objectId: cut.resultId });
    expect(single.parts).toHaveLength(1);
    const result = headless.getObject(cut.resultId);
    expect(engine.computeMeshStats(result.mesh).isManifold).toBe(true);
    // Volumen: pieza + poste sobre la cara − agujero (los dos con 64 lados).
    expect(worldVolume(result)).toBeGreaterThan(hostVol + 300);
    expect(worldVolume(result)).toBeLessThan(hostVol + Math.PI * 3.75 * 3.75 * 10);
  }, 60_000);

  it('sin tabla para la medida exige el agujero, y bloquea la torreta más ancha que la zona', async () => {
    const { call, raw } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 10, height: 10 }, placement: 'origin' });
    const noTable = await raw('kura_add_screw_boss', { hostId: box.id, face: 'top', nominalMm: 7 });
    expect(noTable.text).toContain('[invalid-params]');
    expect(noTable.text).toContain('holeDiameterMm');
    const wide = await raw('kura_add_screw_boss', { hostId: box.id, face: 'top', nominalMm: 3, outerDiameterMm: 30 });
    expect(wide.text).toContain('[addon-blocked]');
    expect(wide.text).toContain('"reason":"tooWide"');
  }, 60_000);
});

describe('MCP: los agregados siguen a su pieza sin interfaz', () => {
  it('mover, girar y escalar la pieza lleva al imán y a la torreta a su cara con su medida', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 30, height: 20 }, placement: 'origin' });
    const magnet = await call('kura_add_magnet_pocket', { hostId: box.id, face: 'top', faceOffsetMm: [-10, 0] });
    const boss = await call('kura_add_screw_boss', { hostId: box.id, face: 'top', faceOffsetMm: [10, 0] });
    const host0 = headless.getObject(box.id);
    const local = (p: Vec3, h: SceneObject) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...h.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...h.rotation, 'XYZ')), new THREE.Vector3(...h.scale));
      return new THREE.Vector3(...p).applyMatrix4(m.invert());
    };
    const before = [magnet.id, boss.post.id, boss.hole.id].map((id) => local(addonFacePoint(headless.getObject(id)), host0));
    const sizes = [magnet.id, boss.post.id].map((id) => headless.getObject(id).stats.volumeMm3);

    await call('kura_transform_object', { objectId: box.id, position: [25, -10, 0], rotation: [0, 0, 0.7], scale: [1.5, 1, 1] });
    const host1 = headless.getObject(box.id);
    [magnet.id, boss.post.id, boss.hole.id].forEach((id, i) => {
      const o = headless.getObject(id);
      expect(o.scale).toEqual([1, 1, 1]);
      // El punto de la cara sigue en el mismo lugar de la superficie de la pieza (en sus coordenadas locales).
      const now = local(addonFacePoint(o), host1);
      expect(now.distanceTo(before[i])).toBeLessThan(1e-6);
    });
    // Conservan su medida: el volumen de mundo no cambia con la escala de la pieza.
    expect(headless.getObject(magnet.id).stats.volumeMm3).toBeCloseTo(sizes[0], 3);
    expect(headless.getObject(boss.post.id).stats.volumeMm3).toBeCloseTo(sizes[1], 3);
  }, 60_000);

  it('aplicar una orientación lleva los agregados con la pieza (followers)', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 10, height: 60 }, placement: 'origin' });
    const magnet = await call('kura_add_magnet_pocket', { hostId: box.id, face: 'front' });
    const analysis = await call('kura_orient_for_print', { objectId: box.id });
    const flat = analysis.candidates.find((c: { id: string; measures: { heightMm: number } }) => c.id !== analysis.currentId && c.measures.heightMm < 20);
    const res = await call('kura_apply_orientation', { objectId: box.id, candidateId: flat.id });
    expect(res.followers).toContain(magnet.id);
    const host = headless.getObject(box.id);
    const m = headless.getObject(magnet.id);
    // El eje del imán sigue siendo la normal de su cara: perpendicular a la cara frontal girada de la pieza.
    const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...m.rotation, 'XYZ'));
    const front = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...host.rotation, 'XYZ'));
    expect(Math.abs(axis.dot(front))).toBeCloseTo(1, 6);
  }, 120_000);
});
