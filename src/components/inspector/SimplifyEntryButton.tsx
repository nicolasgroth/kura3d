/**
 * @file src/components/inspector/SimplifyEntryButton.tsx
 * @description Entrada «Simplificar…» de la sección Geometría del inspector: abre el mismo panel Simplificar que
 * Acciones › Malla (misma petición del store, sin lógica propia). Va junto al recuento de triángulos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

export const SimplifyEntryButton: React.FC<{ id: string }> = ({ id }) => {
  const language = useKuraStore((s) => s.language);
  const requestSimplifyPanel = useKuraStore((s) => s.requestSimplifyPanel);
  return (
    <button
      type="button"
      className="kura-btn kura-btn-sm kura-simplify-entry"
      title={t(language, 'simplify.entry.tip')}
      data-testid="simplify-entry"
      onClick={() => requestSimplifyPanel(id)}
    >
      <Sparkles size={12} aria-hidden="true" />
      <span>{t(language, 'simplify.entry')}</span>
    </button>
  );
};
