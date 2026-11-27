/**
 * @file src/store/__tests__/operationResultToasts.test.ts
 * @description Aviso de resultado al terminar molde, proyección sobre superficie y relieve desde
 * imagen: el mensaje nombra lo que se creó o modificó, la cámara encuadra el resultado y un error
 * del motor llega como `EngineError` tipado y localizado (sin aviso de éxito).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { ImageTo3DOptions, MoldOptions } from '../../types/kura';
import { addBox, resetStore, store } from './storeTestUtils';

const MOLD: MoldOptions = {
  mode: 'direct_2part', wallMarginMm: 5, boxWallMm: 3, splitAxis: 'x', pourSpout: false,
  pourSpoutRadiusMm: 4, keyToleranceMm: 0.25, cavityWallMm: 3,
};

function image(w = 16, h = 16): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([(i * 7) % 256, (i * 7) % 256, (i * 7) % 256, 255], i * 4);
  return rgba;
}

const relief = (over: Partial<ImageTo3DOptions> = {}): ImageTo3DOptions => ({
  name: 'Retrato', rgba: image(), pixelWidth: 16, pixelHeight: 16, widthMm: 40, depthMm: 40,
  baseThicknessMm: 1, reliefHeightMm: 2, invert: false, smoothing: 0, ...over,
});

const lastSuccess = () => [...store().toasts].reverse().find((x) => x.kind === 'success')?.text;

describe('aviso de resultado y encuadre', () => {
  beforeEach(() => resetStore());

  it('molde: nombra las piezas creadas y encuadra el molde', async () => {
    const box = await addBox(20, [0, 0, 0], { name: 'Pieza' });
    const parts = await store().generateMoldForObject(box.id, MOLD);
    expect(parts.length).toBeGreaterThan(1);
    const text = lastSuccess()!;
    for (const p of parts) expect(text).toContain(p.name);
    expect(text).toBe(t('es', 'toast.moldDone.other', { count: parts.length, names: parts.map((p) => p.name).join(', ') }));
    expect(store().cameraRequest?.preset).toBe('focus');
    expect(store().cameraRequest?.ids).toEqual(parts.map((p) => p.id));
  });

  it('proyección: nombra el objeto modificado y lo muestra', async () => {
    const box = await addBox(20, [0, 0, 0], { name: 'Caja grabada' });
    const result = await store().projectOnObjectSurface(box.id, {
      kind: 'text', text: 'K', mode: 'deboss', axis: '+z', widthMm: 8, depthMm: 1, colorHex: '#f97316',
    });
    expect(result).not.toBeNull();
    expect(lastSuccess()).toBe(t('es', 'toast.projectDone', { name: 'Caja grabada' }));
    expect(store().cameraRequest?.preset).toBe('ensure');
    expect(store().cameraRequest?.ids).toEqual([box.id]);
  });

  it('relieve, litofanía y cortador: el aviso dice qué se creó y con qué nombre', async () => {
    await addBox(10, [0, 0, 0]);
    const cases: Array<[ImageTo3DOptions['shapeMode'], string]> = [
      ['flat', 'toast.imageDone.flat'],
      ['cylindrical', 'toast.imageDone.cylindrical'],
      ['cutter', 'toast.imageDone.cutter'],
    ];
    for (const [shapeMode, key] of cases) {
      const obj = await store().generateImageRelief(relief({ name: `Img ${shapeMode}`, shapeMode, cylinderRadiusMm: 25, arcDegrees: 180, threshold: 100, cutterWallMm: 1.2 }));
      expect(obj).not.toBeNull();
      expect(lastSuccess()).toBe(t('es', key as never, { name: `Img ${shapeMode}` }));
      expect(store().cameraRequest?.ids).toEqual([obj!.id]);
    }
  });

  it('error del motor: aviso tipado y localizado, sin aviso de éxito', async () => {
    const box = await addBox(20, [0, 0, 0]);
    const seen = new Set(store().toastHistory.map((x) => x.id));
    const parts = await store().generateMoldForObject(box.id, { ...MOLD, wallMarginMm: -3 });
    expect(parts).toEqual([]);
    const added = store().toastHistory.filter((x) => !seen.has(x.id));
    expect(added.some((x) => x.kind === 'success')).toBe(false);
    expect(added.some((x) => x.kind === 'error')).toBe(true);
    expect(store().lastOperationError).toBeTruthy();
  });
});
