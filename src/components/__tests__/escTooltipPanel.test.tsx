/**
 * @file src/components/__tests__/escTooltipPanel.test.tsx
 * @description Esc con un tooltip abierto sobre «Volver»: un solo Esc cierra el tooltip Y ejecuta el «Volver» del panel
 * (antes el primero solo cerraba la ayuda y el segundo cerraba el panel). Fuera de un panel el tooltip sigue
 * consumiendo el Esc.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { fakeBox } from '../../test/fakeObjects';
import { useKuraStore } from '../../store/useKuraStore';
import { ToolPanel } from '../contextPanel/ToolPanel';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { escapeFallsThroughToPanel, HelpTooltipLayer } from '../shell/HelpTooltipLayer';

afterEach(cleanup);

beforeEach(() => {
  useKuraStore.setState({ language: 'es', objects: [fakeBox('a', 'Caja')], selectedIds: ['a'], activeTool: 'measure', transformFocus: null } as never);
});

describe('Esc con tooltip abierto', () => {
  it('dentro de un panel de herramienta el Esc sigue hasta el panel', () => {
    const { container } = render(<div className="kura-ctx-tool"><button type="button">x</button></div>);
    expect(escapeFallsThroughToPanel(container.querySelector('button'))).toBe(true);
    expect(escapeFallsThroughToPanel(document.body)).toBe(false);
    const fuera = render(<button type="button">y</button>);
    expect(escapeFallsThroughToPanel(fuera.container.querySelector('button'))).toBe(false);
  });

  it('un solo Esc con el tooltip de «Volver» abierto cierra el tooltip y vuelve a Seleccionar', async () => {
    render(
      <>
        <HelpTooltipLayer />
        <ToolPanel tool="measure" objectId="a" ui={{} as InspectorLocalState} />
      </>,
    );
    const back = screen.getByRole('button', { name: t('es', 'panel.action.back') });
    // El foco de teclado abre el tooltip (tras una tecla de navegación).
    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => back.focus());
    fireEvent.focusIn(back);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    const tip = document.getElementById('kura-help-tooltip');
    if (tip) expect(tip.textContent).toContain('Esc');
    fireEvent.keyDown(back, { key: 'Escape' });
    expect(document.getElementById('kura-help-tooltip')).toBeNull();
    expect(useKuraStore.getState().activeTool).toBe('select');
  });
});
