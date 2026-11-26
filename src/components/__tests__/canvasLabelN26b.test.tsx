/**
 * @file src/components/__tests__/canvasLabelN26b.test.tsx
 * @description El nombre accesible del lienzo del visor solo habla del «plano de corte» cuando Cortar o Dividir
 * están a la vista; con cualquier otra herramienta es el nombre base.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const canvas = document.createElement('canvas');
vi.mock('@react-three/fiber', () => ({ useThree: (sel: (s: unknown) => unknown) => sel({ gl: { domElement: canvas } }) }));

import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ViewportCanvasA11y } from '../viewport/ViewportCanvasA11y';

afterEach(cleanup);

describe('nombre accesible del lienzo del visor', () => {
  it('sin Cortar ni Dividir no menciona el plano de corte', () => {
    useKuraStore.setState({ language: 'es', activeTool: 'measure', activeDialog: null } as never);
    render(<ViewportCanvasA11y />);
    expect(canvas.getAttribute('aria-label')).toBe(t('es', 'viewport.canvasLabelBase'));
    expect(canvas.getAttribute('aria-label')).not.toMatch(/plano/i);
  });

  it('con Cortar o Dividir conserva la ayuda de las flechas', () => {
    useKuraStore.setState({ language: 'es', activeTool: 'select', activeDialog: null } as never);
    render(<ViewportCanvasA11y />);
    act(() => useKuraStore.setState({ activeTool: 'cut' } as never));
    expect(canvas.getAttribute('aria-label')).toBe(t('es', 'viewport.canvasLabel'));
    act(() => useKuraStore.setState({ activeTool: 'select', activeDialog: 'splitForBed' } as never));
    expect(canvas.getAttribute('aria-label')).toBe(t('es', 'viewport.canvasLabel'));
    act(() => useKuraStore.setState({ activeDialog: null } as never));
    expect(canvas.getAttribute('aria-label')).toBe(t('es', 'viewport.canvasLabelBase'));
  });
});
