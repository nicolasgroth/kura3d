/**
 * @file src/components/__tests__/ExportDialogPlates.test.tsx
 * @description Diálogo de exportación con placas (lote P6): con piezas en dos placas aparece la elección (en 3MF un
 * archivo con todas o uno por placa; en STL, un ZIP por placa) con su ayuda y el aviso de piezas sin placa; con
 * piezas de una sola placa o sin placas, el diálogo de siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { ScenePlate } from '../../types/plates';
import { ExportDialog, openExportDialog } from '../ExportDialog';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] },
];

function openWith(refs: Array<string | undefined>, format: 'stl' | '3mf', plates = PLATES) {
  const objects = refs.map((ref, i) => ({ ...fakeBox(`o${i}`, `Pieza ${i}`), ...(ref ? { plateRef: ref } : {}) }));
  const exportModel = vi.fn(async (_request: unknown) => true);
  useKuraStore.setState({ objects, selectedIds: [], plates, language: 'es', exportModel } as never);
  openExportDialog(format, 'scene');
  render(<ExportDialog open onClose={() => undefined} />);
  return exportModel;
}

const text = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) => t('es', key, params);

describe('ExportDialog con placas', () => {
  beforeEach(() => useKuraStore.setState({ activeDialog: null } as never));

  it('3MF con piezas en dos placas: un archivo con todas (por defecto) o un 3MF por placa en ZIP', async () => {
    const exportModel = openWith(['p1', 'p2'], '3mf');
    expect(screen.getByText(text('dialog.export.plates.legend', { count: 2 }))).toBeTruthy();
    const combined = screen.getByRole('radio', { name: text('dialog.export.plates.combined') }) as HTMLInputElement;
    expect(combined.checked).toBe(true);
    expect(screen.getByText(text('dialog.export.plates.combined.hint'))).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: text('dialog.export.plates.perPlate') }));
    expect(screen.getByRole('button', { name: /\.zip/ })).toBeTruthy();
    fireEvent.submit(document.querySelector('form')!);
    await vi.waitFor(() => expect(exportModel).toHaveBeenCalled());
    expect(exportModel.mock.calls[0][0]).toMatchObject({ format: '3mf', plateMode: 'perPlate' });
  });

  it('STL con piezas en dos placas: avisa un ZIP por placa y cuántas piezas sin placa quedan fuera', () => {
    openWith(['p1', 'p2', undefined], 'stl');
    expect(screen.getByText(text('dialog.export.plates.onlyZip', { format: 'STL' }))).toBeTruthy();
    expect(screen.getByText(text('dialog.export.plates.excluded', { count: 1 }))).toBeTruthy();
    expect(screen.getByRole('button', { name: /\.zip/ })).toBeTruthy();
  });

  it('todas las piezas en una placa o sin placas: el diálogo de siempre', () => {
    openWith(['p2', 'p2'], 'stl');
    expect(screen.queryByText(text('dialog.export.plates.legend', { count: 2 }))).toBeNull();
    expect(screen.getByRole('button', { name: /\.stl/ })).toBeTruthy();
  });
});
