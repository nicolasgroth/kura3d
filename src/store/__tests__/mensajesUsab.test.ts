/**
 * @file src/store/__tests__/mensajesUsab.test.ts
 * @description Lote de usabilidad del centro de mensajes: los avisos que piden actuar son advertencias y el cierre
 * automático de un emergente no cuenta como descartado por el usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';
import { engineWarningKind } from '../engineWarningKind';
import { engineWarning } from '../../engine/engineErrors';
import { t } from '../../i18n';

beforeEach(() => useKuraStore.setState({ toasts: [], toastHistory: [], language: 'es' } as never));

describe('tipo de los avisos del motor', () => {
  it('los que piden revisar o reparar son advertencias; el resto, información', () => {
    expect(engineWarningKind({ code: 'IMPORT_NORMALS_INCONSISTENT' })).toBe('warning');
    expect(engineWarningKind({ code: 'REPAIR_LARGE_HOLES_FILLED' })).toBe('warning');
    expect(engineWarningKind({ code: 'SPLIT_PART_NOT_CLOSED' })).toBe('warning');
    expect(engineWarningKind({ code: 'IMPORT_NORMALS_FLIPPED' })).toBe('info');
    expect(engineWarningKind({ code: 'SPLIT_GLUE_SUMMARY' })).toBe('info');
  });

  it('las advertencias del motor se registran como advertencia en el histórico', () => {
    const state = useKuraStore.getState() as unknown as { addToast: (text: string, kind: string) => void };
    const kinds = ['IMPORT_NORMALS_INCONSISTENT', 'IMPORT_NORMALS_FLIPPED'].map((code) => engineWarningKind(engineWarning(code as never, { name: 'a.obj' })));
    expect(kinds).toEqual(['warning', 'info']);
    state.addToast(t('es', 'toast.placedOutsideBed'), 'warning');
    expect(useKuraStore.getState().toastHistory.at(-1)?.kind).toBe('warning');
  });
});

describe('caducar no es descartar', () => {
  const action = { label: 'Separar', run: () => undefined, targetIds: ['a'] };

  it('expireToast cierra el emergente sin vetar el aviso', () => {
    useKuraStore.getState().addToast('Aviso', 'info', action);
    useKuraStore.getState().expireToast(useKuraStore.getState().toasts[0].id);
    expect(useKuraStore.getState().toasts).toHaveLength(0);
    useKuraStore.getState().addToast('Aviso', 'info', action);
    expect(useKuraStore.getState().toasts).toHaveLength(1);
  });

  it('dismissToast (cierre explícito) sí lo veta', () => {
    useKuraStore.getState().addToast('Aviso', 'info', action);
    useKuraStore.getState().dismissToast(useKuraStore.getState().toasts[0].id);
    useKuraStore.getState().addToast('Aviso', 'info', action);
    expect(useKuraStore.getState().toasts).toHaveLength(0);
  });
});
