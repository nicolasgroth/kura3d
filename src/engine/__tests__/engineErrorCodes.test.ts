/**
 * @file src/engine/__tests__/engineErrorCodes.test.ts
 * @description Los errores del motor que antes eran `new Error` en español ahora son `EngineError`
 * con código estable (traducible en los 6 idiomas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  computeConvexHull,
  createPrimitiveMesh,
  extrudeSvgToMesh,
  initManifoldEngine,
  isEngineError,
  localizeEngineError,
  type EngineErrorCode,
} from '../index';
import type { PrimitiveType } from '../../types/kura';

const withCode = (code: EngineErrorCode) => (err: unknown) => isEngineError(err) && err.code === code;

describe('Errores tipados del motor', () => {
  beforeAll(async () => {
    await initManifoldEngine();
  });

  it('envolvente sin objetos → HULL_NO_INPUT', async () => {
    await expect(computeConvexHull([])).rejects.toSatisfy(withCode('HULL_NO_INPUT'));
  });

  it('SVG sin contornos → SVG_NO_CONTOURS', async () => {
    await expect(
      extrudeSvgToMesh({ svgContent: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', depth: 2, targetWidth: 20 } as never),
    ).rejects.toSatisfy(withCode('SVG_NO_CONTOURS'));
  });

  it('primitiva desconocida → PRIMITIVE_UNSUPPORTED, traducible', async () => {
    let error: unknown;
    try {
      await createPrimitiveMesh('dodecaedro' as PrimitiveType);
    } catch (err) {
      error = err;
    }
    expect(withCode('PRIMITIVE_UNSUPPORTED')(error)).toBe(true);
    expect(localizeEngineError('en', error as never)).toMatch(/dodecaedro/);
  });
});
