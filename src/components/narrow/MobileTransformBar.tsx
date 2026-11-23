/**
 * @file src/components/narrow/MobileTransformBar.tsx
 * @description Barra compacta sobre el visor en pantallas estrechas (<= 900 px) con Mover, Rotar, Escalar y Medir
 * cuando hay un objeto seleccionado: tres botones de icono de 44x44 con nombre accesible y estado
 * `aria-pressed` (además del color, el activo lleva un marcador inferior). En escritorio no se muestra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Move, RotateCw, Ruler, Scale3d } from 'lucide-react';
import '../../styles/uxMovil.css';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { TransformMode } from '../../types/kura';

const MODES: ReadonlyArray<{ mode: TransformMode; key: 'translate' | 'rotate' | 'scale'; Icon: typeof Move }> = [
  { mode: 'translate', key: 'translate', Icon: Move },
  { mode: 'rotate', key: 'rotate', Icon: RotateCw },
  { mode: 'scale', key: 'scale', Icon: Scale3d },
];

/** `hidden`: con la hoja a altura completa no hay visor útil y la barra se solaparía con la cámara del HUD. */
export const MobileTransformBar: React.FC<{ hidden?: boolean }> = ({ hidden = false }) => {
  const language = useKuraStore((s) => s.language);
  const transformMode = useKuraStore((s) => s.transformMode);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const hasSelection = useKuraStore((s) => s.selectedIds.length > 0);
  if (hidden || !hasSelection || activeTool === 'paint' || activeTool === 'measure') return null;

  return (
    <div className="kura-mobile-transform" role="toolbar" aria-label={t(language, 'uxm.transform.group')}>
      {MODES.map(({ mode, key, Icon }) => {
        const label = t(language, `viewport.gizmo.${key}`);
        return (
          <button
            key={mode}
            type="button"
            className={`kura-btn kura-btn-icon ${transformMode === mode ? 'is-active' : ''}`}
            aria-pressed={transformMode === mode}
            aria-label={label}
            title={label}
            onClick={() => setTransformMode(mode)}
          >
            <Icon size={20} aria-hidden="true" />
          </button>
        );
      })}
      <span className="kura-mobile-transform-sep" aria-hidden="true" />
      <button
        type="button"
        className="kura-btn kura-btn-icon"
        aria-label={t(language, 'topbar.tool.measure')}
        title={t(language, 'topbar.tool.measureTip')}
        onClick={() => setActiveTool('measure')}
      >
        <Ruler size={20} aria-hidden="true" />
      </button>
    </div>
  );
};
