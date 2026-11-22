/**
 * @file src/engine/__tests__/threeMfPartPath.test.ts
 * @description Una ruta de parte 3MF con escape URI inválido (`%E0%A4%A`) sale como
 * `ModelImportError('corrupt')`, no como un `URIError` sin tipar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { ModelImportError } from '../io/importErrors';
import { normalizePartPath } from '../io/threeMfPackage';

describe('normalizePartPath', () => {
  it('decodifica rutas válidas', () => {
    expect(normalizePartPath('/3D/My%20Model.model')).toBe('3D/My Model.model');
  });

  it('un escape inválido es ModelImportError corrupt', () => {
    let err: unknown;
    try {
      normalizePartPath('/3D/%E0%A4%A.model');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ModelImportError);
    expect((err as ModelImportError).code).toBe('corrupt');
  });
});
