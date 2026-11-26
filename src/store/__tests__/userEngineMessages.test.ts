/**
 * @file src/store/__tests__/userEngineMessages.test.ts
 * @description Los mensajes del motor se muestran con los ejes del usuario (Z = altura, Y = fondo) y el corte
 * por plano conserva la mitad del lado + del eje que ve el usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { EngineError, engineWarning } from '../../engine/engineErrors';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { keepModeFromUser } from '../commandAxes';
import { localizeEngineErrorForUser, localizeEngineWarningForUser } from '../userEngineMessages';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('mensajes del motor en ejes del usuario', () => {
  it('CUT_PLANE_OUTSIDE: el eje interno Y se muestra como Z y el interno Z como Y con el signo invertido', () => {
    const up = localizeEngineErrorForUser('es', new EngineError('CUT_PLANE_OUTSIDE', { axis: 'y', offset: 7, min: -5, max: 5 }));
    expect(up).toContain('Z = 7 mm');
    expect(up).not.toContain('y = ');
    const depth = localizeEngineErrorForUser('es', new EngineError('CUT_PLANE_OUTSIDE', { axis: 'z', offset: 7, min: -3, max: 5 }));
    expect(depth).toContain('Y = -7 mm');
    expect(depth).toContain('entre -5 y 3 mm');
  });

  it('SPLIT_AXIS_BLOCKED y SPLIT_PLANE_THIN_SECTION nombran los ejes del usuario', () => {
    const blocked = localizeEngineErrorForUser('es', new EngineError('SPLIT_AXIS_BLOCKED', { axis: 'y', size: 300, usable: 200 }));
    expect(blocked).toContain('300 mm en Z');
    const thin = localizeEngineWarningForUser('es', engineWarning('SPLIT_PLANE_THIN_SECTION', { count: 2, planes: 'Y2, Z1' }));
    expect(thin).toContain('(Z2, Y1)');
  });
});

describe('plane_cut: mitad a conservar en el sentido del usuario', () => {
  beforeEach(() => resetStore());

  it('keepModeFromUser solo invierte en el Y del usuario', () => {
    expect(keepModeFromUser('x', 'positive')).toBe('positive');
    expect(keepModeFromUser('z', 'negative')).toBe('negative');
    expect(keepModeFromUser('y', 'positive')).toBe('negative');
    expect(keepModeFromUser('y', 'both')).toBe('both');
  });

  it('con Y del usuario, "positive" deja el lado hacia el fondo (Y mayor)', async () => {
    const box = await addBox(10); // lado 10: Y de usuario entre -5 y 5
    const req: KuraCommandRequest = {
      id: 'k1',
      command: 'plane_cut',
      params: { id: box.id, axis: 'y', offset: 2, keepMode: 'positive', connectorType: 'none' },
    };
    const res = (await store().executeCommand(req, 'mcp')) as CommandBusResponse;
    expect(res.ok).toBe(true);
    expect(store().objects).toHaveLength(1);
    const kept = byId(store().objects[0].id)!;
    // Quedó Y de usuario de 2 a 5 (3 mm de fondo = Z interno); el centro está hacia el fondo.
    expect(kept.stats.dimensionsMm[2]).toBeCloseTo(3, 3);
    expect(-kept.position[2]).toBeGreaterThan(0);
  });
});
