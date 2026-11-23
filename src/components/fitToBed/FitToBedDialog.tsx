/**
 * @file src/components/fitToBed/FitToBedDialog.tsx
 * @description Diálogo «Ajustar a la impresora»: cama activa con selector de perfil (y «Mis camas»),
 * tamaño actual, alternativas como tarjetas de opción (radiogroup nativo: flechas para elegir) con su
 * resultado, avisos, chequeo de medidas funcionales con «Mantener aparte» cuando es posible, vista
 * previa (fantasma) en el visor al elegir y Aplicar/Cancelar. Nada se aplica solo; Aplicar es un paso
 * de deshacer. En móvil se muestra como hoja inferior (`fitToBed.css`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fitTargets } from '../../store/slices/fitToBedSlice';
import { planFitTransforms, type FitAlternative, type FitAlternativeKind } from '../../engine/fitToBed';
import type { FitAnalysisResult } from '../../core/operations/fitOperations';
import { NativeModal } from '../NativeModal';
import { BedProfileSelect } from './BedProfileSelect';
import { FitAlternativeCard } from './FitAlternativeCard';
import { useFitFormat } from './fitFormat';
import '../../styles/fitToBed.css';

export const FitToBedDialog: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const ids = useKuraStore((s) => s.fitToBedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const objects = useKuraStore((s) => s.objects);
  const close = useKuraStore((s) => s.closeFitToBed);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<FitAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<FitAlternativeKind | null>(null);
  const groupName = useId();
  const fmt = useFitFormat();
  const open = ids !== null;
  const activeIds = useMemo(() => (ids ?? []).filter((id) => !excluded.includes(id)), [ids, excluded]);
  const noBed = !printerProfile.showPrintVolume && !customBed;

  useEffect(() => setExcluded([]), [ids]);

  useEffect(() => {
    if (!open || noBed || activeIds.length === 0) {
      setAnalysis(null);
      return;
    }
    let alive = true;
    setBusy(true);
    void useKuraStore.getState().analyzeFitToBed(activeIds).then((result) => {
      if (!alive) return;
      setBusy(false);
      setAnalysis(result);
      const pick = result?.alternatives.find((a) => a.available && a.recommended) ?? result?.alternatives.find((a) => a.available);
      setChoice(pick?.kind ?? null);
    });
    return () => {
      alive = false;
    };
    // Los objetos cuentan: si cambian (deshacer, otra edición) se recalcula.
  }, [open, noBed, activeIds, printerProfile, customBed, objects]);

  const selected: FitAlternative | undefined = analysis?.alternatives.find((a) => a.kind === choice && a.available);

  // Vista previa: transformaciones de la alternativa elegida (una pasada lineal por vértice).
  useEffect(() => {
    const { setFitPreview, objects: scene } = useKuraStore.getState();
    if (!open || !selected || selected.kind === 'split') {
      setFitPreview(null);
      return;
    }
    const targets = fitTargets(scene, activeIds);
    setFitPreview(planFitTransforms(targets, { orientationIndex: selected.orientation.index, factor: selected.factor }));
  }, [open, selected, activeIds]);

  const apply = async () => {
    if (!selected) return;
    const store = useKuraStore.getState();
    if (selected.kind === 'split') {
      close();
      store.setSelection(activeIds);
      store.setActiveDialog('splitForBed');
      return;
    }
    const done = await store.applyFitToBed(activeIds, selected.kind);
    if (done) close();
  };

  const nameOf = (id: string) => objects.find((o) => o.id === id)?.name ?? id;
  const available = analysis?.alternatives.filter((a) => a.available) ?? [];
  const unavailable = analysis?.alternatives.filter((a) => !a.available && a.reason !== 'alreadyFits') ?? [];
  const usable = analysis?.usableMm;

  return (
    <NativeModal
      open={open}
      onClose={close}
      title={t(language, 'fit.title')}
      className="kura-fit-dialog"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={close}>
            {t(language, 'fit.cancel')}
          </button>
          <button type="button" className="kura-btn kura-btn-primary" disabled={!selected || busy} onClick={() => void apply()} data-testid="fit-apply">
            <Minimize2 size={14} aria-hidden="true" />
            <span>{selected?.kind === 'split' ? t(language, 'fit.alt.split') : t(language, 'fit.apply')}</span>
          </button>
        </>
      }
    >
      {open && (
        <div className="kura-fit-body">
          <BedProfileSelect />
          {noBed && <p className="kura-fit-note" role="status">{t(language, 'fit.noBed')}</p>}
          {usable && analysis && (
            <p className="kura-fit-meta">
              <span>{t(language, 'fit.bedSize', { size: fmt.size(usable), margin: fmt.num(analysis.bed.marginMm) })}</span>
              <span>{t(language, 'fit.current', { size: fmt.size(analysis.sizeMm) })}</span>
            </p>
          )}
          {excluded.length > 0 && (
            <p className="kura-fit-note">{t(language, 'fit.keptApart', { names: excluded.map(nameOf).join(', ') })}</p>
          )}
          <p className="kura-fit-status" role="status" aria-live="polite">
            {busy ? t(language, 'fit.analyzing') : analysis?.fitsAsIs ? t(language, 'fit.fitsAsIs') : ''}
          </p>
          {available.length > 0 && (
            <fieldset className="kura-fit-options">
              <legend className="kura-section-label">{t(language, 'fit.choose')}</legend>
              {available.map((alt) => (
                <FitAlternativeCard key={alt.kind} alt={alt} name={groupName} checked={choice === alt.kind} onChoose={() => setChoice(alt.kind)} />
              ))}
            </fieldset>
          )}
          {unavailable.length > 0 && (
            <ul className="kura-fit-unavailable" aria-label={t(language, 'fit.choose')}>
              {unavailable.map((alt) => (
                <li key={alt.kind}>
                  {fmt.title(alt)}: {t(language, `fit.unavailable.${alt.reason}` as TranslationKey)}
                </li>
              ))}
            </ul>
          )}
          {analysis && analysis.functional.length > 0 && selected && selected.factor < 1 && (
            <ul className="kura-fit-functional">
              {analysis.functional.map((f) => (
                <li key={`${f.objectId}-${f.kind}`}>
                  {f.keepApart.available ? (
                    <button type="button" className="kura-btn kura-btn-small" title={t(language, 'fit.keepApartTip', { name: nameOf(f.objectId) })}
                      onClick={() => setExcluded((x) => [...x, f.objectId])}>
                      {t(language, 'fit.keepApart')}: {nameOf(f.objectId)} ({f.label})
                    </button>
                  ) : f.keepApart.reason === 'mergedInMesh' ? (
                    <span>{t(language, 'fit.keepApart.mergedInMesh')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {selected && selected.kind !== 'split' && <p className="kura-fit-note">{t(language, 'fit.preview')}</p>}
        </div>
      )}
    </NativeModal>
  );
};
