/**
 * @file src/project/saveNotConfirmed.test.ts
 * @description El código `kura-save-not-confirmed` de Rust (el usuario canceló la confirmación de guardar un
 * reciente) se tipa como `SaveNotConfirmedError`; guardar avisa sin error grave y el proyecto sigue con cambios.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { invokeProject, SaveNotConfirmedError } from './projectFiles';

describe('guardado no confirmado', () => {
  beforeEach(() => invokeMock.mockReset());

  it('tipa el código nativo como SaveNotConfirmedError', async () => {
    invokeMock.mockRejectedValueOnce('kura-save-not-confirmed');
    await expect(invokeProject('save_kura_project')).rejects.toBeInstanceOf(SaveNotConfirmedError);
  });

  it('otros errores siguen siendo errores normales', async () => {
    invokeMock.mockRejectedValueOnce('disco lleno');
    const error: unknown = await invokeProject('save_kura_project').catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(SaveNotConfirmedError);
    expect((error as Error).message).toBe('disco lleno');
  });

  it('el aviso existe en los 6 idiomas', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      expect(t(lang, 'fileProject.saveNotConfirmed')).not.toBe('fileProject.saveNotConfirmed');
    }
    expect(t('es', 'fileProject.saveNotConfirmed')).toContain('No se guardó: cancelaste la confirmación');
  });
});
