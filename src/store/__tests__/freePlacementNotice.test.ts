/**
 * @file src/store/__tests__/freePlacementNotice.test.ts
 * @description Crear o importar en Armado / Libre: el aviso dice claro que la pieza quedó sin placa y trae el botón
 * «Volver a Imprimir» (que cambia de vista); en Imprimir solo avisa si no cupo en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { announceFreePlacement } from '../freePlacement';
import type { ToastAction } from '../storeTypes';

const tr = (key: 'toast.placedOutsideBed' | 'viewMode.newPiece' | 'viewMode.badge.back') => t('es', key);

function setup(layout: 'print' | 'assembly', fits = true) {
  const toasts: Array<{ text: string; action?: ToastAction }> = [];
  const setViewMode = vi.fn(() => 'changed' as const);
  const state = {
    layout,
    addToast: (text: string, _kind?: string, action?: ToastAction) => { toasts.push({ text, action }); return 'id'; },
    requestCameraPreset: vi.fn(),
    setViewMode,
  };
  announceFreePlacement(state as never, tr, { fits, wasEmpty: false }, 'n1');
  return { toasts, setViewMode };
}

describe('aviso de pieza nueva sin placa', () => {
  it('en Armado / Libre: texto claro y botón «Volver a Imprimir»', () => {
    const { toasts, setViewMode } = setup('assembly');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toMatch(/sin placa/i);
    expect(toasts[0].text).toMatch(/Imprimir/);
    expect(toasts[0].text).toMatch(/Mover a placa/);
    expect(toasts[0].action?.label).toBe('Volver a Imprimir');
    toasts[0].action?.run();
    expect(setViewMode).toHaveBeenCalledWith('print');
  });

  it('en Imprimir no dice «sin placa»; solo avisa si no cupo', () => {
    expect(setup('print').toasts).toHaveLength(0);
    const fuera = setup('print', false).toasts;
    expect(fuera).toHaveLength(1);
    expect(fuera[0].action).toBeUndefined();
  });
});
