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
import { fixedSummary, SplitAssemblyStatus } from '../split/SplitAssemblyStatus';

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
    expect(screen.getByTestId('split-assembly-status').textContent).toContain(
      'Para que se pueda montar, Kurra3D Studio dejó 1 unión para pegar y cambió el tipo de conector en 2 uniones.',
    );
  });

  it('plurales correctos y sin frases con cero', () => {
    expect(fixedSummary('es', 0, 1)).toBe('Para que se pueda montar, Kurra3D Studio cambió el tipo de conector en 1 unión.');
    expect(fixedSummary('es', 3, 0)).toBe('Para que se pueda montar, Kurra3D Studio dejó 3 uniones para pegar.');
    expect(fixedSummary('en', 1, 1)).toBe('So it can be assembled, Kurra3D Studio left 1 joint for gluing and changed the connector type on 1 joint.');
    expect(fixedSummary('es', 0, 2)).not.toContain('0');
  });

  it('con el total de uniones para pegar, la cabecera usa la misma cifra que el aviso y la lista', () => {
    expect(fixedSummary('es', 2, 0, { count: 19, total: 26 })).toBe(
      'Para que se pueda montar, Kurra3D Studio dejó 19 de 26 uniones para pegar (2 por impedir el montaje).',
    );
    // Si todas las uniones para pegar son las del motor, no hay segunda cifra
    expect(fixedSummary('es', 3, 0, { count: 3, total: 9 })).toBe('Para que se pueda montar, Kurra3D Studio dejó 3 uniones para pegar.');
  });
});
