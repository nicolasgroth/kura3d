/**
 * @file src/components/__tests__/SimplifyPanelC.test.tsx
 * @description Simplificar (lote de usabilidad): Enter en un campo del modo ejecuta con el valor ya confirmado,
 * el objetivo en triángulos se muestra con separador de miles al salir del campo, y las fases/aviso de espera larga
 * de la barra de progreso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyRequest } from '../../engine/simplify';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifySection } from '../inspector/SimplifySection';
import { simplifyPhaseLabel, simplifySlowNote } from '../viewport/simplifyProgress';
import { useInvalidFields } from '../useInvalidFields';

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

afterEach(cleanup);

describe('Simplificar: Enter lanza la vista previa', () => {
  it('Enter en «Triángulos finales» lanza la vista previa con el valor escrito y no aplica', async () => {
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
    const calls: Array<number | SimplifyRequest> = [];
    const applied: Array<number | SimplifyRequest> = [];
    useKuraStore.setState({
      objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [],
      previewSimplify: async (_id: string, request: SimplifyRequest) => {
        calls.push(request);
      },
      simplifySelectedMesh: async (_id: string, request: number | SimplifyRequest) => {
        applied.push(request);
        return true;
      },
    } as never);
    render(<Harness id={obj.id} />);
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.target.kind')), { target: { value: 'count' } });
    const field = screen.getByLabelText(t('es', 'simplify.target.count')) as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: '400' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ mode: 'target', targetTriangles: 400 });
    expect(applied).toHaveLength(0);
  });
});

describe('Simplificar: progreso', () => {
  it('traduce las fases del motor y avisa de la espera larga solo con más de 1 millón de triángulos', () => {
    expect(simplifyPhaseLabel('es', 'simplify:verify')).toBe('Verificando el resultado');
    expect(simplifyPhaseLabel('es', 'simplify:1/1')).toBe('Reduciendo la malla');
    expect(simplifyPhaseLabel('es', 'simplify:3/12')).toBe('Ajustando al objetivo: intento 3 de 12');
    expect(simplifyPhaseLabel('es', 'import:read')).toBeNull();
    expect(simplifySlowNote('es', 'simplify', 1_200_000)).toContain('varios minutos');
    expect(simplifySlowNote('es', 'simplify', 900_000)).toBeNull();
    expect(simplifySlowNote('es', 'refine', 2_000_000)).toBeNull();
  });
});
