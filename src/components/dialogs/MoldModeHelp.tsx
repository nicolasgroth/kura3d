/**
 * @file src/components/dialogs/MoldModeHelp.tsx
 * @description Ayuda de cada modo del generador de moldes: una frase que explica para qué sirve y un esquema simple
 * (SVG en línea) de lo que se obtiene. Los modos y los campos que usa cada uno viven en `moldModeFields`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { MoldMode } from '../../types/kura';
import '../../styles/genUiDialogs.css';

const HELP_KEY: Record<MoldMode, TranslationKey> = {
  direct_1part: 'genUi.mold.helpDirect1',
  direct_2part: 'genUi.mold.helpDirect2',
  silicone_master: 'genUi.mold.helpSilicone',
  core_cavity: 'genUi.mold.helpCore',
};

/** Esquema en corte lateral de lo que se obtiene (decorativo: el texto de al lado lo explica). */
const Diagram: React.FC<{ mode: MoldMode }> = ({ mode }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 96 64" aria-hidden="true" focusable="false">
      {mode === 'direct_1part' && (
        <>
          <rect x="8" y="14" width="80" height="44" rx="3" {...common} />
          <path d="M30 14 V34 Q30 46 48 46 Q66 46 66 34 V14" {...common} strokeDasharray="0" />
          <path d="M44 6 V14 M52 6 V14" {...common} />
        </>
      )}
      {mode === 'direct_2part' && (
        <>
          <path d="M8 14 H42 V58 H8 Z" {...common} />
          <path d="M54 14 H88 V58 H54 Z" {...common} />
          <path d="M42 28 Q34 36 42 44 M54 28 Q62 36 54 44" {...common} />
          <circle cx="42" cy="22" r="2" fill="currentColor" />
          <circle cx="54" cy="50" r="2" fill="currentColor" />
        </>
      )}
      {mode === 'silicone_master' && (
        <>
          <path d="M8 10 V58 H88 V10" {...common} />
          <path d="M16 38 H80" {...common} strokeDasharray="4 3" />
          <path d="M40 58 V40 Q40 26 48 26 Q56 26 56 40 V58" {...common} />
        </>
      )}
      {mode === 'core_cavity' && (
        <>
          <path d="M8 58 V12 H88 V58 Z" {...common} />
          <path d="M26 58 V26 H70 V58 Z" {...common} />
          <path d="M44 12 V6 M52 12 V6" {...common} />
        </>
      )}
    </svg>
  );
};

export const MoldModeHelp: React.FC<{ mode: MoldMode }> = ({ mode }) => {
  const language = useKuraStore((s) => s.language);
  return (
    <div className="kura-mold-help" role="note" aria-label={t(language, 'genUi.mold.diagramLabel')}>
      <Diagram mode={mode} />
      <span>{t(language, HELP_KEY[mode])}</span>
    </div>
  );
};

/** Campos del diálogo que usa cada modo (según lo que realmente consume el motor). */
export interface MoldModeFields {
  boxWall: boolean;
  splitAxis: boolean;
  keyTolerance: boolean;
  cavityWall: boolean;
  pourSpout: boolean;
}

export function moldModeFields(mode: MoldMode): MoldModeFields {
  return {
    boxWall: mode === 'silicone_master',
    splitAxis: mode === 'direct_2part',
    keyTolerance: mode === 'direct_2part',
    cavityWall: mode === 'core_cavity',
    pourSpout: mode !== 'silicone_master',
  };
}
