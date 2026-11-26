/**
 * @file src/components/screwBoss/ScrewBossPanel.tsx
 * @description Panel de operación «Torreta para tornillo» (no modal, en el lugar del inspector, como el imán).
 * Mientras está abierto, un clic sobre una cara coloca la torreta perpendicular a ella (ver
 * `ScrewBossPlacementLayer`); muestra cómo colocar, la medida (preajustes incluidos y propios), los campos, el
 * resumen y los avisos de la última colocada. Se cierra con «Volver» o Escape.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useMemo } from 'react';
import { sameScrewBoss } from '../../core/addons/screwBoss';
import { builtinScrewBossPresetsOf, formatMm, metricLabel } from '../../core/addons/screwBossPresets';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { closeScrewBossPanel, placeScrewBossAt, setScrewBossParams, useScrewBossPanel, useScrewBossPresets } from '../../store/screwBossPanel';
import { screwBossWarnings, screwBossWarningText } from '../../store/screwBossWarnings';
import { useKuraStore } from '../../store/useKuraStore';
import { AddonPresetPicker } from '../addons/AddonPresetPicker';
import { AddonFacePlacer } from '../addons/AddonFacePlacer';
import { MagnetFoldStrip } from '../magnet/MagnetFoldStrip';
import { OperationPanel } from '../OperationPanel';
import { ScrewBossForm } from './ScrewBossForm';
import '../../styles/magnetPanel.css';

const ScrewBossPresetPicker: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useScrewBossPanel((s) => s.params);
  const builtins = useMemo(() => builtinScrewBossPresetsOf(params.type).map((p) => ({
    id: p.id,
    values: p.values,
    label: p.values.type === 'insert'
      ? t(language, 'turret.preset.insert', {
        size: metricLabel(p.values.nominalMm, language), d: formatMm(p.values.holeDiameterMm, language), len: formatMm(p.insertLengthMm ?? 0, language),
      })
      : t(language, 'turret.preset.screw', { size: metricLabel(p.values.nominalMm, language), d: formatMm(p.values.holeDiameterMm, language) }),
  })), [params.type, language]);
  return (
    <AddonPresetPicker
      textPrefix="turret"
      testId="turret"
      values={params}
      builtins={builtins}
      presets={useScrewBossPresets}
      same={sameScrewBoss}
      onPick={setScrewBossParams}
    />
  );
};

export const ScrewBossPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useScrewBossPanel((s) => s.open);
  const report = useScrewBossPanel((s) => s.lastReport);
  const blocked = useScrewBossPanel((s) => s.blocked);
  const close = useCallback(() => closeScrewBossPanel(), []);
  const warnings = report ? screwBossWarnings(report, language) : [];
  const fmt = (n: number) => formatLocaleNumber(language, n, { maxFrac: 1 });

  return (
    <>
      {open && <MagnetFoldStrip prefix="turret" onDone={close} />}
      <OperationPanel
        open={open}
        onClose={close}
        title={t(language, 'turret.title')}
        className="kura-magnet-panel kura-turret-panel"
        initialFocus='[data-testid="turret-preset"]'
      >
        <p className="kura-magnet-hint" role="status" data-testid="turret-hint">
          {t(language, blocked ? 'turret.invalid' : 'turret.hint')}
        </p>
        <ScrewBossPresetPicker />
        <ScrewBossForm />
        <AddonFacePlacer testId="turret" place={placeScrewBossAt} blocked={blocked} />
        {report && warnings.length === 0 && (
          <p className="kura-magnet-wall" role="status" data-testid="turret-last">
            {t(language, 'turret.lastOk', { wall: fmt(report.wallMm) })}
          </p>
        )}
        {warnings.map((w) => (
          <p key={w.kind} className="kura-magnet-wall is-warning" role="status" data-testid={`turret-warn-${w.kind}`}>
            {screwBossWarningText(w, language)}
          </p>
        ))}
      </OperationPanel>
    </>
  );
};
