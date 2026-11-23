/**
 * @file src/components/viewport/PaintRefineHint.tsx
 * @description Aviso discreto, una sola vez por objeto, cuando la malla es tan gruesa que el pincel
 * pinta caras enteras: ofrece refinar la malla con los valores por defecto del refinado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { Wand2, X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { isMeshTooCoarseForBrush } from '../../utils/paintCoarseness';
import { REFINE_UI_DEFAULTS } from '../refineDefaults';

/** Objetos para los que el aviso ya se descartó o se aplicó (una vez por objeto y sesión). */
const handledObjectIds = new Set<string>();

export const PaintRefineHint: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const paintMode = useKuraStore((s) => s.paintMode);
  const radius = useKuraStore((s) => s.paintRadiusMm);
  const busy = useKuraStore((s) => s.busyOperation);
  const refineSelectedMesh = useKuraStore((s) => s.refineSelectedMesh);
  // Con «refinar al pintar» activo el trazo refina la malla: decir que pintará caras enteras sería falso.
  const refinesWhilePainting = useKuraStore((s) => s.paintRefineEdge);
  const target = useKuraStore((s) => {
    const id = s.selectedIds[0] ?? s.objects[0]?.id;
    return s.objects.find((o) => o.id === id);
  });
  const [, force] = useState(0);

  if (paintMode !== 'brush' || refinesWhilePainting || !target || target.locked || handledObjectIds.has(target.id)) return null;
  if (!isMeshTooCoarseForBrush(target.mesh.positions, target.mesh.indices, target.scale, radius)) return null;

  const dismiss = () => {
    handledObjectIds.add(target.id);
    force((n) => n + 1);
  };
  const refine = () => {
    const id = target.id;
    dismiss();
    void refineSelectedMesh(id, REFINE_UI_DEFAULTS.edgeMm, REFINE_UI_DEFAULTS.smooth);
  };

  return (
    <div className="kura-paint-refine-hint" role="status">
      <span>{t(language, 'viewport.paint.coarse')}</span>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={Boolean(busy)}
        onClick={refine}
        title={t(language, 'viewport.paint.coarseRefineTip')}
      >
        <Wand2 size={13} aria-hidden="true" />
        <span>{t(language, 'viewport.paint.coarseRefine')}</span>
      </button>
      <button
        type="button"
        className="kura-mini-icon-btn"
        onClick={dismiss}
        aria-label={t(language, 'viewport.paint.coarseDismiss')}
        title={t(language, 'viewport.paint.coarseDismiss')}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
