/**
 * @file src/components/magnet/MagnetFoldStrip.tsx
 * @description Franja compacta del alojamiento de imán para la hoja inferior plegada (móvil): con el panel oculto
 * deja a la vista el último aviso y el botón «Listo». Solo se muestra con la hoja plegada (ver `magnetPanel.css`);
 * en el resto de tamaños y estados no ocupa nada. La torreta la reutiliza con sus textos y su cierre (props opcionales).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { closeMagnetPanel } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';

export interface FoldStripProps {
  onDone?: () => void;
  /** Prefijo de textos (`magnet.fold.label`, `magnet.fold.empty`, `magnet.done`) y de `data-testid`. */
  prefix?: 'magnet' | 'turret' | 'keyhole' | 'cable';
}

export const MagnetFoldStrip: React.FC<FoldStripProps> = ({ onDone = closeMagnetPanel, prefix = 'magnet' }) => {
  const k = (s: string) => `${prefix}.${s}` as TranslationKey;
  const language = useKuraStore((s) => s.language);
  const last = useKuraStore((s) => s.toastHistory[s.toastHistory.length - 1]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="kura-magnet-fold" role="group" aria-label={t(language, k('fold.label'))} data-testid={`${prefix}-fold`}>
      <p className="kura-magnet-fold-text" role="status" data-testid={`${prefix}-fold-text`}>
        {last ? last.text : t(language, k('fold.empty'))}
      </p>
      <button type="button" className="kura-btn kura-btn-sm kura-btn-primary" data-testid={`${prefix}-fold-done`} onClick={onDone}>
        {t(language, k('done'))}
      </button>
    </div>,
    document.getElementById('kura-op-slot') ?? document.body,
  );
};
