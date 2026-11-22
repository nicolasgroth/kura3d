/**
 * @file src/components/viewport/ViewportHudBottom.tsx
 * @description HUD inferior del visor: dimensiones en vivo, alerta de límites y cama activa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Boxes } from 'lucide-react';
import '../../styles/splitUx.css';
import { getLocalizedPrinterName, t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { computeSelectionBounds } from '../../utils/selectionBounds';
import { formatDimension } from '../../utils/units';
import { toUserSize } from '../../core/scene/displayAxes';
import { bedStatusOf } from '../split/splitAssembledStatus';

/** HUD inferior en una sola línea. */
export const ViewportHudBottom: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const localizedPrinterName = getLocalizedPrinterName(language, printerProfile);
  const bedStatus = useMemo(() => bedStatusOf(objects, printerProfile), [objects, printerProfile]);
  const activeDimensionsText = useMemo(() => {
    if (!selectedObj) {
      return t(language, 'viewport.noSelection');
    }
    if (selectedIds.length > 1) {
      // Selección múltiple: caja envolvente de todos los objetos seleccionados.
      const bounds = computeSelectionBounds(objects.filter((o) => selectedIds.includes(o.id)));
      if (bounds) {
        const [bx, by, bz] = toUserSize(bounds.size);
        return t(language, 'viewport.dimensionsMulti', {
          size: `${formatDimension(bx, unitSystem)} × ${formatDimension(by, unitSystem)} × ${formatDimension(bz, unitSystem)}`,
          count: selectedIds.length,
        });
      }
    }
    // Ejes del usuario: X × Y × Z con Z = altura.
    const [dx, dy, dz] = toUserSize(selectedObj.stats.dimensionsMm);
    const [sx, sy, sz] = toUserSize(selectedObj.scale);
    return `${formatDimension(dx * sx, unitSystem)} × ${formatDimension(
      dy * sy,
      unitSystem,
    )} × ${formatDimension(dz * sz, unitSystem)}`;
  }, [selectedObj, selectedIds, objects, unitSystem, language]);

  return (
    <div className="kura-hud-bottom">
      <div className="kura-hud-card kura-hud-pill-nowrap">
        <span className="kura-field-label">
          {t(language, 'viewport.dimensionsPrefix')}:
        </span>
        <span className="kura-dims-badge">{activeDimensionsText}</span>
      </div>

      <div className="kura-hud-card kura-hud-pill-nowrap">
        <span className="kura-field-label">{t(language, 'viewport.bedLabel')}:</span>
        <span className="kura-dims-badge">
          {printerProfile.showPrintVolume
            ? `${localizedPrinterName} (${formatDimension(
                printerProfile.bedWidthMm,
                unitSystem,
                1,
              )} × ${formatDimension(printerProfile.bedDepthMm, unitSystem, 1)} × ${formatDimension(
                printerProfile.maxHeightMm,
                unitSystem,
                1,
              )})`
            : localizedPrinterName}
        </span>
        {bedStatus === 'outOfBounds' && (
          <span className="kura-oob-badge">
            <AlertTriangle size={11} />
            <span>{t(language, 'viewport.bed.outOfBounds')}</span>
          </span>
        )}
        {bedStatus === 'assembled' && (
          <span className="kura-assembled-badge" role="status" title={t(language, 'splitUx.assembled.status')}>
            <Boxes size={11} aria-hidden="true" />
            <span>{t(language, 'splitUx.assembled.status')}</span>
          </span>
        )}
      </div>
    </div>
  );
};
