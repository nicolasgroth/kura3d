/**
 * @file src/store/__tests__/smoothParamsZone.test.ts
 * @description «Suavizar» con zona por color: si no hay un color pintado que use como zona (sin color elegido, o un
 * color que la pieza no tiene), se rechaza con un error tipado `invalid-params` en vez de suavizar la pieza entera
 * sin avisar. Vale para la tarea del motor (interfaz y bus) y para el esquema del comando (bus y MCP).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { CommandError } from '../../core/bus/commandErrors';
import type { MeshData } from '../../types/kura';
import { parseSmoothMesh } from '../smoothCommandSchemas';
import { SMOOTH_UI_DEFAULTS, smoothTaskOptions } from '../smoothParams';

const tri: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
};
const painted: MeshData = { ...tri, faceColors: ['#ff0000', '', '', '#ff0000'] };

function invalidParam(f: () => unknown): CommandError {
  let err: unknown;
  try { f(); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(CommandError);
  const ce = err as CommandError;
  expect(ce.code).toBe('invalid-params');
  expect(ce.params.param).toBe('zoneColor');
  return ce;
}

describe('zona por color sin color pintado', () => {
  it('la tarea rechaza zona «color» sin color elegido', () => {
    invalidParam(() => smoothTaskOptions({ ...SMOOTH_UI_DEFAULTS, zoneMode: 'color', zoneColor: null }, painted));
  });

  it('la tarea rechaza zona «color» en una pieza sin pintura', () => {
    invalidParam(() => smoothTaskOptions({ ...SMOOTH_UI_DEFAULTS, zoneMode: 'color', zoneColor: '#ff0000' }, tri));
  });

  it('con un color pintado arma la zona con sus triángulos', () => {
    const opts = smoothTaskOptions({ ...SMOOTH_UI_DEFAULTS, zoneMode: 'color', zoneColor: '#FF0000' }, painted);
    expect([...(opts.zone?.triangles as Uint32Array)]).toEqual([0, 3]);
  });

  it('el comando rechaza un zoneColor que la pieza no tiene y falloffRings sin zoneColor', () => {
    invalidParam(() => parseSmoothMesh({ zoneColor: '#00ff00' }, painted));
    expect(() => parseSmoothMesh({ falloffRings: 3 }, painted)).toThrow(CommandError);
  });
});
