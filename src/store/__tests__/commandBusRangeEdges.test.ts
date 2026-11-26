/**
 * @file src/store/__tests__/commandBusRangeEdges.test.ts
 * @description Command Bus ante valores límite: valores en el borde exacto de cada rango aceptado por el bus
 * (commandSchemas) y por la validación de herramientas de IA (toolValidation). Invariante: tras cada comando
 * (aceptado o rechazado) la escena solo contiene geometría finita y el proyecto sigue codificándose.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { validateToolCall } from '../../ai/toolValidation';
import { encodeProject } from '../../project/projectCodec';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { captureProject } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: KuraCommandRequest['command'], params: Record<string, unknown>) =>
  store().executeCommand({ id: `qa_${command}`, command, params }, 'mcp') as Promise<CommandBusResponse>;

/** Máxima dimensión razonable para una pieza imprimible (la cama más grande soportada son ~1 m). */
const SANE_DIM = 1e5;

function assertSceneSane(label: string) {
  for (const o of store().objects) {
    for (const v of [...o.position, ...o.rotation, ...o.scale]) expect(Number.isFinite(v), `${label}: transform no finito en ${o.name}`).toBe(true);
    expect(Number.isFinite(o.stats.volumeMm3), `${label}: volumen no finito en ${o.name}`).toBe(true);
    for (const d of o.stats.dimensionsMm) expect(Number.isFinite(d), `${label}: dimensión no finita`).toBe(true);
    expect(o.stats.triangles, `${label}: ${o.name} quedó con malla vacía tras un comando aceptado`).toBeGreaterThan(0);
  }
  expect(() => encodeProject(captureProject(store())), `${label}: el proyecto no se puede guardar`).not.toThrow();
}

const bad = (res: CommandBusResponse) => !res.ok && typeof res.errorCode === 'string';

describe('bus: bordes de rango y estado guardable', () => {
  beforeEach(() => resetStore());

  const edge: Array<[string, KuraCommandRequest['command'], Record<string, unknown>]> = [
    ['hollow wall 100', 'hollow_object', { wallThickness: 100 }],
    ['hollow wall 0.1 (bus ok, motor >=0.2)', 'hollow_object', { wallThickness: 0.1 }],
    ['hollow wall 4.99 en cubo 10', 'hollow_object', { wallThickness: 4.99 }],
    ['hollow drain 100', 'hollow_object', { wallThickness: 1, drainHole: true, drainHoleRadius: 100 }],
    ['cut connectorCount 0 dowel', 'plane_cut', { axis: 'x', connectorType: 'dowel', connectorCount: 0 }],
    ['cut connector 500', 'plane_cut', { axis: 'x', connectorType: 'dowel', connectorSize: 500 }],
    ['cut depth 500', 'plane_cut', { axis: 'x', connectorType: 'peg', connectorDepth: 500 }],
    ['cut offset 1e5', 'plane_cut', { axis: 'y', offset: 1e5 }],
    ['cut offset -1e5', 'plane_cut', { axis: 'y', offset: -1e5, keepMode: 'positive' }],
    ['cut tolerance 5', 'plane_cut', { axis: 'x', connectorType: 'dowel', tolerance: 5 }],
    ['texture depth 50', 'apply_texture', { pattern: 'fuzzy', depth: 50, scale: 1 }],
    ['texture scale 1000', 'apply_texture', { pattern: 'grid', depth: 1, scale: 1000 }],
    ['texture scale tiny', 'apply_texture', { pattern: 'honeycomb', depth: 1, scale: 1e-9 }],
    ['mold wall 500', 'generate_mold', { mode: 'direct_2part', wallMarginMm: 500 }],
    ['mold box 500 silicone', 'generate_mold', { mode: 'silicone_master', boxWallMm: 500 }],
    ['mold spout 500', 'generate_mold', { mode: 'direct_1part', pourSpoutRadiusMm: 500 }],
    ['mold core wall 500', 'generate_mold', { mode: 'core_cavity', cavityWallMm: 500 }],
    ['mold keytol 5', 'generate_mold', { mode: 'direct_2part', keyToleranceMm: 5 }],
    ['proj width 10000', 'project_on_surface', { kind: 'text', text: 'A', widthMm: 10000 }],
    ['proj depth 500 deboss', 'project_on_surface', { kind: 'text', text: 'A', mode: 'deboss', depthMm: 500 }],
    ['proj offsetU 1e5', 'project_on_surface', { kind: 'text', text: 'A', offsetU: 1e5 }],
    ['refine 0.05', 'refine_mesh', { targetEdgeLengthMm: 0.05 }],
    ['refine 1000', 'refine_mesh', { targetEdgeLengthMm: 1000, smooth: true }],
    ['detect crease 1', 'detect_structures', { creaseAngleDeg: 1 }],
    ['detect crease 179', 'detect_structures', { creaseAngleDeg: 179 }],
    ['thread d100 pitch0.3', 'create_thread', { kind: 'bolt', diameterMm: 100, pitchMm: 0.3, lengthMm: 300 }],
    ['thread d2 pitch10', 'create_thread', { kind: 'bolt', diameterMm: 2, pitchMm: 10, lengthMm: 2 }],
    ['thread hole clr 2', 'create_thread', { kind: 'hole', diameterMm: 3, pitchMm: 0.5, lengthMm: 5, clearanceMm: 2 }],
    ['svg width 10000', 'import_svg', { svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>', targetWidth: 10000, depth: 1000 }],
    ['svg curveSegments 128', 'import_svg', { svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', curveSegments: 128 }],
    ['transform scale 1000', 'transform_object', { scale: [1000, 1000, 1000] }],
    ['transform scale 0.001', 'transform_object', { scale: [0.001, 0.001, 0.001] }],
    ['transform pos 1e5', 'transform_object', { position: [1e5, -1e5, 1e5], rotation: [1e5, 0, -1e5] }],
  ];

  it.each(edge)('%s: error tipado o resultado finito, y el proyecto sigue guardándose', async (label, command, extra) => {
    const box = await addBox(10);
    const res = await run(command, { id: box.id, ...extra });
    assertSceneSane(label);
    if (!res.ok) expect(bad(res), `${label}: rechazo sin errorCode`).toBe(true);
  }, 60_000);

  // BRECHA (mayor): simplify_mesh con tolerancia 100 (dentro del rango del bus) devuelve ok:true y deja el objeto con malla vacía.
  it('simplify_mesh con tolerancia gigante no deja una malla vacía aceptada', async () => {
    const box = await addBox(10);
    const res = await run('simplify_mesh', { id: box.id, toleranceMm: 100 });
    assertSceneSane('simplify 100');
    if (!res.ok) expect(bad(res)).toBe(true);
  });

  it('capas de IA y bus aceptan el mismo valor para los parámetros comunes (nada pasa una capa y revienta en otra)', async () => {
    const box = await addBox(10);
    const samples: Array<[string, Record<string, unknown>]> = [
      ['create_primitive', { type: 'box', width: 2000, height: 2000, depth: 2000 }],
      ['create_primitive', { type: 'sphere', radius: 2000, segments: 256 }],
      ['create_primitive', { type: 'torus', radius: 2000, tubeRadius: 1999, segments: 256 }],
      ['create_primitive', { type: 'tube', outerRadius: 0.3, innerRadius: 0.05, height: 0.1, segments: 3 }],
      ['hollow_object', { id: box.id, wallThickness: 99999 }],
      ['plane_cut', { id: box.id, axis: 'x', connectorCount: 64 }],
      ['plane_cut', { id: box.id, axis: 'x', connectorCount: 9 }],
      ['apply_texture', { id: box.id, pattern: 'fuzzy', depth: 99999 }],
      ['transform_object', { id: box.id, scale: [0, 0, 0] }],
      ['transform_object', { id: box.id, scale: [-1, 1, 1] }],
      ['transform_object', { id: box.id, scale: [99999, 1, 1] }],
    ];
    for (const [name, args] of samples) {
      const v = validateToolCall(name, args);
      if (!v.ok) continue;
      const res = await run(v.request.command, v.request.params as Record<string, unknown>);
      assertSceneSane(`${name} ${JSON.stringify(args).slice(0, 60)}`);
      if (!res.ok) expect(bad(res)).toBe(true);
    }
  }, 120_000);
});
