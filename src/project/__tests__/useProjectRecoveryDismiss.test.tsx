/**
 * @file src/project/__tests__/useProjectRecoveryDismiss.test.tsx
 * @description El aviso de «Borradores locales» desaparece al recuperar un borrador (aunque queden
 * otros guardados) y no ofrece borradores de 0 objetos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useKuraStore } from '../../store/useKuraStore';
import type { RecoveryDraftInfo } from '../projectRecoveryStorage';
import { useProjectRecovery } from '../useProjectRecovery';

const drafts: RecoveryDraftInfo[] = [
  { id: 'vacio', name: 'Vacío', updatedAt: 3, objectCount: 0 },
  { id: 'uno', name: 'Uno', updatedAt: 2, objectCount: 2 },
  { id: 'dos', name: 'Dos', updatedAt: 1, objectCount: 4 },
];

vi.mock('../projectRecoveryStorage', () => ({
  listRecoveryDrafts: vi.fn(async () => drafts),
  discardRecoveryDraft: vi.fn(async () => true),
}));
vi.mock('../projectRecoveryAutosave', () => ({
  startProjectRecovery: () => ({ stop: () => undefined, flushNow: async () => undefined, checkpointSoon: () => undefined, discardOnClose: async () => undefined }),
}));

describe('useProjectRecovery', () => {
  beforeEach(() => {
    useKuraStore.setState({ engineReady: true, recoverProject: vi.fn(async () => true) });
  });
  afterEach(() => cleanup());

  it('no ofrece el borrador vacío y el aviso se cierra al recuperar otro', async () => {
    const { result } = renderHook(() => useProjectRecovery());
    await waitFor(() => expect(result.current.drafts.map((d) => d.id)).toEqual(['uno', 'dos']));
    await act(async () => {
      result.current.restore(result.current.drafts[0]);
    });
    await waitFor(() => expect(result.current.drafts).toEqual([]));
  });
});
