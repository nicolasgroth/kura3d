/**
 * @file src/store/__tests__/magnetRealModels.test.ts
 * @description Alojamiento de imán sobre modelos reales importados (ocarina.3mf, tinker.stl) con el motor real, y su
 * equivalente sintético. El centro de la pieza visto desde arriba recibe el imán; el punto que el recorrido del
 * navegador tocaba en tinker cae en un saliente más angosto que el hueco (cuerda ≤ 5 mm frente a 5,4 mm en todas las
 * alturas del hueco) y se rechaza con su aviso: no es un falso positivo de «la boca es más ancha que la cara». Lo
 * mismo en un vástago sintético de Ø 4,8; uno de Ø 8 o una caja con un agujero a un lado del clic sí lo reciben.
 * Las pruebas con archivos se omiten si los modelos no están en la máquina (no se copian al repositorio).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketFrame } from '../../core/addons/magnetPocket';
import { addScaled, rayHits } from '../../core/addons/meshRays';
import { isSolid } from '../../core/scene/objectRole';
import type { MeshData, Vec3 } from '../../types/kura';
import { byId, pickFace, resetMagnetStore, store, worldCenter, worldOf } from './magnetTestKit';

// Sin tipos de Node en el tsconfig del frontend: el módulo se toma del runtime, como en `textFont.test.ts`.
interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const { existsSync, readFileSync } = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');

const DIR = 'G:/proyectos/kura3d/.eval-tmp/modelos';
const HOLE_MM = MAGNET_DEFAULTS.sizeMm + MAGNET_DEFAULTS.clearanceMm;
const DEPTH_MM = MAGNET_DEFAULTS.heightMm + MAGNET_DEFAULTS.depthClearanceMm;
const TOO_BIG = /más grande que la pieza/;

async function importReal(name: string) {
  const buf = readFileSync(`${DIR}/${name}`);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  expect(await store().importModelFiles([{ name, read: async () => ab }])).toBe(true);
  return store().objects.filter(isSolid);
}

/**
 * Ancho del material (mm) por la recta tangente `k` de 16 que pasa por el eje, a `below` bajo el plano tangente:
 * distancia a la primera salida hacia un lado más hacia el opuesto (medición independiente de `measureMouthSurface`).
 */
function chordAt(world: MeshData, point: Vec3, normal: Vec3, k: number, below: number): number {
  const f = pocketFrame(normal)!;
  const ang = (k * 2 * Math.PI) / 16;
  const dir = [0, 1, 2].map((i) => f.u[i] * Math.cos(ang) + f.w[i] * Math.sin(ang)) as Vec3;
  const start = addScaled(point, f.axis, -below);
  const fwd = rayHits(world, start, dir)[0] ?? Infinity;
  const back = rayHits(world, start, dir.map((v) => -v) as Vec3)[0] ?? Infinity;
  return fwd + back;
}

/** Mayor ancho del material entre la boca y el fondo del hueco, en la peor dirección. */
function narrowestSpan(world: MeshData, point: Vec3, normal: Vec3): number {
  let worst = Infinity;
  for (let k = 0; k < 8; k++) {
    let widest = 0;
    for (const below of [0.05, 0.2, 0.5, 0.8, 1.2, 1.6, 2.0, DEPTH_MM - 0.05]) widest = Math.max(widest, chordAt(world, point, normal, k, below));
    worst = Math.min(worst, widest);
  }
  return worst;
}

const place = (hostId: string, point: Vec3, normal: Vec3) => store().addMagnetPocket({ hostId, params: MAGNET_DEFAULTS, point, normal });
const refusedTooBig = () => store().toasts.some((t) => t.kind === 'error' && TOO_BIG.test(t.text));

describe('alojamiento de imán en modelos reales importados', () => {
  beforeEach(resetMagnetStore);

  for (const name of ['ocarina.3mf', 'obj_1_tinker.obj.stl']) {
    it.skipIf(!existsSync(`${DIR}/${name}`))(`${name}: el centro visto desde arriba recibe el imán`, async () => {
      const [host] = await importReal(name);
      const c = worldCenter(host);
      const hit = pickFace(worldOf(host), [c[0] + 0.01, c[1] + 1000, c[2] + 0.01], [0, -1, 0]);
      const placed = await place(host.id, hit.point, hit.normal);
      expect(placed).not.toBeNull();
      expect(placed!.spansFace).toBe(false);
      expect(byId(placed!.obj.id).role).toBe('negative');
      expect(refusedTooBig()).toBe(false);
    }, 120_000);
  }

  it.skipIf(!existsSync(`${DIR}/obj_1_tinker.obj.stl`))('tinker: el saliente que tocaba el navegador es más angosto que el hueco y se rechaza', async () => {
    const [host] = await importReal('obj_1_tinker.obj.stl');
    // Punto y normal que daba la vista previa en `e2e/qa24-iman.spec.ts` › 10 (cámara casi cenital sobre el centro).
    const point: Vec3 = [2.5253298890580638, 109.93459918497012, 2.5253298890580673];
    const normal: Vec3 = [0.7160638313827146, 0.19174619984448427, 0.6711825267620622];
    const span = narrowestSpan(worldOf(host), point, normal);
    expect(span).toBeLessThan(HOLE_MM);
    expect(span).toBeGreaterThan(4);
    expect(await place(host.id, point, normal)).toBeNull();
    expect(refusedTooBig()).toBe(true);
    expect(store().objects.filter((o) => o.role === 'negative')).toHaveLength(0);
  }, 120_000);
});

describe('alojamiento de imán: pieza angosta frente a curva o agujero cercano (sintético)', () => {
  beforeEach(resetMagnetStore);

  async function sideOfRod(radius: number) {
    const rod = (await store().createPrimitive('cylinder', { radius, height: 40, segments: 64 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(rod);
    const hit = pickFace(worldOf(rod), [c[0] + 100, c[1] + 0.3, c[2] + 0.2], [-1, 0, 0]);
    return { rod, hit };
  }

  it('vástago Ø 4,8 con imán Ø 5: el hueco es más ancho que la pieza, se rechaza con aviso', async () => {
    const { rod, hit } = await sideOfRod(2.4);
    expect(narrowestSpan(worldOf(rod), hit.point, hit.normal)).toBeLessThan(HOLE_MM);
    expect(await place(rod.id, hit.point, hit.normal)).toBeNull();
    expect(refusedTooBig()).toBe(true);
  });

  it('vástago Ø 8 con imán Ø 5: curva, no angosta; se coloca', async () => {
    const { rod, hit } = await sideOfRod(4);
    expect(narrowestSpan(worldOf(rod), hit.point, hit.normal)).toBeGreaterThan(HOLE_MM);
    const placed = await place(rod.id, hit.point, hit.normal);
    expect(placed).not.toBeNull();
    expect(placed!.spansFace).toBe(false);
  });

  it('caja de 30 con un agujero pasante junto al clic (de un solo lado): se coloca', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(box);
    const pin = (await store().createPrimitive('cylinder', { radius: 2, height: 40, segments: 48 }, { position: [0, 0, 0], role: 'negative' }))!;
    const pc = worldCenter(pin);
    store().setObjectTransform(pin.id, { position: [pin.position[0] + c[0] + 4 - pc[0], pin.position[1] + c[1] - pc[1], pin.position[2] + c[2] - pc[2]] }, true);
    store().clearSelection();
    await store().applyHolesOnSolids();
    const host = byId(box.id);
    const hit = pickFace(worldOf(host), [c[0] + 0.01, c[1] + 100, c[2] + 0.01], [0, -1, 0]);
    expect(hit.normal[1]).toBeGreaterThan(0.99);
    const placed = await place(host.id, hit.point, hit.normal);
    expect(placed).not.toBeNull();
    expect(placed!.spansFace).toBe(false);
    // Toca el agujero: atraviesa (se avisa), pero no se impide.
    expect(placed!.wall.through).toBe(true);
  });
});
