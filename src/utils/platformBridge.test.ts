/**
 * @file src/utils/platformBridge.test.ts
 * @description Pruebas de la validación de extensiones de rutas elegidas en diálogos nativos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { filterExtensions, hasAllowedExtension } from './platformBridge';

describe('hasAllowedExtension', () => {
  const models = filterExtensions([{ name: 'Modelos', extensions: ['STL', '3mf', 'obj'] }]);

  it('accepts matching extensions regardless of case and separator style', () => {
    expect(hasAllowedExtension('C:\\Users\\a\\pieza.STL', models)).toBe(true);
    expect(hasAllowedExtension('/home/a/pieza.final.3mf', models)).toBe(true);
  });

  it('rejects other or missing extensions and dot files', () => {
    expect(hasAllowedExtension('/home/a/pieza.stl.exe', models)).toBe(false);
    expect(hasAllowedExtension('/home/a/pieza', models)).toBe(false);
    expect(hasAllowedExtension('/home/a/.stl', models)).toBe(false);
    expect(hasAllowedExtension('C:\\carpeta.stl\\archivo', models)).toBe(false);
  });

  it('does not restrict when no extension filter exists', () => {
    expect(hasAllowedExtension('/tmp/x.bin', [])).toBe(true);
  });
});
