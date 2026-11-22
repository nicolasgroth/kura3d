/**
 * @file src/components/viewport/usePaintRadiusKeys.ts
 * @description Atajos del pincel: `[` achica y `]` agranda el radio (pasos de 0,5 mm bajo 5 mm y de
 * 1 mm desde ahí, entre 1 y 25 mm). No actúa mientras se escribe en un campo de texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { useKuraStore } from '../../store/useKuraStore';

export const PAINT_RADIUS_MIN_MM = 1;
export const PAINT_RADIUS_MAX_MM = 25;

/** Radio siguiente al pulsar `[` (dir −1) o `]` (dir +1). Pura. */
export function stepPaintRadius(radius: number, dir: 1 | -1): number {
  const step = (dir > 0 ? radius >= 5 : radius > 5) ? 1 : 0.5;
  const next = Math.round((radius + dir * step) * 2) / 2;
  return Math.min(PAINT_RADIUS_MAX_MM, Math.max(PAINT_RADIUS_MIN_MM, next));
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range';
}

/** Activa los atajos mientras `enabled` (herramienta Pintar con el pincel). */
export function usePaintRadiusKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key !== '[' && e.key !== ']') return;
      e.preventDefault();
      const { paintRadiusMm, setPaintSettings } = useKuraStore.getState();
      setPaintSettings({ paintRadiusMm: stepPaintRadius(paintRadiusMm, e.key === ']' ? 1 : -1) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
