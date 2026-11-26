/**
 * @file src/components/__tests__/toolPanelEscapeFocus.test.tsx
 * @description Esc de los paneles de herramienta según dónde esté el foco: en el visor (canvas), en el botón de la
 * herramienta del riel, en un campo del panel y en «Volver», para las siete herramientas; y que el panel de corte
 * (OperationPanel + activeDialog «cut») es dueño del Esc sin que el diálogo abierto lo bloquee.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { PanelToolId } from '../../store/panelContext';
import { fakeBox } from '../../test/fakeObjects';
import { useKuraStore } from '../../store/useKuraStore';
import { ToolPanel } from '../contextPanel/ToolPanel';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { PlaneCutModal } from '../PlaneCutModal';

afterEach(cleanup);

const ui = {} as InspectorLocalState;
const BACK = () => t('es', 'panel.action.back');

const TOOLS: Array<[PanelToolId, 'paint' | 'erase' | 'measure' | 'cut' | 'translate' | 'rotate' | 'scale']> = [
  ['paint', 'paint'], ['erase', 'erase'], ['measure', 'measure'], ['cut', 'cut'],
  ['move', 'translate'], ['rotate', 'rotate'], ['scale', 'scale'],
];
const isFocusTool = (s: string) => s === 'translate' || s === 'rotate' || s === 'scale';

beforeEach(() => {
  useKuraStore.setState({
    language: 'es', objects: [fakeBox('a', 'Caja')], selectedIds: ['a'], activeTool: 'select', transformFocus: null,
    activeDialog: null, groupContextId: null, uiDensity: 'normal', busyProgress: null, commandPaletteOpen: false,
  } as never);
});

/** Panel de la herramienta con un visor (canvas) y un riel (botón de la herramienta) como en la app. */
function montar(tool: PanelToolId, state: string) {
  useKuraStore.setState((isFocusTool(state) ? { activeTool: 'select', transformFocus: state } : { activeTool: state }) as never);
  return render(
    <div>
      <nav className="kura-tool-rail"><button type="button" data-help={`tool.${tool}`}>Herramienta</button></nav>
      <div className="kura-viewport-wrap"><canvas data-testid="canvas" tabIndex={0} /></div>
      <ToolPanel tool={tool} objectId="a" ui={ui} />
    </div>,
  );
}
const cerrada = (state: string) => (isFocusTool(state) ? useKuraStore.getState().transformFocus === null : useKuraStore.getState().activeTool === 'select');

describe('Esc del panel de herramienta según el foco', () => {
  for (const [tool, state] of TOOLS) {
    describe(tool, () => {
      it('con el foco en el visor (canvas) cierra con un solo Esc', () => {
        montar(tool, state);
        const canvas = screen.getByTestId('canvas');
        canvas.focus();
        fireEvent.keyDown(canvas, { key: 'Escape' });
        expect(cerrada(state)).toBe(true);
      });

      it('con el foco en el botón de la herramienta del riel cierra', () => {
        montar(tool, state);
        const rail = document.querySelector<HTMLElement>('.kura-tool-rail button')!;
        rail.focus();
        fireEvent.keyDown(rail, { key: 'Escape' });
        expect(cerrada(state)).toBe(true);
      });

      it('con el foco en «Volver» cierra', () => {
        montar(tool, state);
        const back = screen.getByRole('button', { name: BACK() });
        back.focus();
        fireEvent.keyDown(back, { key: 'Escape' });
        expect(cerrada(state)).toBe(true);
      });

      it('con el foco en un campo del panel cierra', () => {
        montar(tool, state);
        const field = document.querySelector<HTMLElement>('.kura-ctx-body input, .kura-ctx-body select, .kura-ctx-body button');
        if (!field) return; // Medir y Cortar no traen campos en el panel de herramienta
        field.focus();
        fireEvent.keyDown(field, { key: 'Escape' });
        expect(cerrada(state)).toBe(true);
      });

      it('un solo «Volver» con el panel abierto', () => {
        montar(tool, state);
        expect(screen.getAllByTestId('panel-back')).toHaveLength(1);
      });
    });
  }

  it('un diálogo modal abierto sigue ganando al panel de herramienta', () => {
    montar('paint', 'paint');
    useKuraStore.setState({ activeDialog: 'about' } as never);
    const canvas = screen.getByTestId('canvas');
    fireEvent.keyDown(canvas, { key: 'Escape' });
    expect(useKuraStore.getState().activeTool).toBe('paint');
  });
});

describe('Cortar: panel de operación dueño del Esc', () => {
  it('con el panel de corte abierto (activeDialog «cut») Esc desde un campo lo cierra', () => {
    useKuraStore.setState({ activeTool: 'cut', activeDialog: 'cut' } as never);
    render(<PlaneCutModal open onClose={() => useKuraStore.getState().setActiveDialog(null)} />);
    expect(screen.getAllByTestId('panel-back')).toHaveLength(1);
    const field = document.querySelector<HTMLElement>('.kura-op-panel-body select, .kura-op-panel-body input')!;
    field.focus();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(useKuraStore.getState().activeDialog).toBeNull();
  });
});
