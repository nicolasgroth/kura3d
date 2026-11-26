/**
 * @file src/components/__tests__/focusReturnN26b.test.tsx
 * @description El foco no se pierde al documento al cerrar paneles cuyo botón de origen se desmonta: Dividir (vuelve al
 * botón que lo abre aunque se remonte), «Volver a Imprimir» (al radio activo de «Modo de vista»), la acción de un
 * aviso (`focusAfter`) y Simplificar al terminar la vista previa (a «Simplificar» o de vuelta a «Vista previa»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { SIMPLIFY_GHOST_DEFAULTS, simplifySignature } from '../../store/slices/simplifyPreviewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { SimplifySection } from '../inspector/SimplifySection';
import { focusActiveViewMode } from '../viewmode/ViewModeExplode';
import { focusWhenMounted } from '../ToastActionButton';
import { useInvalidFields } from '../useInvalidFields';

// jsdom no calcula diseño: todo elemento conectado cuenta como visible.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const frames = (n = 5) => act(async () => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null))); });

describe('foco al cerrar Dividir', () => {
  it('con el botón de origen desmontado vuelve al que se monta de nuevo', async () => {
    const App: React.FC = () => {
      const [open, setOpen] = useState(false);
      return (
        <div id="kura-inspector-panel">
          {!open && <button type="button" data-opens="splitForBed" onClick={() => setOpen(true)}>Dividir</button>}
          <OperationPanel open={open} onClose={() => setOpen(false)} title="Panel" returnFocusSelector='#kura-inspector-panel [data-opens="splitForBed"]'>
            <button type="button">Dentro</button>
          </OperationPanel>
        </div>
      );
    };
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Dividir' });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dentro' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await frames();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dividir' }));
  });
});

describe('focos tras desmontarse el control', () => {
  it('«Volver a Imprimir»: el foco va al radio activo del modo de vista', async () => {
    render(
      <div data-testid="viewmode-selector">
        <button role="radio" aria-checked="false">Armado</button>
        <button role="radio" aria-checked="true">Imprimir</button>
      </div>,
    );
    focusActiveViewMode();
    await frames();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Imprimir' }));
  });

  it('el control de un aviso que aparece después recibe el foco', async () => {
    focusWhenMounted('#chip');
    await frames(1);
    render(<button id="chip">Placa 1</button>);
    await frames();
    expect(document.activeElement?.id).toBe('chip');
  });
});

describe('Simplificar: foco al terminar la vista previa', () => {
  it('«Cancelar» desmontado devuelve el foco a «Vista previa»; al estar lista, al informe', async () => {
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], simplifyPreview: null });
    const Harness: React.FC = () => {
      const invalid = useInvalidFields();
      const o = useKuraStore((s) => s.objects.find((x) => x.id === 'sph'))!;
      return <SimplifySection primary={o} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
    };
    render(<Harness />);
    const sig = simplifySignature({ mode: 'lossless' });
    const session = { objectId: 'sph', phase: null, signature: sig, report: null, error: null, ...SIMPLIFY_GHOST_DEFAULTS };
    act(() => useKuraStore.setState({ simplifyPreview: { ...session, status: 'computing' } }));
    const cancel = await screen.findByTestId('simplify-preview-cancel');
    cancel.focus();
    act(() => useKuraStore.setState({ simplifyPreview: null }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('simplify-preview')));

    act(() => useKuraStore.setState({ simplifyPreview: { ...session, status: 'computing' } }));
    (document.activeElement as HTMLElement).blur();
    const report = { mode: 'lossless', objectId: 'sph', applied: true, toleranceMm: 0, trianglesBefore: 512, trianglesAfter: 400, volumeBeforeMm3: 1, volumeAfterMm3: 1, volumeChangePct: 0, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0, deviationSamples: 0, warnings: [], rejectedBy: [], ms: 1 };
    act(() => useKuraStore.setState({ simplifyPreview: { ...session, status: 'ready', report: report as never } }));
    // El foco va al informe (con nombre accesible), no al botón «Simplificar», que modificaría la pieza.
    await waitFor(() => expect(document.activeElement?.className).toContain('kura-simplify-report'));
  });
});
