/**
 * @file src/components/assistants/__tests__/fileKind.test.ts
 * @description Pruebas de `sniffFileKind`: firmas PNG/JPEG y SVG solo cuando `<svg` es el elemento raíz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { sniffFileKind } from '../fileKind';

const text = (s: string) => new TextEncoder().encode(s);

describe('sniffFileKind', () => {
  it('reconoce PNG y JPEG por su firma', () => {
    expect(sniffFileKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
  });
  it('acepta un SVG simple, con prólogo XML, DOCTYPE, comentarios y BOM', () => {
    expect(sniffFileKind(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
    expect(sniffFileKind(text('﻿  \n<svg></svg>'))).toBe('svg');
    const full =
      '<?xml version="1.0"?>\n<!-- hecho a mano -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg viewBox="0 0 1 1"/>';
    expect(sniffFileKind(text(full))).toBe('svg');
    expect(sniffFileKind(text('<!DOCTYPE svg [ <!ENTITY a "b"> ]>\n<svg/>'))).toBe('svg');
  });
  it('rechaza un HTML o texto que solo contiene <svg dentro', () => {
    expect(sniffFileKind(text('<!doctype html><html><body><svg></svg></body></html>'))).toBeNull();
    expect(sniffFileKind(text('<html><svg></svg></html>'))).toBeNull();
    expect(sniffFileKind(text('hola <svg>'))).toBeNull();
    expect(sniffFileKind(text('<svgfoo></svgfoo>'))).toBeNull();
    expect(sniffFileKind(text('<!-- sin cerrar <svg>'))).toBeNull();
  });
});
