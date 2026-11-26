/**
 * @file src/components/__tests__/saveProgressBar.test.tsx
 * @description Barra del visor al guardar: no aparece antes de 400 ms, luego muestra la fase y un
 * `role="progressbar"` con el porcentaje real, y desaparece al terminar. Textos en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t, type TranslationKey } from '../../i18n';
import { trackSaveProgress } from '../../store/saveProgress';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationProgressBar } from '../viewport/OperationProgressBar';

afterEach(() => {
  vi.useRealTimers();
  useKuraStore.setState({ busyProgress: null });
});

describe('barra de avance del guardado', () => {
  it('aparece pasado el umbral con porcentaje real y se retira al terminar', () => {
    vi.useFakeTimers();
    useKuraStore.setState({ language: 'es', busyProgress: null });
    const tracker = trackSaveProgress(useKuraStore.getState, useKuraStore.setState);
    render(<OperationProgressBar />);
    act(() => tracker.update(10, 'encode'));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { tracker.update(64, 'compress'); vi.advanceTimersByTime(200); });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(t('es', 'progress.op.project_save'));
    expect(status.textContent).toContain(t('es', 'saveProgress.compress'));
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('64');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    // El porcentaje visible no va en la región viva (se oye por la barra, no en cada paso).
    expect(screen.getByTestId('op-progress-percent').getAttribute('aria-hidden')).toBe('true');
    act(() => tracker.writing());
    expect(status.textContent).toContain(t('es', 'saveProgress.write'));
    act(() => tracker.end());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un guardado que termina antes del umbral nunca se muestra', () => {
    vi.useFakeTimers();
    const tracker = trackSaveProgress(useKuraStore.getState, useKuraStore.setState);
    render(<OperationProgressBar />);
    act(() => { tracker.update(0, 'encode'); vi.advanceTimersByTime(150); tracker.update(100, 'compress'); tracker.end(); });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('los textos existen en los 6 idiomas', () => {
    const keys: TranslationKey[] = ['progress.op.project_save', 'saveProgress.encode', 'saveProgress.compress', 'saveProgress.write', 'saveProgress.percent'];
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      for (const key of keys) expect(t(lang, key)).not.toBe(key);
    }
  });
});
