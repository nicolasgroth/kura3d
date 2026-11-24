/**
 * @file src/store/__tests__/pressedRailTool.test.ts
 * @description La barra de herramientas pinta exactamente una herramienta pulsada y nunca una apagada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import { pressedRailTool } from '../toolAvailability';

const a = fakeBox('a', 'a');
const base = { objects: [a], selectedIds: [] as string[], activeTool: 'select' as const, transformMode: 'translate' as const };

describe('pressedRailTool', () => {
  it('sin selección solo Seleccionar queda pulsada (no Mover, aunque el modo sea translate)', () => {
    expect(pressedRailTool(base)).toBe('select');
    expect(pressedRailTool({ ...base, objects: [] })).toBe('select');
  });
  it('con selección la pulsada es el modo del manipulador', () => {
    expect(pressedRailTool({ ...base, selectedIds: ['a'] })).toBe('move');
    expect(pressedRailTool({ ...base, selectedIds: ['a'], transformMode: 'scale' })).toBe('scale');
  });
  it('una herramienta de puntero disponible es la pulsada; apagada cae a Seleccionar', () => {
    expect(pressedRailTool({ ...base, activeTool: 'measure' })).toBe('measure');
    expect(pressedRailTool({ ...base, objects: [], activeTool: 'paint' })).toBe('select');
  });
});
