/**
 * @file src/engine/__tests__/projectionSuggest.test.ts
 * @description Sugerencias de la proyección de texto: cara por defecto (la plana más grande, o la
 * más grande mirando a la cámara) y ancho inicial que cabe en esa cara con margen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { suggestProjectionFace, suggestProjectionWidth } from '../projectionSuggest';
import { makeObject } from './geometryTestUtils';

beforeAll(async () => {
  await initManifoldEngine();
});

describe('sugerencias de proyección', () => {
  it('en una placa de 60×4×40 elige la cara de 60×40, no el canto', async () => {
    const plate = makeObject('placa', await createPrimitiveMesh('box', { width: 60, height: 4, depth: 40 }));
    expect(suggestProjectionFace(plate)).toBe('+y');
  });

  it('en una placa de pie (60×40×4) elige el frente +z', async () => {
    const plate = makeObject('placa', await createPrimitiveMesh('box', { width: 60, height: 40, depth: 4 }));
    expect(suggestProjectionFace(plate)).toBe('+z');
  });

  it('con cámara, elige la cara grande que la mira', async () => {
    const plate = makeObject('placa', await createPrimitiveMesh('box', { width: 60, height: 40, depth: 4 }));
    expect(suggestProjectionFace(plate, { cameraPosition: [0, 20, -200] })).toBe('-z');
    // Mirando desde el costado (a la altura de la pieza), solo el canto +x mira a la cámara.
    expect(suggestProjectionFace(plate, { cameraPosition: [300, 20, 0] })).toBe('+x');
  });

  it('respeta la rotación del objeto', async () => {
    const plate = makeObject('placa', await createPrimitiveMesh('box', { width: 60, height: 4, depth: 40 }), {
      rotation: [Math.PI / 2, 0, 0],
    });
    // Tras girar 90° en X, la cara grande queda mirando a ±Z.
    expect(['+z', '-z']).toContain(suggestProjectionFace(plate));
  });

  it('el ancho sugerido cabe en la cara con margen y la proyección no se sale', async () => {
    const plate = makeObject('placa', await createPrimitiveMesh('box', { width: 60, height: 4, depth: 40 }));
    const width = await suggestProjectionWidth(plate, '+y', 'Kura3D');
    expect(width).toBeGreaterThan(30);
    expect(width).toBeLessThanOrEqual(60 * 0.85 + 1e-6);
    const result = await projectGraphicOntoSurface(plate, {
      kind: 'text',
      text: 'Kura3D',
      mode: 'emboss',
      axis: '+y',
      widthMm: width,
      depthMm: 1,
      colorHex: '#f97316',
    });
    expect(result.mesh.positions.length).toBeGreaterThan(0);
  });

  it('un texto alto y corto queda limitado por el alto de la cara', async () => {
    const strip = makeObject('tira', await createPrimitiveMesh('box', { width: 80, height: 4, depth: 10 }));
    const width = await suggestProjectionWidth(strip, '+y', 'OK');
    // "OK" mide ~2,4 veces su alto: el límite lo pone el alto de 10 mm (con margen), no los 80 mm.
    expect(width).toBeLessThan(30);
    expect(width).toBeGreaterThan(12);
  });
});
