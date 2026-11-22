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

describe('sanitizeFileBase', () => {
  it('quita separadores tipográficos y no deja guiones bajos repetidos', () => {
    expect(sanitizeFileBase('Cilindro 1 · A1 selección')).toBe('Cilindro_1_A1_selección');
    expect(sanitizeFileBase('Pieza — final')).toBe('Pieza_final');
  });
});
