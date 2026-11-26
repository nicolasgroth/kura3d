/**
 * @file src/components/plates/PlateBadge.tsx
 * @description Insignia corta con la placa de una pieza en la lista de escena. Solo aparece con dos o más placas
 * (con una la lista es la de siempre). Texto visible corto («P2»: nunca se corta a una letra), nombre
 * accesible completo con el nombre de la placa y tooltip; no depende solo del color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { plateShortLabel } from '../../core/scene/plateShortLabel';
import { findPlate } from '../../core/scene/plates';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import '../../styles/plateBadge.css';

export const PlateBadge: React.FC<{ obj: Pick<SceneObject, 'plateRef'> }> = ({ obj }) => {
  const language = useKuraStore((s) => s.language);
  const plates = useKuraStore((s) => s.plates);
  if (plates.length < 2) return null;
  const plate = findPlate(plates, obj.plateRef);
  if (!plate) return null;
  return (
    <span
      className="kura-plate-badge"
      data-testid="plate-badge"
      role="img"
      aria-label={t(language, 'plates.badge.label', { name: plate.name })}
      title={t(language, 'plates.badge.tip', { name: plate.name })}
    >
      {plateShortLabel(plates.indexOf(plate))}
    </span>
  );
};
