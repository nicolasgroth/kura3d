/**
 * @file src/components/keyhole/KeyholePanel.tsx
 * @description Panel «Colgar en el muro» (ojo de cerradura). Mientras está abierto, un clic sobre una cara coloca el
 * ojo con la ranura hacia el «arriba» de la pieza (ver `KeyholePlacementLayer`). Muestra cómo colocar, la medida
 * (preajustes incluidos por verificar y propios), los campos (tornillo, entrada, cuello, ranura, cámara, labio y
 * giro) validados junto al campo con sus reglas cruzadas, la nota de medidas por verificar, el resumen y los avisos del
 * último colocado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useId, useMemo } from 'react';
import { invalidKeyholeFields, KEYHOLE_RANGES, keyholeDepthMm, sameKeyhole, type KeyholeNumericField } from '../../core/addons/keyhole';
import { BUILTIN_KEYHOLE_PRESETS, KEYHOLE_DEFAULTS } from '../../core/addons/keyholePresets';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { t, type TranslationKey } from '../../i18n';
import { keyholePanel, useKeyholePanel, useKeyholePresets } from '../../store/keyholePanel';
import { keyholeWarnings } from '../../store/keyholeWarnings';
import { useKuraStore } from '../../store/useKuraStore';
import { AddonNumberField } from '../addons/AddonNumberField';
import { AddonPanelShell } from '../addons/AddonPanelShell';
import { AddonPresetPicker } from '../addons/AddonPresetPicker';
import { useInvalidFields } from '../useInvalidFields';

const FIELDS: ReadonlyArray<[KeyholeNumericField, TranslationKey, number]> = [
  ['screwMm', 'keyhole.screw', 0.5],
  ['headDiameterMm', 'keyhole.head', 0.1],
  ['neckWidthMm', 'keyhole.neck', 0.1],
  ['slotLengthMm', 'keyhole.slot', 0.5],
  ['chamberDepthMm', 'keyhole.chamber', 0.5],
  ['lipMm', 'keyhole.lip', 0.1],
  ['angleDeg', 'keyhole.angle', 15],
];

const KeyholeForm: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useKeyholePanel((s) => s.params);
  const invalid = useInvalidFields();
  const uid = useId();
  const cross = invalidKeyholeFields(params);
  const blocked = invalid.blocked || cross.length > 0;
  useEffect(() => keyholePanel.setBlocked(blocked), [blocked]);
  useEffect(() => () => keyholePanel.setBlocked(false), []);
  const fmt = (n: number) => formatLocaleNumber(language, n);
  return (
    <div className="kura-magnet-form">
      <div className="kura-magnet-grid">
        {FIELDS.map(([key, label, step]) => (
          <AddonNumberField
            key={key}
            id={`${uid}-${key}`}
            testId={`keyhole-field-${key}`}
            label={label}
            value={params[key]}
            defaultValue={KEYHOLE_DEFAULTS[key]}
            range={KEYHOLE_RANGES[key]}
            step={step}
            precision={key === 'angleDeg' ? 0 : 2}
            onChange={(v) => keyholePanel.setParams({ [key]: v })}
            onInvalidChange={invalid.track(key)}
            externalInvalid={!invalid.blocked && cross.includes(key)}
          />
        ))}
      </div>
      <p className="kura-fit-note" data-testid="keyhole-start-note">{t(language, 'keyhole.startNote')}</p>
      <p className="kura-magnet-summary" data-testid="keyhole-summary">
        {blocked
          ? t(language, 'keyhole.summaryInvalid')
          : t(language, 'keyhole.summary', {
            head: fmt(params.headDiameterMm), neck: fmt(params.neckWidthMm), slot: fmt(params.slotLengthMm),
            chamber: fmt(params.chamberDepthMm), lip: fmt(params.lipMm), depth: fmt(keyholeDepthMm(params)),
          })}
      </p>
    </div>
  );
};

export const KeyholePanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useKeyholePanel((s) => s.open);
  const params = useKeyholePanel((s) => s.params);
  const report = useKeyholePanel((s) => s.lastReport);
  const blocked = useKeyholePanel((s) => s.blocked);
  const close = useCallback(() => keyholePanel.close(), []);
  const builtins = useMemo(() => BUILTIN_KEYHOLE_PRESETS.map((p) => ({
    id: p.id,
    values: p.values,
    label: t(language, 'keyhole.preset.screw', { size: formatLocaleNumber(language, p.values.screwMm), head: formatLocaleNumber(language, p.values.headDiameterMm) }),
  })), [language]);
  // El formateador común de la app (mismos decimales y sin separador de miles que el resto de las medidas).
  const fmt = (n: number) => formatLocaleNumber(language, n, { maxFrac: 1 });
  return (
    <AddonPanelShell
      prefix="keyhole"
      open={open}
      onClose={close}
      blocked={blocked}
      warnings={report ? keyholeWarnings(report, language) : []}
      lastOk={report && Number.isFinite(report.wallBehindMm) ? t(language, 'keyhole.lastOk', { wall: fmt(report.wallBehindMm) }) : null}
    >
      {/* Textos del selector, armados por AddonPresetPicker: 'keyhole.preset' y `keyhole.preset.${…}`. */}
      <AddonPresetPicker
        textPrefix="keyhole"
        testId="keyhole"
        values={params}
        builtins={builtins}
        presets={useKeyholePresets}
        same={sameKeyhole}
        onPick={keyholePanel.setParams}
      />
      <KeyholeForm />
    </AddonPanelShell>
  );
};
