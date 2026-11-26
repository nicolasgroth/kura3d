/**
 * @file src/components/inspector/FilamentLegendCard.tsx
 * @description Leyenda global de colores / filamentos distintos en la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isSolid } from '../../core/scene/objectRole';
import React, { useMemo } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { colorNameWithHex, distinctColorNames } from '../../utils/colorNames';
import { tCount } from '../../utils/plural';

/** Tarjeta con los colores de filamento presentes en la escena. */
export const FilamentLegendCard: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  // Leyenda global de colores / filamentos distintos en la escena
  const sceneColors = useMemo(() => {
    const map = new Map<string, number>();
    for (const obj of objects) {
      if (!isSolid(obj)) continue;
      if (obj.mesh.faceColors && obj.mesh.faceColors.length > 0) {
        const distinct = new Set(obj.mesh.faceColors.map((c) => c.toLowerCase()));
        for (const c of distinct) {
          map.set(c, (map.get(c) ?? 0) + 1);
        }
      } else {
        const c = obj.color.toLowerCase();
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
    return Array.from(map.entries());
  }, [objects]);

  const legendNames = useMemo(() => distinctColorNames(language, sceneColors.map(([hex]) => hex)), [language, sceneColors]);

  return sceneColors.length > 0 && (
    <section className="kura-card">
      <div className="kura-field-row">
        <span className="kura-section-label" style={{ margin: 0 }}>
          {t(language, 'scene.filamentLegend')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {tCount(language, { one: 'scene.colorsCount.one', other: 'scene.colorsCount' }, sceneColors.length)}
        </span>
      </div>
      <div className="kura-filament-legend">
        {sceneColors.map(([hex, count]) => (
          <span key={hex} className="kura-filament-chip">
            <span className="kura-color-dot" style={{ backgroundColor: hex }} aria-hidden="true" />
            <span title={colorNameWithHex(language, hex)}>{legendNames.get(hex.toLowerCase())}</span>
            <span style={{ color: 'var(--text-muted)' }}>{t(language, 'ux7.filament.pieces', { count })}</span>
          </span>
        ))}
      </div>
    </section>
  );
};
