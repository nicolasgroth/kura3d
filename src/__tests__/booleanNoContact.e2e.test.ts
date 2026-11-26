/**
 * @file src/__tests__/booleanNoContact.e2e.test.ts
 * @description Restar o intersectar piezas que no se tocan avisa y no crea paso de historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';

const s = () => useKuraStore.getState();

describe('booleanas sin contacto', () => {
  beforeEach(() => {
    useKuraStore.setState({ objects: [], selectedIds: [], past: [], future: [], toasts: [], language: 'es' } as never);
  });

  it('restar piezas separadas avisa "no se tocan" y no cambia la escena ni el historial', async () => {
    const a = (await s().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [0, 0, 0] }))!;
    const b = (await s().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { position: [60, 0, 0] }))!;
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    const pastBefore = s().past.length;
    const result = await s().runBooleanOnSelection('subtract');
    expect(result).toBeNull();
    expect(s().objects.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(s().past.length).toBe(pastBefore);
    const texts = (s() as unknown as { toasts: Array<{ text?: string; message?: string }> }).toasts.map((x) => x.text ?? x.message);
    expect(texts).toContain(t('es', 'toast.booleanNoContact'));
  });

  it('restar piezas que se cruzan sigue funcionando', async () => {
    const a = (await s().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [0, 0, 0] }))!;
    const b = (await s().createPrimitive('box', { width: 10, height: 30, depth: 10 }, { position: [0, 0, 0] }))!;
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    const result = await s().runBooleanOnSelection('subtract');
    expect(result).not.toBeNull();
    expect(s().objects).toHaveLength(1);
  });
});
