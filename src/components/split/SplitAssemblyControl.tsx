/**
 * @file src/components/split/SplitAssemblyControl.tsx
 * @description Control "Armado" del grupo dividido de la pieza seleccionada: deslizador de 0 %
 * (armado) a 100 % (explosionado) con reproducir/pausar que anima ida y vuelta (solo visual), y los
 * botones "Preparar para imprimir" y "Volver a armar" (un paso de deshacer cada uno).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Boxes, Pause, Play, Printer } from 'lucide-react';
import { t } from '../../i18n';
import { tCount } from '../../utils/plural';
import { splitArrangementOf, splitGroupOf, splitPlateCount } from '../../core/scene/splitGroups';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';
import { SplitLabelsToggle } from './SplitLabelsToggle';

/** Duración de una ida (armado → explosionado) en ms. */
const HALF_CYCLE_MS = 1600;

/** Factor de la animación ida y vuelta en el instante `elapsed` (0 → 1 → 0, suavizado). */
export function pingPongFactor(elapsedMs: number, halfCycleMs = HALF_CYCLE_MS): number {
  const phase = (elapsedMs / halfCycleMs) % 2;
  const linear = phase <= 1 ? phase : 2 - phase;
  return 0.5 - 0.5 * Math.cos(Math.PI * linear);
}

export const SplitAssemblyControl: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const selectedId = useKuraStore((s) => (s.selectedIds.length >= 1 ? s.selectedIds[0] : null));
  const objects = useKuraStore((s) => s.objects);
  const explode = useKuraStore((s) => s.splitExplode);
  const setExplode = useKuraStore((s) => s.setSplitExplode);
  const arrange = useKuraStore((s) => s.arrangeSplitGroup);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const bedWidth = useKuraStore((s) => activeBed(s).widthMm);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const uid = useId();

  const group = splitGroupOf(objects, selectedId);
  const groupId = group?.groupId ?? null;
  const arrangement = group ? splitArrangementOf(group, bedWidth) : null;
  const factor = explode && explode.groupId === groupId ? explode.factor : 0;

  // Al salir del grupo, la vista vuelve a armado y la animación se detiene.
  useEffect(() => {
    if (!groupId || arrangement !== 'assembly') {
      setPlaying(false);
      if (useKuraStore.getState().splitExplode) setExplode(null);
    }
  }, [groupId, arrangement, setExplode]);

  useEffect(() => {
    if (!playing || !groupId) return;
    const start = performance.now() - (factor > 0 ? Math.acos(1 - 2 * factor) / Math.PI * HALF_CYCLE_MS : 0);
    const tick = (now: number) => {
      setExplode(groupId, pingPongFactor(now - start));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    // El factor inicial solo se lee al arrancar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, groupId, setExplode]);

  if (!group || !selectedId) return null;
  const pct = Math.round(factor * 100);
  const plates = splitPlateCount(group);
  const canExplode = arrangement === 'assembly';

  return (
    <section className="kura-split-assembly" aria-label={t(language, 'split.assembly.title')}>
      <div className="kura-split-assembly-head">
        <strong>{t(language, 'split.assembly.title')}</strong>
        <span className="kura-cut-hint">{tCount(language, { one: 'splitUx.parts.one', other: 'splitUx.parts.other' }, group.parts.length)} · {tCount(language, { one: 'splitUx.plates.one', other: 'splitUx.plates.other' }, plates)}</span>
      </div>
      <div className="kura-split-assembly-row">
        <button
          type="button"
          className="kura-mini-icon-btn"
          disabled={!canExplode}
          aria-pressed={playing}
          aria-label={t(language, playing ? 'split.assembly.pause' : 'split.assembly.play')}
          title={t(language, canExplode ? (playing ? 'split.assembly.pause' : 'split.assembly.play') : 'split.assembly.onlyAssembled')}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
        <label htmlFor={`${uid}-explode`} className="sr-only">
          {t(language, 'splitUx.explode.label')}
        </label>
        <input
          id={`${uid}-explode`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={!canExplode}
          aria-label={t(language, 'splitUx.explode.label')}
          aria-valuetext={t(language, 'split.assembly.valueText', { pct })}
          title={t(language, canExplode ? 'split.assembly.sliderTip' : 'split.assembly.onlyAssembled')}
          onChange={(e) => {
            setPlaying(false);
            setExplode(group.groupId, Number(e.target.value) / 100);
          }}
        />
        <span className="kura-split-assembly-pct" aria-hidden="true">{pct} %</span>
      </div>
      <div className="kura-split-assembly-row">
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={busy || arrangement === 'print'}
          aria-pressed={arrangement === 'print'}
          title={t(language, 'split.assembly.printTip')}
          onClick={() => {
            setPlaying(false);
            arrange(selectedId, 'print');
          }}
        >
          <Printer size={13} aria-hidden="true" />
          <span>{t(language, 'split.assembly.print')}</span>
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={busy || arrangement === 'assembly'}
          aria-pressed={arrangement === 'assembly'}
          title={t(language, 'split.assembly.assembleTip')}
          onClick={() => {
            setPlaying(false);
            arrange(selectedId, 'assembly');
          }}
        >
          <Boxes size={13} aria-hidden="true" />
          <span>{t(language, 'split.assembly.assemble')}</span>
        </button>
      </div>
      <SplitLabelsToggle />
    </section>
  );
};
