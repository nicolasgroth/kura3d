/**
 * @file src/components/__tests__/PlaneCutModal.test.tsx
 * @description Humo del diálogo de corte: prellena los valores sugeridos para la pieza y, si los
 * conectores no caben, deshabilita Cortar mostrando el motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { PlaneCutModal } from '../PlaneCutModal';

const suggest = vi.fn();
const check = vi.fn();
vi.mock('../../engine/cutConnectorSuggest', () => ({
  cutOffsetRange: () => ({ min: -10, max: 10 }),
  suggestCutConnectors: (...args: unknown[]) => suggest(...args),
  checkCutConnectorFit: (...args: unknown[]) => check(...args),
}));

const sizeLabel = `${t('es', 'dialog.cut.connectorSize')} (mm)`;
const executeButton = () => screen.getByRole('button', { name: new RegExp(t('es', 'dialog.cut.execute')), hidden: true });

beforeEach(() => {
  suggest.mockReset();
  check.mockReset();
  useKuraStore.setState({ objects: [fakeBox('a', 'Cubo 1', 40)], selectedIds: ['a'] } as never);
});

describe('PlaneCutModal', () => {
  it('prellena los valores sugeridos para la sección y permite cortar', async () => {
    suggest.mockResolvedValue({ feasible: true, size: 5, depth: 7, count: 3, maxSize: 9, maxDepth: 12, maxCount: 4 });
    check.mockResolvedValue(true);
    render(<PlaneCutModal open onClose={() => undefined} />);
    await waitFor(() => expect((screen.getByLabelText(sizeLabel) as HTMLInputElement).value).toBe('5'));
    await waitFor(() => expect(executeButton()).toHaveProperty('disabled', false));
    expect(suggest).toHaveBeenCalled();
  });

  it('deshabilita Cortar y explica el motivo cuando no cabe ningún conector', async () => {
    suggest.mockResolvedValue({ feasible: false, size: 0, depth: 0, count: 0, maxSize: 0, maxDepth: 0, maxCount: 0 });
    check.mockResolvedValue(false);
    render(<PlaneCutModal open onClose={() => undefined} />);
    const reason = t('es', 'dialog.cut.reason.none');
    await waitFor(() => expect(executeButton()).toHaveProperty('disabled', true));
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toContain(reason));
    const describedBy = executeButton().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain(reason);
  });
});
