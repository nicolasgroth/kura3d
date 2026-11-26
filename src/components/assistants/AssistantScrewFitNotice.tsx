/**
 * @file src/components/assistants/AssistantScrewFitNotice.tsx
 * @description Resultado de la comprobación de enroscado en la vista previa del asistente, antes de crear:
 * «Enrosca: holgura mínima X mm» o el aviso de holgura insuficiente o interferencia. Se anuncia sin interrumpir
 * (`role="status"`) y lleva icono y texto, nunca solo color. Solo aparece en recetas con chequeo `screw_fit`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { screwFitText } from '../../core/scene/screwFitText';
import { useAssistantPreview } from '../../store/assistantPreview';
import { useKuraStore } from '../../store/useKuraStore';

export const AssistantScrewFitNotice: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const fit = useAssistantPreview((s) => s.screwFit);
  if (!fit) return null;
  const Icon = fit.fits ? CircleCheck : CircleAlert;
  return (
    <p className={`kura-asis-screwfit${fit.fits ? '' : ' is-warn'}`} role="status" data-status={fit.status}>
      <Icon size={13} aria-hidden="true" />
      <span>{screwFitText(fit, language)}</span>
    </p>
  );
};
