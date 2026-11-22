/**
 * @file src/components/booleanPreview/BooleanRoles.tsx
 * @description Rótulos "Base" y "Herramienta" (texto y borde, no solo color) con el botón Invertir,
 * compartidos por la barra del visor y el inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanPreviewApi } from './useBooleanPreview';
import '../../styles/operationPreview.css';

export const BooleanRoles: React.FC<{ api: BooleanPreviewApi }> = ({ api }) => {
  const language = useKuraStore((s) => s.language);
  const { base, tool, busy, swapRoles } = api;
  if (!base || !tool) return null;
  return (
    <>
      <span className="kura-bool-bar-roles">
        <span className="kura-bool-chip" data-role="base" title={base.name}>
          {t(language, 'boolPreview.base')}: {base.name}
        </span>
        <span className="kura-bool-chip" data-role="tool" title={tool.name}>
          {t(language, 'boolPreview.tool')}: {tool.name}
        </span>
      </span>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={busy}
        title={t(language, 'boolPreview.invertTip')}
        aria-label={`${t(language, 'boolPreview.invert')} — ${t(language, 'boolPreview.roles', { base: base.name, tool: tool.name })}`}
        onClick={swapRoles}
      >
        <ArrowLeftRight size={12} aria-hidden="true" />
        <span>{t(language, 'boolPreview.invert')}</span>
      </button>
    </>
  );
};
