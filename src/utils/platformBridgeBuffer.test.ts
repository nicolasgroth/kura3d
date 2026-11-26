/**
 * @file src/utils/platformBridgeBuffer.test.ts
 * @description `exactArrayBuffer`: el buffer de `readFile` (escritorio) se usa sin copiar cuando la
 * vista lo cubre entero, y solo se copia el tramo cuando es parte de un buffer mayor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { exactArrayBuffer } from './platformBridge';

describe('exactArrayBuffer', () => {
  it('no copia cuando la vista cubre todo el buffer', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(exactArrayBuffer(bytes)).toBe(bytes.buffer);
  });

  it('copia solo el tramo cuando la vista es parte de un buffer mayor', () => {
    const backing = new Uint8Array([9, 1, 2, 3, 9]);
    const view = backing.subarray(1, 4);
    const out = exactArrayBuffer(view);
    expect(out).not.toBe(backing.buffer);
    expect([...new Uint8Array(out)]).toEqual([1, 2, 3]);
  });
});
