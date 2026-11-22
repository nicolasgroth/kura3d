/**
 * @file src/engine/__tests__/stlHeader.test.ts
 * @description La cabecera del STL binario la decide quien exporta: el motor no escribe una
 * marca propia, no deja que la cabecera empiece con "solid" y la recorta a 80 bytes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import { exportMeshToBinarySTL, exportSceneToBinarySTL, stlBrandHeader } from '../io/stl';
import { createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';

const header = (bytes: Uint8Array) => strFromU8(bytes.subarray(0, 80)).replace(/\0+$/, '');

describe('cabecera del STL binario', () => {
  it('usa la cabecera que recibe y, sin ella, una neutra sin marca', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    expect(header(exportMeshToBinarySTL(mesh, 'Pieza 1'))).toBe('Pieza 1');
    expect(header(exportSceneToBinarySTL([makeObject('a', mesh)], 'Escena'))).toBe('Escena');
    for (const bytes of [exportMeshToBinarySTL(mesh), exportSceneToBinarySTL([makeObject('a', mesh)])]) {
      expect(header(bytes)).toBe('Binary STL');
      expect(header(bytes)).not.toContain(BRAND.name);
    }
  });

  it('arma la cabecera de marca con los datos que le pasa quien llama', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const text = stlBrandHeader(BRAND);
    expect(text).toBe(`${BRAND.name} by ${BRAND.author}`);
    expect(header(exportMeshToBinarySTL(mesh, text))).toBe(text);
  });

  it('nunca empieza con "solid" (se confundiría con STL ASCII) y cabe en 80 bytes', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const h = header(exportMeshToBinarySTL(mesh, '  solid pieza'));
    expect(h.trimStart().toLowerCase().startsWith('solid')).toBe(false);
    expect(h).toContain('solid pieza');
    expect(exportMeshToBinarySTL(mesh, 'x'.repeat(200)).subarray(0, 80).every((b) => b === 120)).toBe(true);
  });
});
