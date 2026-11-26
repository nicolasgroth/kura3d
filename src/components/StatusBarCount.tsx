/**
 * @file src/components/StatusBarCount.tsx
 * @description Recuento de objetos y triángulos del pie de página. Con piezas ocultas muestra
 * visibles y total ("10 de 19 objs · 1,6 M de 3,3 M tris"); los millones van en forma compacta y
 * el detalle completo queda en el tooltip. Las referencias no se cuentan (no se imprimen): se anuncian
 * aparte ("· 1 referencia").
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { LanguageCode, SceneObject } from '../types/kura';
import { formatNumber, tCount } from '../utils/plural';
import { isReference } from '../core/scene/objectRole';

/** Visibles y total de objetos y triángulos (oculto = `visible === false`). */
export function sceneCounts(objects: readonly SceneObject[]) {
  let visible = 0, visibleTris = 0, totalTris = 0, references = 0;
  for (const obj of objects) {
    if (isReference(obj)) {
      references += 1;
      continue;
    }
    totalTris += obj.stats.triangles;
    if (obj.visible === false) continue;
    visible += 1;
    visibleTris += obj.stats.triangles;
  }
  return { total: objects.length - references, visible, visibleTris, totalTris, references };
}

/** Triángulos: completos bajo un millón, compactos desde ahí ("3,3 M"). */
export const compactTris = (language: LanguageCode, n: number) =>
  n >= 1e6 ? formatNumber(language, n, { notation: 'compact', maximumFractionDigits: 1 }) : formatNumber(language, n);

export const StatusBarCount: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const c = useMemo(() => sceneCounts(objects), [objects]);
  const params = {
    visible: formatNumber(language, c.visible),
    total: formatNumber(language, c.total),
    visibleTris: compactTris(language, c.visibleTris),
    totalTris: compactTris(language, c.totalTris),
  };
  const tip = t(language, 'realesUi.status.countTip', {
    ...params, visibleTris: formatNumber(language, c.visibleTris), totalTris: formatNumber(language, c.totalTris),
  });
  const refs = c.references > 0
    ? ` · ${tCount(language, { one: 'reference.status.count.one', other: 'reference.status.count.other' }, c.references)}`
    : '';
  return (
    <span title={tip} data-testid="status-count">
      {c.visible === c.total
        ? `${t(language, 'status.objects', { count: params.total })} · ${t(language, 'status.triangles', { count: params.totalTris })}`
        : t(language, 'realesUi.status.count', params)}
      {refs}
    </span>
  );
};
