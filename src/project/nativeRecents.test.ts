/**
 * @file src/project/nativeRecents.test.ts
 * @description Puente de recientes del escritorio: abreviatura de carpeta, traducción de los códigos de error
 * de Rust y que `recent_project_open` reciba solo el id (la webview nunca envía una ruta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { abbreviateFolder, openNativeRecent } from './nativeRecents';

describe('recientes nativos', () => {
  beforeEach(() => invokeMock.mockReset());

  it('abrevia la carpeta a las dos últimas partes con / o \\', () => {
    expect(abbreviateFolder('C:\\Users\\ana\\Documentos\\Modelos')).toBe('…/Documentos/Modelos');
    expect(abbreviateFolder('/home/ana/proyectos/3d')).toBe('…/proyectos/3d');
    expect(abbreviateFolder('/tmp')).toBe('/tmp');
  });

  it('abre enviando solo el id', async () => {
    invokeMock.mockResolvedValueOnce(new ArrayBuffer(0));
    await expect(openNativeRecent('abc', 'a.kura')).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('recent_project_open', { id: 'abc' });
  });

  it.each([
    ['kura-project-missing', 'project.recent.missing'],
    ['kura-project-invalid', 'project.recent.invalid'],
    ['kura-recent-unknown', 'project.recent.unknown'],
  ] as const)('traduce el código %s', async (code, key) => {
    invokeMock.mockRejectedValueOnce(code);
    await expect(openNativeRecent('abc', 'a.kura')).rejects.toThrow(t('es', key, { name: 'a.kura' }));
  });

  it('un tamaño excesivo conserva el error tipado del códec', async () => {
    invokeMock.mockRejectedValueOnce('kura-project-too-large');
    await expect(openNativeRecent('abc', 'a.kura')).rejects.toMatchObject({ code: 'too-large' });
  });
});
