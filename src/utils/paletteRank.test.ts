/**
 * @file src/utils/paletteRank.test.ts
 * @description Pruebas del orden por relevancia de la paleta Ctrl+K.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { rankPaletteItems, type RankableItem } from './paletteRank';

const ES: RankableItem[] = [
  { label: 'Importar 3D', category: 'Exportar e importar', keywords: 'importar stl 3mf obj abrir' },
  { label: 'Espejar Objeto en Eje X', category: 'Operaciones', keywords: 'espejar simetria mirror x axis' },
  { label: 'Exportar OBJ', category: 'Exportar e importar', keywords: 'exportar obj mtl' },
  { label: 'Exportar STL', category: 'Exportar e importar', keywords: 'exportar stl imprimir slicer' },
  { label: 'Importar STL', category: 'Exportar e importar', keywords: 'importar stl' },
  { label: 'Exportar… (STL, 3MF, OBJ, GLB, PLY)', category: 'Exportar e importar', keywords: 'exportar export stl 3mf obj' },
  { label: 'Mover al plano de la cama', category: 'Operaciones', keywords: 'mover bajar cama' },
  { label: 'Cubo', category: 'Primitivas', keywords: 'cubo mover' },
];

const EN: RankableItem[] = [
  { label: 'Import 3D', category: 'Export and import', keywords: 'import stl obj' },
  { label: 'Export OBJ', category: 'Export and import', keywords: 'export obj' },
  { label: 'Mirror Object on X Axis', category: 'Operations', keywords: 'mirror' },
];

describe('rankPaletteItems', () => {
  it('"exportar" no pone Importar 3D (coincide solo por sección) primero', () => {
    const r = rankPaletteItems(ES, 'exportar');
    expect(r[0].label.startsWith('Exportar')).toBe(true);
    expect(r.findIndex((i) => i.label === 'Importar 3D')).toBeGreaterThan(
      r.findIndex((i) => i.label === 'Exportar OBJ'),
    );
  });
  it('"obj" pone Exportar OBJ antes que Espejar Objeto', () => {
    const r = rankPaletteItems(ES, 'obj').map((i) => i.label);
    expect(r.indexOf('Exportar OBJ')).toBeLessThan(r.indexOf('Espejar Objeto en Eje X'));
    expect(r[0]).toBe('Exportar OBJ');
  });
  it('"stl" prioriza títulos con STL sobre palabras clave', () => {
    const r = rankPaletteItems(ES, 'stl').map((i) => i.label);
    expect(r.slice(0, 2)).toEqual(expect.arrayContaining(['Exportar STL', 'Importar STL']));
    expect(r.indexOf('Importar 3D')).toBeGreaterThan(1);
  });
  it('"mover" prioriza el título sobre palabras clave', () => {
    expect(rankPaletteItems(ES, 'mover')[0].label).toBe('Mover al plano de la cama');
  });
  it('en inglés "export" pone Export OBJ primero', () => {
    expect(rankPaletteItems(EN, 'export')[0].label).toBe('Export OBJ');
  });
  it('ignora tildes y mayúsculas; vacío devuelve todo; sin coincidencia, nada', () => {
    expect(rankPaletteItems(ES, 'EXPORTAR').length).toBeGreaterThan(0);
    expect(rankPaletteItems(ES, '  ')).toHaveLength(ES.length);
    expect(rankPaletteItems(ES, 'zzzz')).toHaveLength(0);
  });
});
