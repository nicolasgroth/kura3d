/**
 * @file src/components/plates/PlateBedPicker.tsx
 * @description Selector «Cama de esta placa…» (lote P7, dos impresoras): diálogo con radios nativos agrupados («La
 * del proyecto», impresoras incluidas, «Mis camas» y, si la placa trae una cama sin perfil, esa misma), cada uno con
 * sus medidas. «Usar esta cama» llama a `setPlateBed` (un paso de deshacer; si la cama nueva pisaría a otra placa,
 * esa se recoloca y un aviso lo dice). Teclado: flechas dentro del grupo de radios, Tab al pie, Esc cierra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { getLocalizedPrinterName, t, type TranslationKey } from '../../i18n';
import { formatNumber } from '../../utils/plural';
import { projectBed } from '../../core/scene/activePlateBed';
import { useKuraStore } from '../../store/useKuraStore';
import { NativeModal } from '../NativeModal';
import { plateBedOptions, type PlateBedGroup, type PlateBedOption } from './plateBedOptions';

const GROUP_KEY: Record<PlateBedGroup, TranslationKey> = {
  project: 'plates.bed.project',
  current: 'plates.bed.current',
  builtin: 'plates.bed.builtin',
  mine: 'plates.bed.mine',
};
const GROUPS: PlateBedGroup[] = ['project', 'current', 'builtin', 'mine'];

export const PlateBedPicker: React.FC<{ plateId: string | null; onClose: () => void }> = ({ plateId, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const plates = useKuraStore((s) => s.plates);
  const userBeds = useKuraStore((s) => s.userBedProfiles);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const plate = plates.find((p) => p.id === plateId) ?? null;
  const uid = useId();

  const model = useMemo(() => {
    if (!plate) return null;
    const base = projectBed({ printerProfile, customBedDimensions: customBed });
    return plateBedOptions(plate, { name: getLocalizedPrinterName(language, printerProfile), ...base }, userBeds ?? [], (p) => getLocalizedPrinterName(language, p));
  }, [plate, printerProfile, customBed, userBeds, language]);
  const [choice, setChoice] = useState<string | null>(model?.selected ?? null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setChoice(model?.selected ?? null), [plateId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Foco inicial en el radio marcado (no en «Cerrar»): el efecto del modal abre el diálogo antes que este.
  const selectedKey = model?.selected ?? null;
  useEffect(() => {
    if (!selectedKey) return;
    const radio = Array.from(listRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []).find((r) => r.value === selectedKey);
    radio?.focus();
  }, [plateId, selectedKey]);

  if (!plate || !model) return null;
  const dims = (o: PlateBedOption) => t(language, 'plates.bed.dims', {
    w: formatNumber(language, o.widthMm), d: formatNumber(language, o.depthMm), h: formatNumber(language, o.heightMm),
  });
  const chosen = model.options.find((o) => o.key === choice) ?? null;

  const apply = () => {
    if (!chosen) return;
    if (chosen.key !== model.selected) {
      const store = useKuraStore.getState();
      const done = store.setPlateBed(plate.id, chosen.bed);
      if (!done) store.addToast(t(language, 'plates.bed.toast.failed'), 'error');
      else store.addToast(chosen.bed ? t(language, 'plates.bed.toast.set', { name: plate.name, bed: chosen.bed.name }) : t(language, 'plates.bed.toast.project', { name: plate.name }), 'success');
    }
    onClose();
  };

  return (
    <NativeModal
      open
      onClose={onClose}
      title={t(language, 'plates.bed.dialogTitle', { name: plate.name })}
      className="kura-plate-bed-dialog"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>{t(language, 'dialog.cancel')}</button>
          <button type="button" className="kura-btn kura-btn-primary" onClick={apply} disabled={!chosen} data-testid="plate-bed-apply">
            <Printer size={14} aria-hidden="true" />
            <span>{t(language, 'plates.bed.apply')}</span>
          </button>
        </>
      }
    >
      <p className="kura-plate-bed-hint" id={`${uid}-hint`}>{t(language, 'plates.bed.dialogHint')}</p>
      <div className="kura-plate-bed-list" ref={listRef} role="group" aria-label={t(language, 'plates.bed.listLabel')} aria-describedby={`${uid}-hint ${uid}-note`}>
        {GROUPS.map((group) => {
          const items = model.options.filter((o) => o.group === group);
          if (group === 'mine' && items.length === 0) {
            return (
              <fieldset key={group} className="kura-plate-bed-group">
                <legend>{t(language, GROUP_KEY[group])}</legend>
                <p className="kura-plate-bed-empty">{t(language, 'plates.bed.mineEmpty')}</p>
              </fieldset>
            );
          }
          if (items.length === 0) return null;
          return (
            <fieldset key={group} className="kura-plate-bed-group">
              <legend>{t(language, GROUP_KEY[group])}</legend>
              {items.map((o) => (
                <label key={o.key} className="kura-plate-bed-option" data-selected={o.key === choice}>
                  <input
                    type="radio"
                    name={`${uid}-bed`}
                    value={o.key}
                    checked={o.key === choice}
                    onChange={() => setChoice(o.key)}
                    data-testid={`plate-bed-option-${o.key}`}
                    // La cama del proyecto suele ser la misma impresora que una de la lista: su nombre accesible lo distingue.
                    aria-label={o.group === 'project' ? t(language, 'plates.bed.projectOptionName', { bed: `${o.name} ${dims(o)}` }) : undefined}
                  />
                  <span className="kura-plate-bed-name">{o.name}</span>
                  <span className="kura-plate-bed-dims">{dims(o)}</span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
      <p className="kura-plate-bed-note" id={`${uid}-note`}>{t(language, 'plates.bed.relocateNote')}</p>
    </NativeModal>
  );
};
