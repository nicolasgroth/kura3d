/**
 * @file src/components/__tests__/SplitAssemblyStatus.test.tsx
 * @description Estado del armado arriba de "Uniones": aviso visible con qué hacer si el resultado no cierra
 * (desde el estado que devolvió la división, sin pulsar "Validar armado"), y recuento de arreglos aplicados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { SplitGroupNotes } from '../../core/scene/splitJointStatus';
import { SplitAssemblyStatus } from '../split/SplitAssemblyStatus';

const notes = (over: Partial<SplitGroupNotes>): SplitGroupNotes => ({
  warnings: [], suggestions: [], weakJoints: [], gluedByFix: [], changedByFix: [], ...over,
});

describe('SplitAssemblyStatus', () => {
  it('si la división no cierra, avisa con las piezas que traban y qué hacer', () => {
    render(
      <SplitAssemblyStatus
        language="es"
        validation={null}
        notes={notes({ report: { ok: false, steps: 3, blocked: ['B1', 'C2'], clashes: 1, interference: 0, gaps: 0 } })}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(t('es', 'splitJoints.banner.fail'));
    expect(alert.textContent).toContain('B1, C2');
    expect(alert.textContent).toContain(t('es', 'splitJoints.banner.action'));
  });

  it('si cierra no muestra alerta; con arreglos aplicados dice cuántos', () => {
    const { rerender } = render(
      <SplitAssemblyStatus language="es" validation={null} notes={notes({ report: { ok: true, steps: 3, blocked: [], clashes: 0, interference: 0, gaps: 0 } })} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <SplitAssemblyStatus
        language="es"
        validation={null}
        notes={notes({ gluedByFix: ['2'], changedByFix: ['3:dovetail', '4:peg'], report: { ok: true, steps: 3, blocked: [], clashes: 0, interference: 0, gaps: 0 } })}
      />,
    );
    expect(screen.getByTestId('split-assembly-status').textContent).toContain(t('es', 'splitJoints.banner.fixed', { glued: 1, changed: 2 }));
  });
});
