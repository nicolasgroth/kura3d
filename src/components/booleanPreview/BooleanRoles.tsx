/**
 * @file src/components/booleanPreview/BooleanRoles.tsx
 * @description Rótulos "Base" y "Herramienta" (texto y borde, no solo color) con el botón Invertir,
 * compartidos por la barra del visor y el inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanPreviewApi } from './useBooleanPreview';
import '../../styles/operationPreview.css';

export const BooleanRoles: React.FC<{ api: BooleanPreviewApi }> = ({ api }) => {
  const language = useKuraStore((s) => s.language);
  const { base, tool, extraTools, busy, swapRoles } = api;
  if (!base || !tool) return null;
  // Con varias herramientas se nombran todas (hasta dos) o la primera "y N más".
  const tools = [tool, ...extraTools];
  const toolNames = tools.map((o) => o.name);
  const toolText = tools.length === 1
    ? tool.name
    : tools.length === 2
      ? t(language, 'boolPreview.toolsTwo', { first: toolNames[0], second: toolNames[1] })
      : t(language, 'boolPreview.toolsMore', { name: toolNames[0], count: tools.length - 1 });
  const toolLabel = tools.length > 1 ? t(language, 'boolPreview.toolsLabel') : t(language, 'boolPreview.tool');
  return (
    <>
      <span className="kura-bool-bar-roles">
        <span className="kura-bool-chip" data-role="base" title={base.name}>
          {t(language, 'boolPreview.base')}: {base.name}
        </span>
        <span className="kura-bool-chip" data-role="tool" title={toolNames.join(', ')}>
          {toolLabel}: {toolText}
        </span>
      </span>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={busy}
        title={t(language, 'boolPreview.invertTip')}
        aria-label={`${t(language, 'boolPreview.invert')} — ${t(language, 'boolPreview.roles', { base: base.name, tool: toolNames.join(', ') })}`}
        onClick={swapRoles}
      >
        <ArrowLeftRight size={12} aria-hidden="true" />
        <span>{t(language, 'boolPreview.invert')}</span>
      </button>
    </>
  );
};
