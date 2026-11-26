/**
 * @file src/components/__tests__/smoothPanelFocus.test.tsx
 * @description Foco inicial del panel «Suavizar malla» (QA 25-nov): al abrir la acción en el panel derecho el foco
 * cae en la primera casilla, «Intensidad», como promete `docs/guia/suavizar.md`, y no en «Volver».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { t } from '../../i18n';
import { RIGHT_PANEL_DEFAULT_WIDTH } from '../../store/rightPanelPrefs';
import { useKuraStore } from '../../store/useKuraStore';
import { RightInspector } from '../RightInspector';

const sphere = () => buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(20, 32, 16) });

function seed(activeAction: 'smooth' | null) {
  localStorage.clear();
  const obj = sphere();
  useKuraStore.setState({
    engineReady: true, engineError: null, busyOperation: null, language: 'es', objects: [obj], selectedIds: [obj.id], groups: [],
    past: [], future: [], toasts: [], smoothSession: null, activeAction, activeTool: 'select', rightCollapsed: false,
    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH, operationPreview: { key: null, status: 'idle', ghosts: [], guides: [] },
  } as never);
}

const intensity = () => screen.getByLabelText(t('es', 'smooth.intensity'), { selector: 'input[type="text"], input:not([type])' });

afterEach(() => {
  cleanup();
  useKuraStore.getState().clearSmoothPreview();
});

describe('Suavizar: foco al abrir', () => {
  it('abierto directamente: el foco queda en «Intensidad»', () => {
    seed('smooth');
    render(<RightInspector />);
    expect(document.activeElement).toBe(intensity());
  });

  it('abierto desde el resumen: el foco pasa a «Intensidad», no a «Volver»', () => {
    seed(null);
    render(<RightInspector />);
    act(() => useKuraStore.getState().setActiveAction('smooth'));
    expect(document.activeElement).toBe(intensity());
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: t('es', 'panel.action.back') }));
  });
});
