/**
 * @file src/utils/exportNaming.test.ts
 * @description Pruebas del nombre base por defecto y la sanitización del nombre de archivo al exportar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { defaultExportBase, sanitizeFileBase } from './exportNaming';

const cube = { name: 'Cubo 1' };
const ball = { name: 'Esfera' };

describe('defaultExportBase', () => {
  it('con la escena completa usa el proyecto y no el objeto seleccionado', () => {
    expect(defaultExportBase('scene', 'Mi proyecto', [cube], [cube, ball], 'modelo')).toBe('Mi_proyecto');
  });
  it('con la escena completa y sin proyecto usa el nombre por defecto', () => {
    expect(defaultExportBase('scene', null, [cube], [cube, ball], 'modelo')).toBe('modelo');
  });
  it('con la selección y sin proyecto usa el único objeto', () => {
    expect(defaultExportBase('selection', null, [cube], [cube, ball], 'modelo')).toBe('Cubo_1');
  });
  it('con varias piezas seleccionadas usa el proyecto o la primera pieza con sufijo, nunca "escena"', () => {
    const a = { name: 'Cubo' };
    const b = { name: 'Bola' };
    expect(defaultExportBase('selection', 'Mi proyecto', [a, b], [a, b], 'kura3d_escena', 'seleccion')).toBe('Mi_proyecto_seleccion');
    expect(defaultExportBase('selection', null, [a, b], [a, b], 'kura3d_escena', 'seleccion')).toBe('Cubo_seleccion');
    expect(defaultExportBase('selection', 'Mi proyecto', [b], [a, b], 'kura3d_escena')).toBe('Bola');
  });
});

describe('defaultExportBase con piezas divididas', () => {
  it('varias piezas de un mismo objeto dividido → <original>_piezas', () => {
    const part = (code: string) => ({ name: `Cubo 1 · ${code}`, metadata: { split: { groupId: 'g1' } } });
    const pieces = [part('A1a'), part('A1b')];
    expect(defaultExportBase('selection', 'Proyecto', pieces, pieces, 'modelo', 'seleccion', 'piezas')).toBe('Cubo_1_piezas');
    // Piezas de dos grupos distintos: se mantiene la regla general.
    const mixed = [part('A1a'), { name: 'Bola · A1', metadata: { split: { groupId: 'g2' } } }];
    expect(defaultExportBase('selection', null, mixed, mixed, 'modelo', 'seleccion', 'piezas')).toBe('Cubo_1_A1a_seleccion');
  });
});

describe('sanitizeFileBase', () => {
  it('quita separadores tipográficos y no deja guiones bajos repetidos', () => {
    expect(sanitizeFileBase('Cilindro 1 · A1 selección')).toBe('Cilindro_1_A1_selección');
    expect(sanitizeFileBase('Pieza — final')).toBe('Pieza_final');
  });
});

describe('nombre sugerido para un grupo', () => {
  it('usa el nombre del grupo y nunca la extensión del proyecto', () => {
    const sel = [{ name: 'Alfa' }, { name: 'Beta' }];
    expect(defaultExportBase('selection', 'grupos.kura', sel, sel, 'modelo', 'seleccion', 'piezas', 'Robot')).toBe('Robot');
    expect(defaultExportBase('selection', 'grupos.kura', sel, sel, 'modelo', 'seleccion', 'piezas')).toBe('grupos_seleccion');
    expect(defaultExportBase('scene', 'grupos.kura', sel, sel, 'modelo', 'seleccion', 'piezas', 'Robot')).toBe('grupos');
  });
});
