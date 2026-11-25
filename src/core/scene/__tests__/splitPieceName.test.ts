/**
 * @file src/core/scene/__tests__/splitPieceName.test.ts
 * @description Nombre visible de piezas de Dividir: rótulo primero, y códigos hostiles (regex, texto enorme)
 * se ignoran sin colgar ni alterar el nombre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { describe, expect, it } from 'vitest';
import { isPieceCode, splitPieceDisplayName } from '../splitPieceName';

describe('splitPieceDisplayName', () => {
  it('pone el rótulo primero y lo quita del final', () => {
    expect(splitPieceDisplayName('Caja A1a', 'A1a')).toBe('A1a · Caja');
    expect(splitPieceDisplayName('Caja', 'B2')).toBe('B2 · Caja');
    expect(splitPieceDisplayName('A1a', 'A1a')).toBe('A1a · A1a');
  });

  it('las piezas de una celda en varios cuerpos (A1·2) también llevan su rótulo y sin separador sobrante', () => {
    expect(isPieceCode('A1·2')).toBe(true);
    expect(splitPieceDisplayName('frieren · A1·2', 'A1·2')).toBe('A1·2 · frieren');
    expect(splitPieceDisplayName('frieren · A1', 'A1')).toBe('A1 · frieren');
  });

  it('ignora códigos hostiles o con formato inesperado', () => {
    const huge = 'a'.repeat(10_000);
    for (const code of ['(a+)+$', '.*', huge, '', 'a1', null, 42, 'A1a; DROP']) {
      const started = performance.now();
      expect(splitPieceDisplayName(`Pieza ${huge}`, code)).toBe(`Pieza ${huge}`);
      expect(performance.now() - started).toBeLessThan(50);
      expect(isPieceCode(code)).toBe(false);
    }
  });
});
