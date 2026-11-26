/**
 * @file src/components/__tests__/ExportDialogScope.test.tsx
 * @description `openExportDialog(formato, alcance)`: «Exportar selección como un STL…» abre el diálogo con STL y el
 * alcance «selección» ya elegidos; sin selección exportable cae a la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { ExportDialog, openExportDialog } from '../ExportDialog';

function openWith(selected: string[], format?: 'stl', scope?: 'selection' | 'scene') {
  useKuraStore.setState({ objects: [fakeBox('a', 'Pieza A'), fakeBox('b', 'Pieza B')], selectedIds: selected, language: 'es' } as never);
  openExportDialog(format, scope);
  render(<ExportDialog open onClose={() => undefined} />);
}

describe('ExportDialog con formato y alcance preseleccionados', () => {
  beforeEach(() => useKuraStore.setState({ activeDialog: null } as never));

  it('abre con STL y alcance «selección» marcados', () => {
    openWith(['a'], 'stl', 'selection');
    expect((screen.getByRole('radio', { name: /STL/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: /Selección/i }) as HTMLInputElement).checked).toBe(true);
    expect(useKuraStore.getState().activeDialog).toBe('export');
  });

  it('sin selección exportable usa la escena', () => {
    openWith([], 'stl', 'selection');
    expect((screen.getByRole('radio', { name: /Escena/i }) as HTMLInputElement).checked).toBe(true);
  });
});
