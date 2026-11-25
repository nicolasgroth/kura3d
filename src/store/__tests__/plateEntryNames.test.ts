/**
 * @file src/store/__tests__/plateEntryNames.test.ts
 * @description Nombres de los archivos dentro del ZIP de exportación por placa: nada de rutas (`..`, `/`, `\`),
 * nombres reservados de Windows, caracteres de control, vacíos ni largos, y colisiones que solo difieren en
 * mayúsculas (Windows no las distingue) siempre quedan como entradas distintas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ExportTaskArgs, ExportTaskResult } from '../../core/operations/engineTasks';
import type { PlateExportBucket } from '../../core/scene/plateExport';
import { plateEntryBase, zipPerPlate } from '../plateExportFlow';

const HOSTILE = [
  '../x', '..\\x', '../../etc/passwd', 'C:\\Windows\\x', '/abs/path', 'a/b\\c',
  'CON', 'con', 'PRN', 'AUX', 'NUL', 'nul.txt', 'COM1', 'LPT9', 'com1.stl', 'Con.',
  '', '   ', '.', '..', '...', ' . . ', '_', '__', '\u0000\u001f\u007f',
  'a\u0000b', 'tab\tname', 'line\nbreak', '  espacios  ', 'x'.repeat(500), '·', 'a:b*c?d"e<f>g|h',
];

describe('plateEntryBase', () => {
  it.each(HOSTILE)('«%j» queda como un nombre de archivo simple y seguro', (raw) => {
    const base = plateEntryBase(raw, 2);
    expect(base.length).toBeGreaterThan(0);
    expect(base.length).toBeLessThanOrEqual(80);
    expect(base).not.toMatch(/[\\/:*?"<>|\u0000-\u001f]/);
    expect(base).not.toContain('..');
    expect(base).not.toMatch(/^\.+$/);
    expect(base).not.toMatch(/[. ]$/);
    expect(base).not.toMatch(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i);
  });

  it('neutraliza las rutas relativas sin dejar separadores', () => {
    expect(plateEntryBase('../x', 0)).toBe('x');
    expect(plateEntryBase('..\\x', 0)).toBe('x');
    expect(plateEntryBase('a/b', 0)).toBe('a_b');
  });

  it('antepone «_» a los nombres reservados de Windows, con o sin extensión', () => {
    expect(plateEntryBase('CON', 0)).toBe('_CON');
    expect(plateEntryBase('nul.txt', 0)).toMatch(/^_?nul_txt$/);
    expect(plateEntryBase('Com1', 0)).toBe('_Com1');
    expect(plateEntryBase('lpt9', 0)).toBe('_lpt9');
  });

  it('también cubre COM¹ y los caracteres de control C1 y DEL', () => {
    expect(plateEntryBase('COM¹', 0)).toBe('_COM¹');
    expect(plateEntryBase('a\u007fb\u0085c', 0)).toBe('a_b_c');
  });

  it('un nombre vacío, de espacios, de puntos o de control usa «plate_N» según el índice', () => {
    for (const raw of ['', '   ', '.', '..', '...', ' . . ', '\u0000\u001f']) {
      expect(plateEntryBase(raw, 0)).toBe('plate_1');
      expect(plateEntryBase(raw, 4)).toBe('plate_5');
    }
  });

  it('recorta los nombres muy largos', () => {
    expect(plateEntryBase('x'.repeat(500), 0)).toHaveLength(80);
  });
});

describe('zipPerPlate: entradas del ZIP', () => {
  const fakeExport = async (a: ExportTaskArgs): Promise<ExportTaskResult> => ({
    files: [{ suffix: `.${a.format}`, data: new Uint8Array([1, 2, 3]) }],
  } as unknown as ExportTaskResult);
  const buckets = (names: string[]): PlateExportBucket[] =>
    names.map((name, i) => ({ id: `p${i}`, name, objects: [] }) as unknown as PlateExportBucket);
  const args = { format: 'stl' } as unknown as Omit<ExportTaskArgs, 'targets' | 'baseName'>;

  it('placas hostiles producen entradas planas, únicas sin distinguir mayúsculas y sin rutas', async () => {
    const { data, names } = await zipPerPlate(buckets(HOSTILE), args, fakeExport);
    const entries = Object.keys(unzipSync(data));
    expect(entries).toHaveLength(HOSTILE.length);
    for (const name of [...entries, ...names]) {
      expect(name).not.toMatch(/[\\/:*?"<>|\u0000-\u001f]/);
      expect(name).not.toContain('..');
      expect(name).not.toMatch(/^\./);
    }
    expect(new Set(entries.map((n) => n.toLowerCase())).size).toBe(entries.length);
  });

  it('nombres que solo difieren en mayúsculas quedan distintos incluso sin distinguirlas', async () => {
    const { data, names } = await zipPerPlate(buckets(['Placa', 'placa', 'PLACA', 'Placa 2']), args, fakeExport);
    const entries = Object.keys(unzipSync(data));
    expect(entries).toHaveLength(4);
    expect(new Set(entries.map((n) => n.toLowerCase())).size).toBe(4);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(4);
  });

  it('un nombre que coincide con el sufijo de desempate de otro tampoco colisiona', async () => {
    const { data } = await zipPerPlate(buckets(['a', 'a', 'a_2', 'A_2']), args, fakeExport);
    const entries = Object.keys(unzipSync(data));
    expect(new Set(entries.map((n) => n.toLowerCase())).size).toBe(4);
  });

  it('nombres largos que difieren solo después del recorte no colisionan', async () => {
    const { data } = await zipPerPlate(buckets(['x'.repeat(100) + 'A', 'x'.repeat(100) + 'B']), args, fakeExport);
    expect(Object.keys(unzipSync(data))).toHaveLength(2);
  });
});
