/**
 * @file src/components/__tests__/ThreadPairAndScrewFit.test.tsx
 * @description Interfaz de roscas que enroscan: en el diálogo de roscas, la casilla «Crear la pareja que enrosca» cambia
 * el botón, oculta el tipo de pieza, crea la pareja con las medidas del formulario y avisa el enroscado; en el asistente,
 * el resultado de la vista previa se muestra como «Enrosca: holgura mínima X mm» o como aviso, con icono y texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useAssistantPreview } from '../../store/assistantPreview';
import { useKuraStore } from '../../store/useKuraStore';
import { AssistantScrewFitNotice } from '../assistants/AssistantScrewFitNotice';
import { ThreadModal } from '../dialogs/ThreadModal';

vi.mock('../preview/PreviewButton', () => ({ PreviewButton: () => null }));

const createPair = vi.fn();
const toast = vi.fn();

beforeEach(() => {
  createPair.mockReset();
  toast.mockReset();
  createPair.mockResolvedValue({ objects: [], fit: { status: 'ok', fits: true, minClearanceMm: 0.21, maxInterferenceMm3: 0, positions: [] } });
  useKuraStore.setState({ language: 'es', createThreadPair: createPair, addToast: toast } as never);
});

describe('diálogo de roscas: pareja que enrosca', () => {
  it('crea la pareja con las medidas del formulario y avisa el enroscado', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ThreadModal open onClose={onClose} />);
    await user.click(screen.getByRole('checkbox', { name: t('es', 'dialog.thread.pair'), hidden: true }));
    expect(screen.queryByLabelText(t('es', 'dialog.thread.kind'))).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: t('es', 'dialog.thread.pair'), hidden: true }), 'hole-bolt');
    await user.click(screen.getByRole('button', { name: new RegExp(t('es', 'dialog.thread.executePair')), hidden: true }));
    expect(createPair).toHaveBeenCalledWith(expect.objectContaining({ pair: 'hole-bolt', diameterMm: 8, pitchMm: 1.25 }));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('0,21'), 'success');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('asistente: resultado del enroscado en la vista previa', () => {
  it('ok: «Enrosca: holgura mínima…»; interferencia: aviso con el volumen', () => {
    act(() => useAssistantPreview.setState({ screwFit: { kind: 'screw_fit', ref: 'lid', onFail: 'warn', status: 'ok', fits: true, minClearanceMm: 0.305, maxInterferenceMm3: 0 } }));
    const { rerender } = render(<AssistantScrewFitNotice />);
    expect(screen.getByRole('status').textContent).toBe(t('es', 'screwFit.ok', { mm: '0,31' }));
    act(() => useAssistantPreview.setState({ screwFit: { kind: 'screw_fit', ref: 'lid', onFail: 'warn', status: 'interference', fits: false, minClearanceMm: 0, maxInterferenceMm3: 12.5 } }));
    rerender(<AssistantScrewFitNotice />);
    expect(screen.getByRole('status').getAttribute('data-status')).toBe('interference');
    expect(screen.getByRole('status').textContent).toContain('13');
    act(() => useAssistantPreview.setState({ screwFit: null }));
    rerender(<AssistantScrewFitNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
