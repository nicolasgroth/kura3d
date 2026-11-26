/**
 * @file src/components/dialogs/useResolvedDarkScheme.ts
 * @description Hook que resuelve si la interfaz se ve en esquema oscuro (para las tarjetas de tema).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { type ColorSchemePreference } from '../../types/kura';

/** Resuelve si la interfaz se renderiza actualmente en esquema oscuro (para tarjetas de tema). */
export function useResolvedDarkScheme(scheme: ColorSchemePreference): boolean {
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return scheme === 'dark' || (scheme === 'system' && systemDark);
}
