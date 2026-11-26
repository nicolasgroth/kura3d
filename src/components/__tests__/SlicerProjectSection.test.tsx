/**
 * @file src/components/__tests__/SlicerProjectSection.test.tsx
 * @description Sección «Laminador» del diálogo de exportación 3MF: sin ejemplo lo dice; al cargar un proyecto del
 * laminador muestra impresora y filamentos y lo guarda (solo la lista blanca); un archivo sin perfil da un error claro;
 * «Quitar» lo borra. Aparece en 3MF y no en STL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { STORAGE_SLICER_PROJECT_KEY } from '../../store/slicerProjectPreference';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { openLocalFiles } from '../../utils/platformBridge';
import { ExportDialog, openExportDialog } from '../ExportDialog';
import { SlicerProjectSection } from '../dialogs/SlicerProjectSection';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  openLocalFiles: vi.fn(),
}));

const text = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) => t('es', key, params);
const fileOf = (name: string, entries: Record<string, string>) => {
  const bytes = zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])));
  return { name, size: bytes.byteLength, read: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
};
const PROFILE = JSON.stringify({
  version: '1.5.3.5', printer_settings_id: 'Elegoo CC2 0.4 nozzle', print_settings_id: '0.20mm Standard', filament_settings_id: ['PLA+', 'PLA+', 'Silk'],
  printer_model: 'Elegoo Centauri Carbon 2', default_print_profile: '0.20mm Standard', print_host: '192.168.0.9', printhost_apikey: 'SECRETO',
});

describe('sección Laminador', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(openLocalFiles).mockReset();
  });

  it('cargar, mostrar y quitar el proyecto de ejemplo', async () => {
    render(<SlicerProjectSection language="es" />);
    expect(screen.getByText(text('dialog.export.slicer.none'))).toBeTruthy();
    vi.mocked(openLocalFiles).mockResolvedValue([fileOf('proyecto.3mf', { 'Metadata/project_settings.config': PROFILE })] as never);
    fireEvent.click(screen.getByRole('button', { name: text('dialog.export.slicer.load') }));
    const loaded = text('dialog.export.slicer.loaded', { printer: 'Elegoo CC2 0.4 nozzle', count: 3, filaments: 'PLA+, Silk' });
    await waitFor(() => expect(screen.getByText(loaded)).toBeTruthy());
    const stored = localStorage.getItem(STORAGE_SLICER_PROJECT_KEY)!;
    expect(stored).toContain('Elegoo Centauri Carbon 2');
    expect(stored).not.toMatch(/SECRETO|192\.168|print_host/);
    fireEvent.click(screen.getByRole('button', { name: text('dialog.export.slicer.remove') }));
    expect(screen.getByText(text('dialog.export.slicer.none'))).toBeTruthy();
    expect(localStorage.getItem(STORAGE_SLICER_PROJECT_KEY)).toBeNull();
  });

  it('un 3MF sin perfil da un error claro y no guarda nada', async () => {
    render(<SlicerProjectSection language="es" />);
    vi.mocked(openLocalFiles).mockResolvedValue([fileOf('pieza.3mf', { '3D/3dmodel.model': '<model/>' })] as never);
    fireEvent.click(screen.getByRole('button', { name: text('dialog.export.slicer.load') }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(text('dialog.export.slicer.error.no-profile', { name: 'pieza.3mf' })));
    expect(localStorage.getItem(STORAGE_SLICER_PROJECT_KEY)).toBeNull();
  });

  it('aparece en el diálogo con 3MF y no con STL', () => {
    useKuraStore.setState({ objects: [fakeBox('a', 'A')], selectedIds: [], plates: [], language: 'es', activeDialog: null } as never);
    openExportDialog('3mf', 'scene');
    const { unmount } = render(<ExportDialog open onClose={() => undefined} />);
    expect(screen.getByText(text('dialog.export.slicer.legend'))).toBeTruthy();
    unmount();
    openExportDialog('stl', 'scene');
    render(<ExportDialog open onClose={() => undefined} />);
    expect(screen.queryByText(text('dialog.export.slicer.legend'))).toBeNull();
  });
});
