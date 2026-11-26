/**
 * @file src/components/plates/PlateArrangeSummary.tsx
 * @description Resumen de la vista previa de «Repartir en placas…»: placas que se usarán y cuántas son nuevas, piezas
 * colocadas, las que no caben (con su motivo en palabras), las omitidas, los grupos que quedan partidos y las piezas
 * que conservaron su orientación. Cada aviso lleva icono y texto (no depende del color).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { newPlatesUsed, type ArrangeReport } from '../../core/scene/plateArrangeTypes';
import { t } from '../../i18n';
import type { LanguageCode, SceneObject } from '../../types/kura';

/** Frase principal (placas y piezas colocadas): va en la región `role=status`. */
export function arrangeHeadline(language: LanguageCode, report: ArrangeReport): string {
  // «Nuevas» son las nuevas que reciben piezas: nunca más que las usadas (la implícita que pasa a «Placa 1» no cuenta).
  const plates = report.platesUsed.length;
  const created = newPlatesUsed(report);
  const head = created > 0
    ? t(language, 'plates.arrangeDlg.preview.plates', { plates, created })
    : t(language, 'plates.arrangeDlg.preview.platesNoNew', { plates });
  return `${head} ${t(language, 'plates.arrangeDlg.preview.placed', { count: report.placed.length })}`;
}

export const PlateArrangeSummary: React.FC<{ language: LanguageCode; report: ArrangeReport; objects: readonly SceneObject[]; groupName: (id: string) => string }> = ({
  language, report, objects, groupName,
}) => {
  const name = (id: string) => objects.find((o) => o.id === id)?.name ?? id;
  return (
    <div className="kura-arrange-details" data-testid="arrange-details">
      {report.unplaced.length > 0 && (
        <div className="kura-arrange-warn" data-testid="arrange-unplaced">
          <AlertTriangle size={14} aria-hidden="true" />
          <div>
            <p>{t(language, 'plates.arrangeDlg.preview.unplaced', { count: report.unplaced.length })}</p>
            <ul className="kura-arrange-list">
              {report.unplaced.map((u) => (
                <li key={u.id}>{name(u.id)}: {t(language, `plates.arrangeDlg.preview.reason.${u.reason}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {report.skipped.length > 0 && (
        <div className="kura-arrange-warn" data-testid="arrange-skipped">
          <Info size={14} aria-hidden="true" />
          <div>
            <p>{t(language, 'plates.arrangeDlg.preview.skipped', { count: report.skipped.length })}</p>
            <ul className="kura-arrange-list">
              {report.skipped.map((s) => (
                <li key={s.id}>{name(s.id)}: {t(language, `plates.arrangeDlg.preview.skipped.${s.reason}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {report.splitGroups.map((g) => (
        <p key={g.groupId} className="kura-arrange-warn" data-testid="arrange-split">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{t(language, 'plates.arrangeDlg.preview.split', { name: groupName(g.groupId), count: g.plates.length })}</span>
        </p>
      ))}
      {report.keptOrientation.length > 0 && (
        <p className="kura-arrange-warn" data-testid="arrange-kept">
          <Info size={14} aria-hidden="true" />
          <span>{t(language, 'plates.arrangeDlg.preview.kept', { count: report.keptOrientation.length })}</span>
        </p>
      )}
    </div>
  );
};
