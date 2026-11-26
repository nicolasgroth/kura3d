/**
 * @file src/store/__tests__/cutPanelSingleLevel.test.ts
 * @description Cortar es un solo nivel: cerrar el panel de corte abierto desde la herramienta devuelve a Seleccionar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';

describe('Cortar en un solo nivel', () => {
  it('cerrar el corte con la herramienta Cortar activa vuelve a Seleccionar', () => {
    useKuraStore.setState({ activeTool: 'cut', activeDialog: 'cut' } as never);
    useKuraStore.getState().setActiveDialog(null);
    expect(useKuraStore.getState().activeDialog).toBeNull();
    expect(useKuraStore.getState().activeTool).toBe('select');
  });

  it('cerrar otro diálogo no cambia la herramienta', () => {
    useKuraStore.setState({ activeTool: 'cut', activeDialog: 'mold' } as never);
    useKuraStore.getState().setActiveDialog(null);
    expect(useKuraStore.getState().activeTool).toBe('cut');
  });
});
