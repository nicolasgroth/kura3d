/**
 * @file src/components/about/EasterEggHost.tsx
 * @description Ejecuta el huevo de pascua del logo: durante `EGG_DURATION_MS` marca la raíz con
 * `data-kura-egg` (el CSS gira el logo y recorre los colores de acento) y muestra un mensaje corto en
 * una región `role="status"` que también leen los lectores de pantalla. Con movimiento reducido solo
 * muestra el mensaje. Al terminar quita la marca: no deja estado cambiado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { EGG_DURATION_MS, useEggStore } from '../../utils/logoEasterEgg';
import '../../styles/about.css';

const EGG_ATTR = 'data-kura-egg';

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const EasterEggHost: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const runId = useEggStore((s) => s.runId);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (runId === 0) return undefined;
    const root = document.documentElement;
    setActive(true);
    if (!prefersReducedMotion()) root.setAttribute(EGG_ATTR, '');
    const timer = window.setTimeout(() => {
      root.removeAttribute(EGG_ATTR);
      setActive(false);
    }, EGG_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      root.removeAttribute(EGG_ATTR);
      setActive(false);
    };
  }, [runId]);

  return (
    <div role="status" aria-live="polite" className={`kura-egg-message${active ? ' is-visible' : ''}`}>
      {active ? t(language, 'about.egg.message') : ''}
    </div>
  );
};
