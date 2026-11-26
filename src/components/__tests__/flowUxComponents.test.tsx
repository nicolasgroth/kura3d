/**
 * @file src/components/__tests__/flowUxComponents.test.tsx
 * @description Pruebas de componente del lote de flujo: F2 abre el renombrado con el texto seleccionado
 * (Escape cancela y devuelve el foco), Escape en la búsqueda vuelve a la lista, F4 avisa lo repetido,
 * confirmación de vaciar la cama y aviso de pintar sobre piezas paramétricas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeMeshFingerprint } from '../../engine/meshFingerprint';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { useDecisionStore, settleDecision } from '../../utils/confirmDialog';
import { confirmClearScene } from '../confirmClearScene';
import { repeatWithToast } from '../useFunctionKeys';
import { SceneObjectList } from '../scene/SceneObjectList';
import { SceneSearch } from '../scene/SceneSearch';
import { confirmPaintOnParametric, paintWouldDropParameters, resetPaintParametricGuard } from '../viewport/paintParametricGuard';

const objects = () => useKuraStore.getState().objects;

describe('F2: renombrar en línea', () => {
  beforeEach(() => {
    useKuraStore.setState({ objects: [fakeBox('a', 'Cilindro Pivote'), fakeBox('b', 'Beta')], selectedIds: ['a'] } as never);
  });

  it('abre con todo el texto seleccionado: escribir reemplaza el nombre', async () => {
    const user = userEvent.setup();
    render(<SceneObjectList />);
    act(() => {
      useKuraStore.getState().requestRename('a');
    });
    const field = (await screen.findByRole('textbox')) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('Cilindro Pivote'.length);
    await user.keyboard('Eje{Enter}');
    expect(objects()[0].name).toBe('Eje');
  });

  it('Escape cancela sin cambiar el nombre y devuelve el foco a la lista', async () => {
    const user = userEvent.setup();
    render(<SceneObjectList />);
    act(() => {
      useKuraStore.getState().requestRename('a');
    });
    await screen.findByRole('textbox');
    await user.keyboard('Otro{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(objects()[0].name).toBe('Cilindro Pivote');
    expect(document.activeElement).toBe(screen.getByRole('tree'));
  });
});

describe('F3: búsqueda de escena', () => {
  it('Escape borra el texto y devuelve el foco a la lista', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ objects: [fakeBox('a', 'Alfa')], selectedIds: [], sceneFilter: '' } as never);
    render(
      <>
        <SceneSearch />
        <SceneObjectList />
      </>,
    );
    const input = screen.getByRole('textbox', { name: /buscar/i });
    await user.click(input);
    await user.keyboard('al{Escape}');
    expect(useKuraStore.getState().sceneFilter).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('tree'));
  });
});

describe('F4: retroalimentación', () => {
  it('avisa «Repetido: …» tras repetir la última acción', async () => {
    useKuraStore.setState({ objects: [fakeBox('a', 'Alfa')], selectedIds: ['a'], toasts: [] } as never);
    useKuraStore.getState().duplicateObjects(['a']);
    useKuraStore.setState({ toasts: [], lastRepeatable: { kind: 'duplicate' } } as never);
    await repeatWithToast();
    expect(useKuraStore.getState().toasts.some((t) => t.text.startsWith('Repetido:'))).toBe(true);
  });
});

describe('Vaciar cama: confirmación', () => {
  it('pide confirmar con el número de objetos y solo vacía si se acepta', async () => {
    useKuraStore.setState({ objects: [fakeBox('a', 'A'), fakeBox('b', 'B'), fakeBox('c', 'C')], selectedIds: [] } as never);
    const cancelled = confirmClearScene();
    expect(useDecisionStore.getState().request?.message).toContain('3');
    expect(useDecisionStore.getState().request?.safeId).toBe('cancel');
    settleDecision('cancel');
    expect(await cancelled).toBe(false);
    expect(objects()).toHaveLength(3);

    const accepted = confirmClearScene();
    settleDecision('clear');
    expect(await accepted).toBe(true);
    expect(objects()).toHaveLength(0);
    expect(useKuraStore.getState().toasts.at(-1)?.action?.label).toBe('Deshacer');
  });
});

describe('Pintar sobre una pieza paramétrica', () => {
  beforeEach(() => resetPaintParametricGuard());
  const box = () => {
    const o = fakeBox('a', 'Cubo');
    (o as { parametric?: unknown }).parametric = { kind: 'primitive', meshFingerprint: computeMeshFingerprint(o.mesh) };
    return o;
  };

  it('solo avisa si el trazo refinará la malla; Cancelar no pinta; «no volver a preguntar» vale para la sesión', async () => {
    const obj = box();
    expect(paintWouldDropParameters(obj, false)).toBe(false);
    expect(paintWouldDropParameters(obj, true)).toBe(true);

    const cancelled = confirmPaintOnParametric(obj, 'es');
    expect(useDecisionStore.getState().request?.actions.map((a) => a.id)).toEqual(['paint', 'paintAlways', 'cancel']);
    settleDecision('cancel');
    expect(await cancelled).toBe(false);
    expect(paintWouldDropParameters(obj, true)).toBe(true);

    const once = confirmPaintOnParametric(obj, 'es');
    settleDecision('paint');
    expect(await once).toBe(true);
    expect(paintWouldDropParameters(obj, true)).toBe(false); // una sola vez por objeto
    const other = { ...box(), id: 'z' };
    expect(paintWouldDropParameters(other, true)).toBe(true);

    const always = confirmPaintOnParametric(other, 'es');
    settleDecision('paintAlways');
    await always;
    expect(paintWouldDropParameters({ ...box(), id: 'y' }, true)).toBe(false);
  });
});
