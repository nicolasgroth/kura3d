// @vitest-environment jsdom
/**
 * @file src/store/__tests__/floatingBarState.test.ts
 * @description Visibilidad de la barra flotante según herramienta, paneles de colocación, Zen, menú y selección, y su
 * preferencia local (activada por defecto).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { floatingBarVisible, loadFloatingBarEnabled, STORAGE_FLOATING_BAR_KEY, useFloatingBarPrefs, type FloatingBarContext } from '../floatingBarState';

const base: FloatingBarContext = {
  enabled: true,
  selectedCount: 1,
  activeTool: 'select',
  uiDensity: 'full',
  pickingSurface: false,
  operationOpen: false,
  placementPanelOpen: false,
  actionPanelOpen: false,
  contextMenuOpen: false,
};

describe('floatingBarVisible', () => {
  it('aparece con uno o varios objetos y la herramienta Seleccionar', () => {
    expect(floatingBarVisible(base)).toBe(true);
    expect(floatingBarVisible({ ...base, selectedCount: 5 })).toBe(true);
    expect(floatingBarVisible({ ...base, uiDensity: 'compact' })).toBe(true);
  });

  it('no aparece sin selección', () => {
    expect(floatingBarVisible({ ...base, selectedCount: 0 })).toBe(false);
  });

  it.each(['paint', 'cut', 'erase', 'measure'] as const)('no aparece con la herramienta %s', (activeTool) => {
    expect(floatingBarVisible({ ...base, activeTool })).toBe(false);
  });

  it.each(['pickingSurface', 'operationOpen', 'placementPanelOpen', 'actionPanelOpen', 'contextMenuOpen'] as const)('no aparece con %s', (key) => {
    expect(floatingBarVisible({ ...base, [key]: true })).toBe(false);
  });

  it('no aparece en modo Zen ni con la preferencia apagada', () => {
    expect(floatingBarVisible({ ...base, uiDensity: 'zen' })).toBe(false);
    expect(floatingBarVisible({ ...base, enabled: false })).toBe(false);
  });
});

describe('preferencia', () => {
  beforeEach(() => {
    localStorage.clear();
    useFloatingBarPrefs.setState({ enabled: true });
  });

  it('viene activada y se guarda al apagarla; encenderla borra la clave', () => {
    expect(loadFloatingBarEnabled()).toBe(true);
    useFloatingBarPrefs.getState().setEnabled(false);
    expect(localStorage.getItem(STORAGE_FLOATING_BAR_KEY)).toBe('0');
    expect(loadFloatingBarEnabled()).toBe(false);
    useFloatingBarPrefs.getState().setEnabled(true);
    expect(localStorage.getItem(STORAGE_FLOATING_BAR_KEY)).toBeNull();
  });
});
