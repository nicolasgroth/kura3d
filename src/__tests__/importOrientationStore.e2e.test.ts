/**
 * @file src/__tests__/importOrientationStore.e2e.test.ts
 * @description Importación desde el store: un STL u OBJ con normales invertidas entra reorientado
 * (volumen positivo) con un aviso que nombra el archivo, tanto en la escena como en el módulo +/−;
 * el módulo respeta la guarda de "ocupado" igual que la importación normal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { signedVolumeMm3 } from '../engine';
import { t } from '../i18n';
import { toBuffer } from '../engine/__tests__/ioFixtures';
import { useKuraStore } from '../store/useKuraStore';

const s = () => useKuraStore.getState();

/** OBJ de una caja 13×15×21 (4095 mm³) con todos los triángulos invertidos. */
function invertedBoxObj(): ArrayBuffer {
  const [w, h, d] = [13, 15, 21];
  const v = [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0], [0, 0, d], [w, 0, d], [w, h, d], [0, h, d]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const lines = [...v.map((p) => `v ${p.join(' ')}`), ...t.map(([a, b, c]) => `f ${a + 1} ${c + 1} ${b + 1}`)];
  return toBuffer(strToU8(lines.join('\n') + '\n'));
}

const toastTexts = () => s().toasts.map((toast) => toast.text);

describe('importación con normales invertidas desde el store', () => {
  beforeEach(() => {
    useKuraStore.setState({ objects: [], selectedIds: [], past: [], future: [], toasts: [], busyOperation: null, language: 'es' });
  });

  it('importModelFiles reorienta y avisa con el nombre del archivo', async () => {
    const ok = await s().importModelFiles([{ name: 'caja-invertida.obj', read: async () => invertedBoxObj() }]);
    expect(ok).toBe(true);
    const obj = s().objects[0];
    expect(signedVolumeMm3(obj.mesh)).toBeCloseTo(4095, 3);
    expect(obj.stats.volumeMm3).toBeCloseTo(4095, 3);
    expect(toastTexts().some((x) => x.includes('caja-invertida.obj') && x.includes('reorient'))).toBe(true);
  });

  it('importModelAsModule lee en el Worker/asíncrono, reorienta y avisa', async () => {
    const created = await s().importModelAsModule({ name: 'modulo.obj', buffer: invertedBoxObj() }, 'positive');
    expect(created).not.toBeNull();
    expect(signedVolumeMm3(created!.mesh)).toBeCloseTo(4095, 3);
    expect(toastTexts().some((x) => x.includes('modulo.obj') && x.includes('reorient'))).toBe(true);
  });

  it('importModelAsModule respeta la guarda de ocupado', async () => {
    useKuraStore.setState({ busyOperation: 'boolean' });
    const created = await s().importModelAsModule({ name: 'modulo.obj', buffer: invertedBoxObj() }, 'positive');
    expect(created).toBeNull();
    expect(s().objects).toHaveLength(0);
    expect(toastTexts()).toContain(t('es', 'fileProject.busy'));
  });
});
