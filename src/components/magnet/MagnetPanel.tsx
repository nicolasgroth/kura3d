/**
 * @file src/components/magnet/MagnetPanel.tsx
 * @description Panel de operación «Alojamiento de imán» (no modal, en el lugar del inspector, como Texto 3D y
 * Asistentes). Mientras está abierto, un clic sobre una cara de una pieza coloca el hueco (ver
 * `MagnetPlacementLayer`); muestra cómo colocar, los preajustes, los campos del imán y la pared del último colocado.
 * Se cierra con «Listo», su X o Escape.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback } from 'react';
import { MIN_WALL_MM } from '../../core/addons/magnetPocket';
import { t } from '../../i18n';
import { closeMagnetPanel, useMagnetPanel } from '../../store/magnetPanel';
import { magnetWarnings, magnetWarningText, wallWarningKey } from '../../store/magnetWarnings';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { MagnetFoldStrip } from './MagnetFoldStrip';
import { MagnetForm } from './MagnetForm';
import { MagnetPresetPicker } from './MagnetPresetPicker';
import '../../styles/magnetPanel.css';

export const MagnetPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useMagnetPanel((s) => s.open);
  const lastWall = useMagnetPanel((s) => s.lastWall);
  const blocked = useMagnetPanel((s) => s.blocked);
  const close = useCallback(() => closeMagnetPanel(), []);
  const warn = lastWall ? wallWarningKey(lastWall) : null;
  // Avisos además del de pared (imán que sobresale en una curva, hueco pegado a otro): una línea cada uno.
  const extra = lastWall ? magnetWarnings(lastWall, language).filter((w) => w.kind !== 'wall') : [];
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });

  return (
    <>
    {open && <MagnetFoldStrip />}
    <OperationPanel
      open={open}
      onClose={close}
      title={t(language, 'magnet.title')}
      className="kura-magnet-panel"
      initialFocus='[data-testid="magnet-preset"]'
      footer={(
        <button type="button" className="kura-btn kura-btn-sm kura-btn-primary" data-testid="magnet-done" onClick={close}>
          {t(language, 'magnet.done')}
        </button>
      )}
    >
      <p className="kura-magnet-hint" role="status" data-testid="magnet-hint">
        {t(language, blocked ? 'magnet.invalid' : 'magnet.hint')}
      </p>
      <MagnetPresetPicker />
      <MagnetForm />
      {lastWall && (
        <p className={`kura-magnet-wall${warn ? ' is-warning' : ''}`} role="status" data-testid="magnet-wall">
          {warn
            ? t(language, warn, { wall: fmt(lastWall.minWallMm), min: fmt(MIN_WALL_MM) })
            : t(language, 'magnet.lastWall', { wall: fmt(lastWall.minWallMm) })}
        </p>
      )}
      {extra.map((w) => (
        <p key={w.kind} className="kura-magnet-wall is-warning" role="status" data-testid={`magnet-warn-${w.kind}`}>
          {magnetWarningText(w, language)}
        </p>
      ))}
    </OperationPanel>
    </>
  );
};
