/**
 * @file src/components/contextPanel/PanelResizer.tsx
 * @description Separador del borde izquierdo del panel derecho (`role="separator"`, vertical): arrastrarlo
 * ensancha o reduce el panel dentro de sus límites; con teclado, ← / → cambian el ancho (Mayús: pasos
 * mayores), Inicio y Fin van al mínimo y al máximo. Lleva su ayuda registrada para tooltip y barra de estado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { RIGHT_PANEL_KEY_STEP, RIGHT_PANEL_MAX_WIDTH, RIGHT_PANEL_MIN_WIDTH } from '../../store/rightPanelPrefs';
import { helpAttrs } from '../shell/controlHelp';

export const PanelResizer: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const width = useKuraStore((s) => s.rightPanelWidth);
  const setWidth = useKuraStore((s) => s.setRightPanelWidth);
  const drag = useRef<{ startX: number; startW: number; id: number } | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = RIGHT_PANEL_KEY_STEP * (e.shiftKey ? 4 : 1);
    // El panel está a la derecha: ← lo ensancha (el borde se mueve hacia la izquierda).
    const next: Record<string, number | undefined> = {
      ArrowLeft: width + step,
      ArrowUp: width + step,
      ArrowRight: width - step,
      ArrowDown: width - step,
      Home: RIGHT_PANEL_MIN_WIDTH,
      End: RIGHT_PANEL_MAX_WIDTH,
    };
    const value = next[e.key];
    if (value === undefined) return;
    // Las flechas no deben empujar el objeto seleccionado.
    e.preventDefault();
    e.stopPropagation();
    setWidth(value);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startW: width, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setWidth(d.startW + (d.startX - e.clientX));
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <div
      className="kura-ctx-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t(language, 'panel.resize')}
      aria-controls="kura-inspector-panel"
      aria-valuemin={RIGHT_PANEL_MIN_WIDTH}
      aria-valuemax={RIGHT_PANEL_MAX_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} px`}
      tabIndex={0}
      data-testid="panel-resizer"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      {...helpAttrs('panel.resize', language)}
    />
  );
};
