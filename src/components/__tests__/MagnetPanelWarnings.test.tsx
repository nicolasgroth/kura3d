/**
 * @file src/components/__tests__/MagnetPanelWarnings.test.tsx
 * @description Panel «Alojamiento de imán»: además del aviso de pared, muestra una línea por el imán que sobresale
 * en una curva y otra por un hueco pegado o superpuesto a otro, con los textos de i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { closeMagnetPanel, openMagnetPanel, useMagnetPanel } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { MagnetPanel } from '../magnet/MagnetPanel';

beforeEach(() => {
  closeMagnetPanel();
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], language: 'es' });
});

describe('avisos del panel del imán', () => {
  it('muestra el aviso de curvatura y el de hueco cercano', () => {
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      useMagnetPanel.setState({ lastWall: { minWallMm: 5, side: 'bottom', through: false, protrudeMm: 0.34, neighbor: { gapMm: 0.4, overlap: false } } });
    });
    expect(screen.getByTestId('magnet-wall').textContent).toBe(t('es', 'magnet.lastWall', { wall: '5' }));
    expect(screen.getByTestId('magnet-warn-protrude').textContent).toBe(t('es', 'magnet.warn.protrude', { mm: '0,3' }));
    expect(screen.getByTestId('magnet-warn-neighbor').textContent).toBe(t('es', 'magnet.warn.near', { gap: '0,4', min: '1,2' }));
  });

  it('superpuesto: lo dice en su propia línea', () => {
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      useMagnetPanel.setState({ lastWall: { minWallMm: 5, side: 'bottom', through: false, protrudeMm: 0, neighbor: { gapMm: 0, overlap: true } } });
    });
    expect(screen.queryByTestId('magnet-warn-protrude')).toBeNull();
    expect(screen.getByTestId('magnet-warn-neighbor').textContent).toBe(t('es', 'magnet.warn.overlap'));
  });
});
