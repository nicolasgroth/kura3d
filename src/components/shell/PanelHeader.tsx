/**
 * @file src/components/shell/PanelHeader.tsx
 * @description Encabezado común de los paneles de herramienta (`ActionPanel` y `OperationPanel`): «Volver»
 * (ícono de flecha, misma tecla Esc anunciada) y, a su lado, el título. «Volver» va primero en el orden de
 * tabulación; lo que haga al volver (devolver el foco, descartar la vista previa) lo decide cada panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs } from './controlHelp';
import '../../styles/panelHeader.css';

export const PanelHeader: React.FC<{
  onBack: () => void;
  title: string;
  /** Clase extra del contenedor (cada panel conserva sus ganchos de estilo y de prueba). */
  className?: string;
  /** Clase y `id` del título; `focusableTitle` lo hace enfocable por código (destino de foco de respaldo). */
  titleClassName?: string;
  titleId?: string;
  focusableTitle?: boolean;
}> = ({ onBack, title, className, titleClassName, titleId, focusableTitle }) => {
  const language = useKuraStore((s) => s.language);
  const label = t(language, 'panel.action.back');
  return (
    <div className={className ? `kura-panel-header ${className}` : 'kura-panel-header'}>
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-panel-back"
        data-testid="panel-back"
        onClick={onBack}
        {...helpAttrs('panel.back', language)}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <h2 id={titleId} title={title} className={titleClassName ? `kura-panel-title ${titleClassName}` : 'kura-panel-title'} tabIndex={focusableTitle ? -1 : undefined}>
        {title}
      </h2>
    </div>
  );
};
