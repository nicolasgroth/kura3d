/**
 * @file src/store/__tests__/busSplitPersistenceAxes.test.ts
 * @description QA ronda 6 sin interfaz. (B) Persistencia: dividir → guardar `.kura` → abrir →
 * `validate_assembly` da lo mismo; deshacer/rehacer conserva `metadata.split`. (C) Ejes del usuario (Z = altura):
 * las mismas entradas dan las mismas salidas en el Command Bus y en el motor headless del MCP (transform,
 * `plane_cut` con los tres `keepMode` en los tres ejes, `align_objects`, `mirror_object`, molde, proyección,
 * `split_for_bed.axes`, `validate_assembly`), y un STL de 10×20×30 se importa con esas medidas y sobrevive a
 * exportar y reimportar. Las pruebas `it.fails` documentan brechas CONFIRMADAS.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { toUserBox } from '../../core/scene/displayAxes';
import { applyTransformToMesh } from '../../engine';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { DEFAULT_PRINTER_PROFILES, type KuraCommandRequest, type SceneObject, type Vec3 } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

/**
 * El motor headless del MCP se carga en dinámico y sin tipos: el `tsc` raíz no tiene tipos de Node y no debe
 * resolver `mcp-server/`. Solo se usa la parte que estas pruebas llaman.
 */
type HeadlessObj = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;
interface HeadlessLike {
  createPrimitive(input: Record<string, unknown>): Promise<{ id: string; position: number[] }>;
  transformObject(id: string, patch: Record<string, unknown>): unknown;
  getObject(id: string): HeadlessObj;
  planeCut(id: string, o: Record<string, unknown>): Promise<{ parts: Array<{ id: string }> }>;
  alignObjects(ids: string[], mode: string): unknown;
  mirrorObject(id: string, axis: string): unknown;
  generateMold(id: string, o: Record<string, unknown>, placement: string): Promise<{ parts: Array<{ id: string }> }>;
  projectOnSurface(id: string, o: Record<string, unknown>): Promise<unknown>;
  splitForBed(id: string, i: Record<string, unknown>): Promise<{ plan: { planes: Array<{ axis: string; position: number }> }; joints: Array<{ axis: string; a: { face?: string }; b: { face?: string } }> }>;
  validateAssembly(i: Record<string, unknown>): { order: Array<{ direction: string }> };
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'qa6', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

const round = (n: number) => Math.round(n * 100) / 100;
/** Caja de mundo en ejes del usuario de un objeto con malla interna. */
function userBox(o: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>) {
  const p = applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale).positions;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  const b = toUserBox({ min, max });
  return { min: b.min.map(round), max: b.max.map(round), size: [0, 1, 2].map((a) => round(b.max[a] - b.min[a])) };
}
/** Promedio de vértices en ejes del usuario: distingue espejos y giros que conservan la caja. */
function userCentroid(o: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): number[] {
  const p = applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale).positions;
  let sx = 0, sy = 0, sz = 0;
  const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { sx += p[i]; sy += p[i + 1]; sz += p[i + 2]; }
  const c = [sx / n, sy / n, sz / n] as Vec3;
  // interno (x, y, z) → usuario (x, −z, y)
  return [round(c[0]), round(-c[2]), round(c[1])];
}
const sig = (o: SceneObject) => JSON.stringify({ s: userBox(o).size, c: userCentroid(o) });

describe('persistencia de la división', () => {
  beforeEach(() => resetStore());

  const dowel = { connectorType: 'dowel', connectorSize: 4, connectorDepth: 8, connectorCount: 1, bedWidthMm: 250, bedDepthMm: 250, bedHeightMm: 250 };
  const roundTrip = () =>
    decodeProject(encodeProject({
      objects: store().objects, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 1,
    }));

  it('dividir → guardar → abrir → validate_assembly da el mismo resultado', async () => {
    const box = await addBox(400);
    const sp = await run('split_for_bed', { id: box.id, ...dowel });
    expect(sp.ok).toBe(true);
    const before = await run('validate_assembly', { groupId: box.id });
    expect(before.ok).toBe(true);
    const doc = roundTrip();
    useKuraStore.setState({ objects: doc.objects, selectedIds: [], past: [], future: [] });
    const after = await run('validate_assembly', { groupId: box.id });
    expect(after.ok).toBe(true);
    const strip = (r: CommandBusResponse) => JSON.parse(JSON.stringify(r.result, (k, v) => (k === 'elapsedMs' ? undefined : v)));
    expect(strip(after)).toEqual(strip(before));
    // Todas las piezas conservan metadata.split con uniones
    const parts = store().objects.filter((o) => o.metadata?.split?.groupId === box.id);
    expect(parts.length).toBe(8);
    expect(parts.every((p) => p.metadata!.split!.code && Array.isArray(p.metadata!.split!.joints))).toBe(true);
  }, 120_000);

  it('deshacer devuelve el original y rehacer devuelve las piezas con metadata.split intacta', async () => {
    const box = await addBox(400);
    await run('split_for_bed', { id: box.id, ...dowel });
    const snap = () => store().objects.filter((o) => o.metadata?.split).map((o) => JSON.stringify(o.metadata!.split)).sort();
    const first = snap();
    expect(first.length).toBe(8);
    store().undo();
    expect(store().objects.some((o) => o.metadata?.split)).toBe(false);
    expect(store().objects.some((o) => o.id === box.id)).toBe(true);
    store().redo();
    expect(snap()).toEqual(first);
    const v = await run('validate_assembly', { groupId: box.id });
    expect(v.ok).toBe(true);
    // doble ciclo
    store().undo();
    store().redo();
    expect(snap()).toEqual(first);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------------
// C. Paridad bus <-> headless (mismas entradas, mismas salidas, ejes del usuario)
// ---------------------------------------------------------------------------------------------------------------------
describe('ejes del usuario, bus ↔ MCP headless', () => {
  let h: HeadlessLike;
  beforeEach(async () => {
    await resetStore();
    h = await newHeadless();
  });

  const both = async (cuboArgs: { w: number; d: number; ht: number; position?: Vec3 }) => {
    const args = { primitiveType: 'box', params: { width: cuboArgs.w, depth: cuboArgs.d, height: cuboArgs.ht }, placement: 'origin' };
    const sum = await h.createPrimitive(args);
    const res = await run('create_primitive', { ...args, type: 'box' });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    const bid = (res.result as { id: string }).id;
    if (cuboArgs.position) {
      h.transformObject(sum.id, { position: cuboArgs.position });
      expect((await run('transform_object', { id: bid, position: cuboArgs.position })).ok).toBe(true);
    }
    return { hid: sum.id, bid };
  };
  const hBox = (id: string) => userBox(h.getObject(id));
  const bBox = (id: string) => userBox(store().objects.find((o) => o.id === id)!);

  it('crear 10×20×30 da 10×20×30 en ambos y la misma posición de usuario', async () => {
    const { hid, bid } = await both({ w: 10, d: 20, ht: 30 });
    expect(hBox(hid).size).toEqual([10, 20, 30]);
    expect(bBox(bid).size).toEqual([10, 20, 30]);
    expect(hBox(hid)).toEqual(bBox(bid));
  });

  it('transform: posición y giro de usuario dan la misma caja', async () => {
    const { hid, bid } = await both({ w: 10, d: 20, ht: 30 });
    const patch = { position: [5, 7, 9] as Vec3, rotation: [0, 0, Math.PI / 2] as Vec3 };
    h.transformObject(hid, patch);
    const r = await run('transform_object', { id: bid, ...patch });
    expect(r.ok).toBe(true);
    expect(hBox(hid)).toEqual(bBox(bid));
    expect(bBox(bid).size).toEqual([20, 10, 30]);
    // Giro en X de usuario (sobre el eje del ancho): intercambia fondo y alto
    h.transformObject(hid, { rotation: [Math.PI / 2, 0, 0] });
    await run('transform_object', { id: bid, rotation: [Math.PI / 2, 0, 0] });
    expect(hBox(hid)).toEqual(bBox(bid));
  });

  for (const axis of ['x', 'y', 'z'] as const) {
    for (const keepMode of ['both', 'positive', 'negative'] as const) {
      it(`plane_cut eje ${axis} keepMode ${keepMode}: mismas piezas`, async () => {
        const { hid, bid } = await both({ w: 10, d: 20, ht: 30, position: [3, -4, 17] });
        const off = axis === 'x' ? 2 : axis === 'y' ? -3 : 5;
        const hres = await h.planeCut(hid, {
          axis, offset: off, keepMode, connectorType: 'none', connectorSize: 4, connectorDepth: 5, tolerance: 0.25, connectorCount: 2,
        });
        const bres = await run('plane_cut', { id: bid, axis, offset: off, keepMode, connectorType: 'none', connectorSize: 4, connectorDepth: 5, tolerance: 0.25, connectorCount: 2 });
        expect(bres.ok, JSON.stringify(bres)).toBe(true);
        const hparts = hres.parts.map((p) => hBox(p.id).size.join('x')).sort();
        const bparts = store().objects.map((o) => userBox(o).size.join('x')).sort();
        expect(bparts).toEqual(hparts);
        // La mitad conservada: la caja en el eje cortado
        const ai = { x: 0, y: 1, z: 2 }[axis];
        const sizes = hres.parts.map((p) => hBox(p.id).size[ai]);
        const bsizes = store().objects.map((o) => userBox(o).size[ai]);
        expect(bsizes.sort()).toEqual(sizes.sort());
      }, 60_000);
    }
  }

  it('plane_cut keepMode positive/negative: la mitad es la del lado + / − del usuario (Z+ = arriba, Y+ = fondo)', async () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      await resetStore();
      const bx = await both({ w: 10, d: 20, ht: 30 });
      const hb = hBox(bx.hid);
      const ai = { x: 0, y: 1, z: 2 }[axis];
      const mid = round((hb.min[ai] + hb.max[ai]) / 2);
      const cut = await run('plane_cut', { id: bx.bid, axis, offset: 0, keepMode: 'positive', connectorType: 'none' });
      expect(cut.ok, JSON.stringify(cut)).toBe(true);
      const kept = userBox(store().objects[0]);
      expect(kept.min[ai], `eje ${axis}: la mitad positiva debe quedar por encima de ${mid}`).toBeGreaterThanOrEqual(mid - 0.01);
    }
  }, 60_000);

  it('align_objects: todos los modos dan las mismas posiciones', async () => {
    const modes = ['minX', 'centerX', 'maxX', 'minY', 'centerY', 'maxY', 'minZ', 'centerZ', 'maxZ'];
    for (const mode of modes) {
      await resetStore();
      h = await newHeadless();
      const a = await both({ w: 10, d: 20, ht: 30, position: [0, 0, 15] });
      const b = await both({ w: 6, d: 8, ht: 12, position: [40, 25, 6] });
      h.alignObjects([a.hid, b.hid], mode);
      const r = await run('align_objects', { objectIds: [a.bid, b.bid], mode });
      expect(r.ok, `${mode}: ${JSON.stringify(r)}`).toBe(true);
      expect(JSON.stringify([bBox(a.bid), bBox(b.bid)]), `modo ${mode}`).toBe(JSON.stringify([hBox(a.hid), hBox(b.hid)]));
    }
  }, 120_000);

  it('mirror_object: los tres ejes dan la misma malla (cono, asimétrico en Z)', async () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      await resetStore();
      h = await newHeadless();
      const args = { primitiveType: 'cone', params: { radius: 10, height: 30 }, placement: 'origin' };
      const hs = await h.createPrimitive(args);
      const bs = await run('create_primitive', { ...args, type: 'cone' });
      const bid = (bs.result as { id: string }).id;
      h.transformObject(hs.id, { position: [4, 5, 20] });
      await run('transform_object', { id: bid, position: [4, 5, 20] });
      h.mirrorObject(hs.id, axis);
      expect((await run('mirror_object', { id: bid, axis })).ok).toBe(true);
      expect(sig(store().objects.find((o) => o.id === bid)!), `espejo ${axis}`).toBe(sig(h.getObject(hs.id) as SceneObject));
    }
  }, 60_000);

  it('molde bivalvo con splitAxis x e y: mismas medidas de las mitades', async () => {
    for (const splitAxis of ['x', 'y'] as const) {
      await resetStore();
      h = await newHeadless();
      const bx = await both({ w: 10, d: 16, ht: 20 });
      const hm = await h.generateMold(bx.hid, { mode: 'direct_2part', splitAxis, wallMarginMm: 5, boxWallMm: 3, pourSpout: true, keyToleranceMm: 0.25, cavityWallMm: 3 } , 'origin');
      const bm = await run('generate_mold', { id: bx.bid, mode: 'direct_2part', splitAxis, placement: 'origin', wallMarginMm: 5, boxWallMm: 3, pourSpout: true, keyToleranceMm: 0.25, cavityWallMm: 3 });
      expect(bm.ok, JSON.stringify(bm)).toBe(true);
      const hs = hm.parts.map((p) => hBox(p.id).size.join('x')).sort();
      const molds = store().objects.filter((o) => o.id !== bx.bid);
      expect(molds.map((o) => userBox(o).size.join('x')).sort(), `splitAxis ${splitAxis}`).toEqual(hs);
    }
  }, 120_000);

  it('proyección de texto en caras +z, -z, +x y -y: mismo efecto en la caja', async () => {
    for (const axis of ['+z', '-z', '+x', '-y', '+y', '-x'] as const) {
      await resetStore();
      h = await newHeadless();
      const bx = await both({ w: 20, d: 20, ht: 20 });
      const opts = { kind: 'text', text: 'A', mode: 'emboss', depthMm: 1, widthMm: 6, axis };
      await h.projectOnSurface(bx.hid, opts );
      const r = await run('project_on_surface', { id: bx.bid, ...opts });
      expect(r.ok, `${axis}: ${JSON.stringify(r)}`).toBe(true);
      expect(bBox(bx.bid), `cara ${axis}`).toEqual(hBox(bx.hid));
    }
  }, 120_000);

  it('split_for_bed con axes [z] y [x,y]: mismos planos, caras de unión y órdenes de montaje', async () => {
    for (const axes of [['z'], ['x', 'y'], ['y', 'z']]) {
      await resetStore();
      h = await newHeadless();
      const big = (a: string) => (axes.includes(a) ? 300 : 40);
      const bx = await both({ w: big('x'), d: big('y'), ht: big('z') });
      const hres = await h.splitForBed(bx.hid, {
        bed: { widthMm: 200, depthMm: 200, heightMm: 200 },
        plan: { axes: axes , maxPieces: 64, connector: null }, execute: { labels: 'none' as const, connector: null }, dryRun: false,
      });
      const bres = await run('split_for_bed', { id: bx.bid, axes, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'none', labels: 'none' });
      expect(bres.ok, JSON.stringify(bres)).toBe(true);
      const b = bres.result as { plan: { planes: { axis: string; position: number }[] }; joints: { axis: string; a: { face?: string }; b: { face?: string } }[] };
      expect(b.plan.planes.map((p) => p.axis), JSON.stringify(axes)).toEqual(hres.plan.planes.map((p) => p.axis));
      expect(b.plan.planes.map((p) => round(p.position))).toEqual(hres.plan.planes.map((p) => round(p.position)));
      expect(b.joints.map((j) => [j.axis, j.a.face, j.b.face])).toEqual(hres.joints.map((j) => [j.axis, j.a.face, j.b.face]));
      const hv = h.validateAssembly({ groupId: bx.hid }) as { order: { direction: string }[] };
      const bv = (await run('validate_assembly', { groupId: bx.bid })).result as { order: { direction: string }[] };
      expect(bv.order.map((s) => s.direction)).toEqual(hv.order.map((s) => s.direction));
    }
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------------------------------
// STL: importar 10×20×30 (Z arriba), exportar y reimportar
// ---------------------------------------------------------------------------------------------------------------------
function boxStl(sx: number, sy: number, sz: number): ArrayBuffer {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0], [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const buf = new ArrayBuffer(84 + t.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, t.length, true);
  let o = 84;
  for (const tri of t) {
    o += 12;
    for (const i of tri) { dv.setFloat32(o, v[i][0], true); dv.setFloat32(o + 4, v[i][1], true); dv.setFloat32(o + 8, v[i][2], true); o += 12; }
    o += 2;
  }
  return buf;
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;

describe('STL 10×20×30 (Z arriba) importa, exporta y reimporta sin cambios', () => {
  beforeEach(() => resetStore());

  it('importar da 10×20×30 de usuario; exportar y reimportar conserva medidas y volumen', async () => {
    const ok = await store().importModelFiles([{ name: 'caja.stl', read: async () => boxStl(10, 20, 30) }], { placement: 'bed' });
    expect(ok).toBe(true);
    expect(store().objects).toHaveLength(1);
    const o1 = store().objects[0];
    expect(userBox(o1).size).toEqual([10, 20, 30]);
    // El estado de escena del bus en ejes de usuario
    const st = await run('get_scene_state', {});
    const dims = (st.result as { objects: Array<{ stats: { dimensionsMm: number[] } }> }).objects[0].stats.dimensionsMm;
    expect(dims.map(round)).toEqual([10, 20, 30]);
    const vol = o1.stats.volumeMm3;
    expect(vol).toBeCloseTo(6000, 3);

    const exp = await run('export_stl', { returnBytes: true });
    expect(exp.ok).toBe(true);
    const bytes64 = (exp.result as { bytesBase64: string }).bytesBase64;
    await resetStore();
    expect(await store().importModelFiles([{ name: 'ida_y_vuelta.stl', read: async () => fromB64(bytes64) }], { placement: 'bed' })).toBe(true);
    const o2 = store().objects[0];
    expect(userBox(o2).size).toEqual([10, 20, 30]);
    expect(o2.stats.volumeMm3).toBeCloseTo(vol, 3);
    // Exportar de nuevo: bytes idénticos (estable)
    const again = await run('export_stl', { returnBytes: true });
    expect((again.result as { bytesBase64: string }).bytesBase64).toBe(bytes64);
  }, 60_000);

  it('el STL exportado tiene Z de altura (el máximo en Z del archivo = 30)', async () => {
    await store().importModelFiles([{ name: 'caja.stl', read: async () => boxStl(10, 20, 30) }], { placement: 'bed' });
    const exp = await run('export_stl', { returnBytes: true });
    const dv = new DataView(fromB64((exp.result as { bytesBase64: string }).bytesBase64));
    const n = dv.getUint32(80, true);
    const max = [-Infinity, -Infinity, -Infinity], min = [Infinity, Infinity, Infinity];
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) {
      const val = dv.getFloat32(84 + t * 50 + 12 + k * 12 + a * 4, true);
      max[a] = Math.max(max[a], val); min[a] = Math.min(min[a], val);
    }
    expect([0, 1, 2].map((a) => round(max[a] - min[a]))).toEqual([10, 20, 30]);
  }, 60_000);
});

// Corregida (antes `it.fails`): `create_primitive` del bus convierte `position` de ejes del usuario a internos, igual
// que el MCP headless, y devuelve la posición pedida.
describe('posición de create_primitive en el bus', () => {
  beforeEach(() => resetStore());
  it('create_primitive con position [4,5,20] (Z arriba) devuelve y coloca esa posición de usuario', async () => {
    const res = await run('create_primitive', { type: 'box', params: { width: 10, depth: 10, height: 10 }, placement: 'origin', position: [4, 5, 20] });
    expect(res.ok).toBe(true);
    expect((res.result as { position: number[] }).position.map(round)).toEqual([4, 5, 20]);
    // `position` es el centro de la base (convención del motor y del headless): la caja va de Z = 20 a 30
    expect(userBox(store().objects[0]).min).toEqual([-1, 0, 20]);
    expect(userBox(store().objects[0]).max).toEqual([9, 10, 30]);
  });
  it('el headless sí respeta la posición del usuario (referencia de contraste)', async () => {
    const h = await newHeadless();
    const s = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, depth: 10, height: 10 }, placement: 'origin', position: [4, 5, 20] } );
    expect(s.position.map(round)).toEqual([4, 5, 20]);
    expect(userBox(h.getObject(s.id)).min).toEqual([-1, 0, 20]);
  });
});
