/**
 * @file src/components/__tests__/EmptySceneOverlay.test.tsx
 * @description La tarjeta «Escena vacía» se oculta mientras un asistente tiene su vista previa fantasma a la vista y
 * vuelve al quitarla; con la vista previa de otra operación sigue visible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ASSISTANT_PREVIEW_KEY } from '../../store/assistantPreview';
import { useKuraStore } from '../../store/useKuraStore';
import { EmptySceneOverlay } from '../viewport/EmptySceneOverlay';

const preview = (key: string) => ({ key, status: 'ready' as const, ghosts: [], guides: [] });

describe('EmptySceneOverlay', () => {
  beforeEach(() => useKuraStore.setState({ language: 'es', objects: [], operationPreview: { key: null, status: 'ready', ghosts: [], guides: [] } as never }));

  it('se muestra con la escena vacía y sin vista previa', () => {
    render(<EmptySceneOverlay />);
    expect(screen.getByRole('heading', { name: 'Escena vacía' })).toBeTruthy();
  });

  it('se oculta mientras hay una vista previa de asistente y vuelve al quitarla', () => {
    render(<EmptySceneOverlay />);
    act(() => useKuraStore.setState({ operationPreview: preview(ASSISTANT_PREVIEW_KEY) as never }));
    expect(screen.queryByRole('heading', { name: 'Escena vacía' })).toBeNull();
    act(() => useKuraStore.setState({ operationPreview: preview('') as never }));
    act(() => useKuraStore.setState({ operationPreview: { key: null, status: 'ready', ghosts: [], guides: [] } as never }));
    expect(screen.getByRole('heading', { name: 'Escena vacía' })).toBeTruthy();
  });

  it('con la vista previa de otra operación no se oculta', () => {
    useKuraStore.setState({ operationPreview: preview('pattern') as never });
    render(<EmptySceneOverlay />);
    expect(screen.getByRole('heading', { name: 'Escena vacía' })).toBeTruthy();
  });
});
