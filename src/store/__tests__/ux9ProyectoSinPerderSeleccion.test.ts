/**
 * @file src/store/__tests__/ux9ProyectoSinPerderSeleccion.test.ts
 * @description Lote ux9: el botón «Proyecto» muestra el panel Proyecto sin perder la selección, también con una
 * herramienta activa; al cambiar de selección, herramienta o acción el panel vuelve a su contexto normal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { panelContextOf } from '../panelContext';
import { useKuraStore } from '../useKuraStore';
import { fakeBox } from '../../test/fakeObjects';

function seed(extra: Record<string, unknown> = {}) {
  useKuraStore.setState({
    objects: [fakeBox('a', 'Pieza A'), fakeBox('b', 'Pieza B')],
    selectedIds: ['a'],
    activeAction: null,
    activeTool: 'select',
    rightCollapsed: false,
    projectPanelPin: null,
    ...extra,
  } as never);
}
const ctx = () => panelContextOf(useKuraStore.getState());

describe('«Proyecto» sin perder la selección', () => {
  beforeEach(() => seed());

  it('muestra el proyecto y conserva la selección', () => {
    useKuraStore.getState().showProjectPanel();
    expect(useKuraStore.getState().selectedIds).toEqual(['a']);
    expect(ctx()).toEqual({ kind: 'project' });
  });

  it('con una herramienta activa (Pintar) muestra el proyecto y no borra la selección', () => {
    seed({ activeTool: 'paint' });
    useKuraStore.getState().showProjectPanel();
    expect(useKuraStore.getState().selectedIds).toEqual(['a']);
    expect(ctx()).toEqual({ kind: 'project' });
  });

  it('al cambiar de selección o de herramienta el panel vuelve a su contexto y la selección sigue', () => {
    seed({ activeTool: 'paint' });
    useKuraStore.getState().showProjectPanel();
    useKuraStore.setState({ activeTool: 'select' } as never);
    expect(ctx()).toEqual({ kind: 'object', id: 'a' });
    useKuraStore.getState().showProjectPanel();
    useKuraStore.setState({ selectedIds: ['b'] } as never);
    expect(ctx()).toEqual({ kind: 'object', id: 'b' });
  });

  it('abre el panel si estaba plegado', () => {
    seed({ rightCollapsed: true });
    useKuraStore.getState().showProjectPanel();
    expect(useKuraStore.getState().rightCollapsed).toBe(false);
  });
});
