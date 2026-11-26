/**
 * @file src/components/__tests__/bodyPointerPlan.test.ts
 * @description Pulsar el cuerpo de una pieza ya seleccionada con Mayús apretado de antes no la deselecciona al arrastrar
 * (el clic sin movimiento sí alterna la selección, por `onClick`); una pieza no seleccionada con Mayús se elige al
 * instante; y la pista en pantalla ya no promete que Alt+arrastrar clona.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { bodyPointerPlan } from '../viewport/bodyPointerPlan';

const base = { isSelected: true, additive: false, activeTool: 'select', transformMode: 'translate', gizmoStarted: false };

describe('pulsar el cuerpo de una pieza', () => {
  it('seleccionada: siempre se puede arrastrar, también con Mayús o Ctrl apretados', () => {
    expect(bodyPointerPlan(base)).toBe('drag');
    expect(bodyPointerPlan({ ...base, additive: true })).toBe('drag');
  });

  it('con el manipulador ya activo, o en otra herramienta, se elige como siempre', () => {
    expect(bodyPointerPlan({ ...base, gizmoStarted: true })).toBe('pick');
    expect(bodyPointerPlan({ ...base, transformMode: 'rotate' })).toBe('pick');
    expect(bodyPointerPlan({ ...base, activeTool: 'measure' })).toBe('pick');
  });

  it('no seleccionada: sin Mayús solo un clic sin movimiento elige; con Mayús elige al instante', () => {
    expect(bodyPointerPlan({ ...base, isSelected: false })).toBe('clickOnly');
    expect(bodyPointerPlan({ ...base, isSelected: false, additive: true })).toBe('pick');
  });
});

describe('pista «viewport.protip.select»', () => {
  it('en ningún idioma dice que Alt+arrastrar clona el cuerpo', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      const tip = t(lang, 'viewport.protip.select');
      expect(tip).not.toMatch(/Alt\+\S*(arrastrar|drag|Ziehen|glisser|ड्रैग|拖动)/i);
      expect(tip).toContain('Alt');
    }
  });
});
