/**
 * @file src/components/plates/PlateArrangePanel.tsx
 * @description Panel «Repartir en placas…» (no modal, en el lugar del inspector, como los demás paneles de operación):
 * qué repartir (selección o todo, con el número de piezas), criterio (compacto, por color, por grupo o una placa por
 * objeto), orientación, separación y margen, cada opción con su ayuda. Al abrir y al cambiar cualquier opción (con un
 * pequeño retardo) calcula la vista previa y muestra su resumen en una región `role=status`; el cálculo se puede
 * cancelar. «Repartir» aplica en un paso de deshacer. Toda la lógica vive en `store/plateArrangePanel.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useCallback, useEffect, useId, useMemo } from 'react';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { ARRANGE_RANGES } from '../../core/scene/plateArrangeTypes';
import { t, type TranslationKey } from '../../i18n';
import {
  applyPlateArrange, arrangeScopeIds, cancelPlateArrangePreview, closePlateArrangePanel, refreshPlateArrangePreview,
  setPlateArrangeOptions, usePlateArrangePanel, type ArrangeChoice, type ArrangeScope,
} from '../../store/plateArrangePanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { ArrangeOrient } from '../../core/scene/plateArrangeTypes';
import { OperationPanel } from '../OperationPanel';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { PlateArrangeSummary, arrangeHeadline } from './PlateArrangeSummary';
import '../../styles/plateArrangePanel.css';

/** Retardo antes de recalcular la vista previa tras un cambio de opción. */
export const ARRANGE_PREVIEW_DELAY_MS = 250;

const CHOICES: readonly ArrangeChoice[] = ['compact', 'byColor', 'byGroup', 'onePerObject'];
const CHOICE_LABEL: Record<ArrangeChoice, TranslationKey> = {
  compact: 'plates.arrangeDlg.crit.compact', byColor: 'plates.arrangeDlg.crit.byColor', byGroup: 'plates.arrangeDlg.crit.byGroup', onePerObject: 'plates.action.onePerObject',
};
const CHOICE_HELP: Record<ArrangeChoice, TranslationKey> = {
  compact: 'plates.arrangeDlg.crit.compact.help', byColor: 'plates.arrangeDlg.crit.byColor.help', byGroup: 'plates.arrangeDlg.crit.byGroup.help', onePerObject: 'plates.action.onePerObject.tip',
};
const ORIENTS: readonly ArrangeOrient[] = ['keep', 'flatDown'];

/** Una opción de grupo de radios con su línea de ayuda enlazada por `aria-describedby`. */
const RadioOption: React.FC<{
  name: string; value: string; checked: boolean; label: string; help: string; disabled?: boolean; testId: string; onSelect: () => void;
}> = ({ name, value, checked, label, help, disabled, testId, onSelect }) => {
  const helpId = useId();
  return (
    <label className="kura-arrange-option" data-disabled={disabled ? 'true' : undefined} title={help}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} aria-describedby={helpId} data-testid={testId} onChange={onSelect} />
      <span className="kura-arrange-option-name">{label}</span>
      <span id={helpId} className="kura-arrange-help">{help}</span>
    </label>
  );
};

export const PlateArrangePanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = usePlateArrangePanel((s) => s.open);
  const panel = usePlateArrangePanel();
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const plates = useKuraStore((s) => s.plates);
  const groups = useKuraStore((s) => s.groups);
  const layout = useKuraStore((s) => s.layout);
  const busy = useKuraStore((s) => s.busyOperation !== null);
  const invalid = useInvalidFields();
  const uid = useId();
  const close = useCallback(() => closePlateArrangePanel(), []);

  const selectionCount = useMemo(() => arrangeScopeIds(objects, selectedIds, 'selection').length, [objects, selectedIds]);
  const allCount = useMemo(() => arrangeScopeIds(objects, selectedIds, 'all').length, [objects, selectedIds]);
  const pieceCount = panel.scope === 'selection' ? selectionCount : allCount;

  // Si la selección se vacía con «La selección» elegida, el alcance vuelve a «todas».
  useEffect(() => {
    if (open && panel.scope === 'selection' && selectionCount === 0) setPlateArrangeOptions({ scope: 'all' });
  }, [open, panel.scope, selectionCount]);

  // Vista previa en vivo: al abrir y al cambiar cualquier opción o la escena, con un pequeño retardo.
  const { scope, criterion, orient, spacingMm, marginMm } = panel;
  useEffect(() => {
    if (!open || invalid.blocked) return undefined;
    const timer = setTimeout(() => void refreshPlateArrangePreview(), ARRANGE_PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, invalid.blocked, scope, criterion, orient, spacingMm, marginMm, objects, plates, groups, layout, selectedIds]);

  const onePerObject = panel.criterion === 'onePerObject';
  const report = panel.status === 'ready' ? panel.preview?.report ?? null : null;
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  const canApply = open && pieceCount > 0 && !busy && !invalid.blocked && (onePerObject || panel.status !== 'running');

  const numberField = (key: 'spacingMm' | 'marginMm', label: TranslationKey, help: TranslationKey) => (
    <div className="kura-arrange-field" data-testid={`arrange-field-${key}`}>
      <label className="kura-field-label" htmlFor={`${uid}-${key}`}>{t(language, label)}</label>
      <PrecisionNumberInput
        id={`${uid}-${key}`}
        strictRange
        onInvalidChange={invalid.track(key)}
        min={ARRANGE_RANGES[key].min}
        max={ARRANGE_RANGES[key].max}
        step={1}
        precision={1}
        suffix="mm"
        defaultValue={ARRANGE_RANGES[key].default}
        value={panel[key]}
        disabled={onePerObject}
        onChange={(v) => setPlateArrangeOptions({ [key]: v })}
        ariaLabel={t(language, label)}
        title={t(language, help)}
      />
      <span className="kura-arrange-help">{t(language, help)}</span>
    </div>
  );

  return (
    <OperationPanel
      open={open}
      onClose={close}
      title={t(language, 'plates.action.arrange')}
      className="kura-arrange-panel"
      initialFocus='input[type="radio"]:checked'
      footer={
        <>
          {/* Resumen siempre a la vista junto al botón (pie fijo del panel), sin tener que desplazar el cuerpo. */}
          <p className="kura-arrange-headline" role="status" aria-live="polite" aria-atomic="true" data-testid="arrange-summary">
            {onePerObject ? t(language, 'plates.arrangeDlg.preview.onePerObject') : report ? arrangeHeadline(language, report) : ''}
          </p>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!canApply}
            onClick={() => void applyPlateArrange()}
            title={t(language, 'plates.arrangeDlg.applyTip')}
            data-testid="arrange-apply"
          >
            <LayoutGrid size={14} aria-hidden="true" />
            <span>{t(language, busy ? 'plates.arrangeDlg.applyBusy' : 'plates.arrangeDlg.apply')}</span>
          </button>
        </>
      }
    >
      <fieldset className="kura-arrange-group" data-testid="arrange-scope">
        <legend className="kura-section-label">{t(language, 'plates.arrangeDlg.scope')}</legend>
        <RadioOption
          name={`${uid}-scope`} value="selection" testId="arrange-scope-selection" checked={panel.scope === 'selection'} disabled={selectionCount === 0}
          label={t(language, 'plates.arrangeDlg.scope.selection', { count: selectionCount })} help={t(language, 'plates.arrangeDlg.scope.help')}
          onSelect={() => setPlateArrangeOptions({ scope: 'selection' as ArrangeScope })}
        />
        <RadioOption
          name={`${uid}-scope`} value="all" testId="arrange-scope-all" checked={panel.scope === 'all'}
          label={t(language, 'plates.arrangeDlg.scope.all', { count: allCount })} help={t(language, 'plates.arrangeDlg.scope.help')}
          onSelect={() => setPlateArrangeOptions({ scope: 'all' as ArrangeScope })}
        />
      </fieldset>

      <fieldset className="kura-arrange-group" data-testid="arrange-criterion">
        <legend className="kura-section-label">{t(language, 'plates.arrangeDlg.criterion')}</legend>
        {CHOICES.map((c) => (
          <RadioOption
            key={c} name={`${uid}-criterion`} value={c} testId={`arrange-criterion-${c}`} checked={panel.criterion === c}
            label={t(language, CHOICE_LABEL[c])} help={t(language, CHOICE_HELP[c])}
            onSelect={() => setPlateArrangeOptions({ criterion: c })}
          />
        ))}
      </fieldset>

      <fieldset className="kura-arrange-group" data-testid="arrange-orient" disabled={onePerObject}>
        <legend className="kura-section-label">{t(language, 'plates.arrangeDlg.orient')}</legend>
        {ORIENTS.map((o) => (
          <RadioOption
            key={o} name={`${uid}-orient`} value={o} testId={`arrange-orient-${o}`} checked={panel.orient === o} disabled={onePerObject}
            label={t(language, `plates.arrangeDlg.orient.${o}` as TranslationKey)} help={t(language, `plates.arrangeDlg.orient.${o}.help` as TranslationKey)}
            onSelect={() => setPlateArrangeOptions({ orient: o })}
          />
        ))}
      </fieldset>

      <div className="kura-arrange-fields">
        {numberField('spacingMm', 'plates.arrangeDlg.spacing', 'plates.arrangeDlg.spacing.help')}
        {numberField('marginMm', 'plates.arrangeDlg.margin', 'plates.arrangeDlg.margin.help')}
      </div>

      <section className="kura-arrange-preview" aria-labelledby={`${uid}-preview`} data-testid="arrange-preview" data-status={panel.status}>
        <h3 id={`${uid}-preview`} className="kura-section-label">{t(language, 'plates.arrangeDlg.preview')}</h3>
        {panel.status === 'running' && (
          <div className="kura-arrange-running" data-testid="arrange-running">
            <Loader2 size={14} aria-hidden="true" />
            <span>{t(language, 'plates.arrangeDlg.preview.running')}</span>
            <button type="button" className="kura-btn kura-btn-sm" onClick={cancelPlateArrangePreview} data-testid="arrange-cancel-preview">
              {t(language, 'plates.arrangeDlg.preview.cancel')}
            </button>
          </div>
        )}
        {panel.status === 'cancelled' && <p className="kura-arrange-note" data-testid="arrange-cancelled">{t(language, 'plates.arrangeDlg.preview.cancelled')}</p>}
        {panel.status === 'failed' && <p className="kura-arrange-note" data-testid="arrange-failed">{t(language, 'plates.arrangeDlg.preview.failed')}</p>}
        {report && <PlateArrangeSummary language={language} report={report} objects={objects} groupName={groupName} />}
        {report && <p className="kura-arrange-note" data-testid="arrange-ghost-note">{t(language, panel.ghost ? 'plates.arrangeDlg.preview.ghostNote' : 'plates.arrangeDlg.preview.noGhost')}</p>}
      </section>
    </OperationPanel>
  );
};
