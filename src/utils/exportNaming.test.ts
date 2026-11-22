import { describe, expect, it } from 'vitest';
import { defaultExportBase } from './exportNaming';

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
});
