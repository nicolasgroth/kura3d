/**
 * @file src/components/__tests__/recoveryBannerCollapsed.test.tsx
 * @description El aviso de «Borradores locales» recuerda que el usuario lo plegó al volver a montarse y dice
 * cuántos objetos trae el borrador (si el borrador lo guardó).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectRecoveryBanner } from '../ProjectRecoveryBanner';
import type { RecoveryDraftInfo } from '../../project/projectRecoveryStorage';

const draft = { id: 'd1', name: 'Mi pieza', updatedAt: Date.now() } as unknown as RecoveryDraftInfo;
const props = { drafts: [draft], busy: false, onRestore: () => undefined, onDiscard: () => undefined };

describe('ProjectRecoveryBanner: recuerda el estado plegado', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('plegar queda guardado y el siguiente montaje abre plegado', () => {
    const first = render(<ProjectRecoveryBanner {...props} />);
    expect((first.container.querySelector('.kura-recovery-body') as HTMLElement).hidden).toBe(false);
    fireEvent.click(first.container.querySelector('.kura-recovery-heading button') as HTMLElement);
    expect((first.container.querySelector('.kura-recovery-body') as HTMLElement).hidden).toBe(true);
    first.unmount();

    const second = render(<ProjectRecoveryBanner {...props} />);
    expect((second.container.querySelector('.kura-recovery-body') as HTMLElement).hidden).toBe(true);
    fireEvent.click(second.container.querySelector('.kura-recovery-heading button') as HTMLElement);
    second.unmount();

    const third = render(<ProjectRecoveryBanner {...props} />);
    expect((third.container.querySelector('.kura-recovery-body') as HTMLElement).hidden).toBe(false);
    expect(screen.getByText('Mi pieza')).toBeTruthy();
  });

  it('dice cuántos objetos trae el borrador, y nada si es un borrador anterior sin el dato', () => {
    const withCount = { ...draft, objectCount: 3 } as RecoveryDraftInfo;
    const first = render(<ProjectRecoveryBanner {...props} drafts={[withCount]} />);
    expect(screen.getByTestId('recovery-object-count').textContent).toBe('3 objetos');
    first.unmount();
    render(<ProjectRecoveryBanner {...props} />);
    expect(screen.queryByTestId('recovery-object-count')).toBeNull();
  });
});
