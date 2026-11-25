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
import { platesBedStatus, sceneBedStatus } from './plateBedStatus';
import { BedHiddenChip } from './BedHiddenChip';
import { AddFirstPlateButton } from '../plates/AddFirstPlateButton';
import { FitOutOfBoundsButton } from '../fitToBed/FitOutOfBoundsButton';

/** HUD inferior en una sola línea. */
export const ViewportHudBottom: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const showBed = useKuraStore((s) => s.showBed);
  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const localizedPrinterName = getLocalizedPrinterName(language, printerProfile);
  const plates = useKuraStore((s) => s.plates);
  const bedStatus = useMemo(() => sceneBedStatus(objects, printerProfile, plates), [objects, printerProfile, plates]);
  // Con varias placas, el aviso dice cuáles están fuera de volumen.
  const outPlateNames = useMemo(
    () => (plates.length < 2 ? [] : platesBedStatus(objects, printerProfile, plates).filter((e) => e.status === 'outOfBounds').map((e) => plates.find((p) => p.id === e.plateId)?.name ?? '')),
    [objects, printerProfile, plates],
  );
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
          size: `${formatDimension(bx, unitSystem, undefined, language)} × ${formatDimension(by, unitSystem, undefined, language)} × ${formatDimension(bz, unitSystem, undefined, language)}`,
          count: selectedIds.length,
        });
      }
    }
    // Ejes del usuario: X × Y × Z con Z = altura. Es la caja en el mundo: acostar la pieza cambia el alto.
    const bounds = computeSelectionBounds([selectedObj]);
    const [dx, dy, dz] = toUserSize(bounds ? bounds.size : selectedObj.stats.dimensionsMm);
    return [dx, dy, dz].map((v) => formatDimension(v, unitSystem, undefined, language)).join(' × ');
  }, [selectedObj, selectedIds, objects, unitSystem, language]);

  return (
    <div className="kura-hud-bottom">
      <div className="kura-hud-card kura-hud-pill-nowrap">
        <span className="kura-field-label">
          {t(language, 'viewport.dimensionsPrefix')}:
        </span>
        <span className="kura-dims-badge">{activeDimensionsText}</span>
      </div>

      {!showBed ? <BedHiddenChip /> : (
        <div className="kura-hud-card kura-hud-pill-nowrap">
          <span className="kura-field-label">{t(language, 'viewport.bedLabel')}:</span>
          <span className="kura-dims-badge">
            {printerProfile.showPrintVolume
              ? `${localizedPrinterName} (${formatDimension(
                  printerProfile.bedWidthMm,
                  unitSystem,
                  1, language)} × ${formatDimension(printerProfile.bedDepthMm, unitSystem, 1, language)} × ${formatDimension(
                  printerProfile.maxHeightMm,
                  unitSystem,
                  1, language)})`
              : localizedPrinterName}
          </span>
          {bedStatus === 'outOfBounds' && (
            <span className="kura-oob-badge">
              <AlertTriangle size={11} />
              <span>{t(language, 'viewport.bed.outOfBounds')}</span>
              {outPlateNames.length > 0 && <span data-testid="oob-plates">{t(language, 'plates.oob.where', { names: outPlateNames.join(', ') })}</span>}
            </span>
          )}
          {bedStatus === 'outOfBounds' && <FitOutOfBoundsButton />}
          <AddFirstPlateButton />
          {bedStatus === 'assembled' && (
            <span className="kura-assembled-badge" role="status" title={t(language, 'splitUx.assembled.status')}>
              <Boxes size={11} aria-hidden="true" />
              <span>{t(language, 'splitUx.assembled.status')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
