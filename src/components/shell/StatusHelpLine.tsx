/**
 * @file src/components/shell/StatusHelpLine.tsx
 * @description Zona propia de la barra de estado que explica el control bajo el cursor o el foco (nombre, qué
 * hace y atajo, del mismo registro que los tooltips); sin control, muestra el texto neutro con los atajos
 * principales. Ocupa el centro y se recorta con puntos suspensivos: no desplaza ni tapa los datos fijos
 * (unidad, cama, objetos, borrador, avisos). `aria-live="off"`: el lector ya anuncia el control enfocado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { useStatusHelp } from './HelpTooltipLayer';

export const StatusHelpLine: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const line = useStatusHelp((s) => s.line);
  return (
    <div
      className={`kura-statusbar-help${line ? ' is-help' : ''}`}
      aria-live="off"
      aria-label={t(language, 'rediseno.status.help')}
      role="note"
      data-testid="status-help"
    >
      <span className="kura-statusbar-help-text">{line ?? t(language, 'status.shortcuts')}</span>
    </div>
  );
};
