/**
 * @file src/components/viewport/GizmoDragReadout.tsx
 * @description Etiqueta junto al cursor mientras se arrastra el gizmo: ΔX/ΔY/ΔZ en la unidad activa al
 * mover, grados y eje al rotar, % por eje al escalar, siempre en ejes del usuario. El cálculo vive en
 * `core/scene/dragReadout.ts`; aquí solo se sigue el cursor y se formatea.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { dragReadout } from '../../core/scene/dragReadout';
import { useGizmoDragStore } from '../../store/gizmoDragStore';
import { useKuraStore } from '../../store/useKuraStore';
import { formatAngle } from '../../utils/measureUnits';
import { fromMm } from '../../utils/units';
import '../../styles/gizmoDragReadout.css';

const signed = (value: number, decimals: number, lang: string) => {
  const safe = Math.abs(value) < 10 ** -decimals / 2 ? 0 : value;
  const text = new Intl.NumberFormat(lang, { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(Math.abs(safe));
  return `${safe < 0 ? '−' : safe > 0 ? '+' : ''}${text}`;
};

export const GizmoDragReadout: React.FC = () => {
  const start = useGizmoDragStore((s) => s.start);
  const plane = useGizmoDragStore((s) => s.plane);
  const axis = useGizmoDragStore((s) => s.axis);
  const language = useKuraStore((s) => s.language);
  const unit = useKuraStore((s) => s.unitSystem);
  const current = useKuraStore((s) => (start ? s.objects.find((o) => o.id === start.id) ?? null : null));
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!start) {
      setCursor(null);
      return;
    }
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove, true);
    return () => window.removeEventListener('pointermove', onMove, true);
  }, [start]);

  if (!start || !current) return null;
  const read = dragReadout(start.mode, start, current);
  let text: string;
  if (read.kind === 'move') {
    const [x, y, z] = read.deltaMm.map((v) => signed(fromMm(v, unit), unit === 'mm' ? 1 : 3, language));
    text = t(language, 'uxEscena.drag.move', { x, y, z, unit });
  } else if (read.kind === 'rotate') {
    text = t(language, 'uxEscena.drag.rotate', { axis: read.axis, deg: formatAngle(read.deg, language).replace('°', '') });
  } else {
    const [x, y, z] = read.pct.map((v) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(v));
    text = t(language, 'uxEscena.drag.scale', { x, y, z });
  }

  // Junto al cursor; sin posición (teclado o antes del primer movimiento), arriba al centro del visor.
  const style: React.CSSProperties = cursor
    ? { left: Math.min(cursor.x + 18, window.innerWidth - 260), top: Math.min(cursor.y + 18, window.innerHeight - 40) }
    : { left: '50%', top: 72, transform: 'translateX(-50%)' };

  return (
    <div className="kura-drag-readout" style={style} role="status" aria-live="off" aria-label={t(language, 'uxEscena.drag.label')} data-testid="gizmo-drag-readout">
      {axis ? `${text} · ${t(language, 'uxEscena.drag.axis', { axis })}` : plane ? `${text} · ${t(language, 'uxEscena.drag.plane', { plane })}` : text}
    </div>
  );
};
