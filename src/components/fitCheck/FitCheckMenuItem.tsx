/**
 * @file src/components/fitCheck/FitCheckMenuItem.tsx
 * @description Ítem «Comprobar encaje…» del menú contextual (grupo Analizar): abre sus opciones en el panel
 * contextual. Deshabilitado, con el motivo debajo, si no hay dos objetos visibles o seleccionados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Ruler } from 'lucide-react';
import { t } from '../../i18n';
import { actionAvailability } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { MenuItem } from '../viewport/contextMenu/MenuKit';
import { openActionPanel } from '../shell/actionRunners';

export const FitCheckMenuItem: React.FC<{ run: (fn: () => void) => () => void }> = ({ run }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const availability = actionAvailability({ objects, selectedIds, groups, busyOperation }, 'fitCheck');
  const reason = availability.reason ? t(language, availability.reason) : undefined;
  return (
    <MenuItem
      icon={<Ruler size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />}
      label={t(language, 'rediseno.action.fitCheck')}
      tip={reason ? t(language, 'rediseno.reason.disabled', { reason }) : t(language, 'fitCheck.ui.openTip')}
      description={reason}
      disabled={!availability.enabled}
      onSelect={run(() => openActionPanel('fitCheck'))}
    />
  );
};
