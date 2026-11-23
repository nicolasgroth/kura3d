/**
 * @file src/components/inspector/UnitDoubtLink.tsx
 * @description Enlace «¿Unidad equivocada?» junto al tamaño de un objeto importado con unidades dudosas: abre
 * el diálogo de unidades sin depender del aviso (que se puede haber cerrado). Desaparece cuando el objeto ya
 * se reescaló (desde el aviso, el diálogo o a mano).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Ruler } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { useUnitChoiceStore } from '../../store/unitChoiceStore';
import type { SceneObject } from '../../types/kura';
import '../../styles/unitDoubtLink.css';

export const UnitDoubtLink: React.FC<{ object: SceneObject }> = ({ object }) => {
  const language = useKuraStore((s) => s.language);
  const doubt = useUnitChoiceStore((s) => s.doubts[object.id]);
  const open = useUnitChoiceStore((s) => s.open);
  if (!doubt || object.scale.some((v, i) => Math.abs(v - doubt.scale[i]) > 1e-9)) return null;
  return (
    <button
      type="button"
      className="kura-unit-doubt-link"
      title={t(language, 'ux7.unit.linkTip', { name: doubt.request.fileName })}
      onClick={() => open(doubt.request)}
    >
      <Ruler size={12} aria-hidden="true" />
      {t(language, 'ux7.unit.link')}
    </button>
  );
};
