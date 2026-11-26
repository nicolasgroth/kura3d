/**
 * @file src/components/__tests__/toolPanelBack.test.tsx
 * @description Paneles de herramienta del inspector (Pintar, Borrar, Medir, Cortar, Mover, Rotar, Escalar): llevan el
 * encabezado común con «Volver» (primero en la tabulación, Esc anunciado); pulsarlo o Esc vuelve a la herramienta
 * Seleccionar (o, en Mover / Rotar / Escalar, al resumen del objeto) y hay un solo «Volver».
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

afterEach(cleanup);

const ui = {} as InspectorLocalState;
const BACK = () => t('es', 'panel.action.back');

beforeEach(() => {
  useKuraStore.setState({ language: 'es', objects: [fakeBox('a', 'Caja')], selectedIds: ['a'], activeTool: 'select', transformFocus: null } as never);
});

const TOOLS: Array<[PanelToolId, 'paint' | 'erase' | 'measure' | 'cut' | 'translate' | 'rotate' | 'scale']> = [
  ['paint', 'paint'], ['erase', 'erase'], ['measure', 'measure'], ['cut', 'cut'],
  ['move', 'translate'], ['rotate', 'rotate'], ['scale', 'scale'],
];

describe('paneles de herramienta: «Volver»', () => {
  for (const [tool, state] of TOOLS) {
    it(`${tool}: un solo «Volver», con Esc anunciado; clic y Esc salen de la herramienta`, () => {
      const focus = state === 'translate' || state === 'rotate' || state === 'scale';
      const arm = () => useKuraStore.setState((focus ? { activeTool: 'select', transformFocus: state } : { activeTool: state }) as never);
      arm();
      render(<ToolPanel tool={tool} objectId="a" ui={ui} />);
      const backs = screen.getAllByRole('button', { name: BACK() });
      expect(backs).toHaveLength(1);
      expect(backs[0].getAttribute('aria-keyshortcuts')).toBe('Escape');
      expect(document.querySelectorAll('button')[0]).toBe(backs[0]);

      const done = () => (focus ? useKuraStore.getState().transformFocus === null : useKuraStore.getState().activeTool === 'select');
      fireEvent.click(backs[0]);
      expect(done()).toBe(true);

      arm();
      fireEvent.keyDown(backs[0], { key: 'Escape' });
      expect(done()).toBe(true);
    });
  }
});
