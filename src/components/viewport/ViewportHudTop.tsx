/**
 * @file src/components/viewport/ViewportHudTop.tsx
 * @description HUD superior del visor: barra de vista única (`shell/ViewBar`), píldora de restas, barras
 * contextuales de pintura, medida, borrado y corte, aviso de sección y avisos. Los modos del manipulador
 * están en la barra vertical de herramientas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isNegative, isSolid } from '../../core/scene/objectRole';
import '../../styles/hudCubeClearance.css';
import React from 'react';
import { Minimize2, Scissors } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PaintToolbar } from './PaintToolbar';
import { MeasurePanel } from '../measure/MeasurePanel';
import { ViewBar } from '../shell/ViewBar';
import { ToastStack } from '../ToastStack';
import { SectionViewNotice } from './SectionViewNotice';
import '../../styles/sectionNotice.css';
import { tCount } from '../../utils/plural';

/** Stack superior del HUD (evita colisiones cuando se envuelven controles). */
export const ViewportHudTop: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const activeTool = useKuraStore((s) => s.activeTool);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const eraseRadiusMm = useKuraStore((s) => s.eraseRadiusMm);
  const setEraseRadiusMm = useKuraStore((s) => s.setEraseRadiusMm);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const holeCount = objects.filter((o) => isNegative(o) && o.visible).length;
  const solidCount = objects.filter((o) => isSolid(o) && o.visible).length;

  return (
    <div className="kura-hud-top-stack">
      {uiDensity === 'zen' && (
        <button
          type="button"
          className="kura-zen-exit-pill"
          // Vuelve a la densidad de antes (con o sin rótulos).
          onClick={() => useKuraStore.getState().toggleZenMode()}
        >
          <Minimize2 size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{t(language, 'ui.zen.exit')}</span>
        </button>
      )}

      <div className="kura-hud-top-bar">
        <ViewBar />
      </div>

      {/* Píldora booleana inteligente: aparece cuando existen huecos + sólidos */}
      {holeCount > 0 && solidCount > 0 && (
        <button
          type="button"
          className="kura-hud-card kura-boolean-fab"
          disabled={Boolean(busyOperation)}
          onClick={() => void applyHolesOnSolids()}
          title={tCount(language, { one: 'inspector.op.applyBooleansN.one', other: 'inspector.op.applyBooleansN.other' }, holeCount)}
        >
          <Scissors size={14} />
          <span>{tCount(language, { one: 'inspector.op.applyBooleansN.one', other: 'inspector.op.applyBooleansN.other' }, holeCount)}</span>
        </button>
      )}

      {/* Barra contextual de herramientas (Pintar / Tallar / Cortar) */}
      {activeTool === 'paint' && <PaintToolbar />}
      {activeTool === 'measure' && <MeasurePanel />}

      {activeTool === 'erase' && (
        <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <span>{t(language, 'viewport.erase.radius')}: {eraseRadiusMm} mm</span>
            <input
              type="range"
              min={1}
              max={25}
              step={0.5}
              value={eraseRadiusMm}
              onChange={(e) => setEraseRadiusMm(Number(e.target.value))}
            />
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t(language, 'viewport.erase.hint')}
          </span>
        </div>
      )}

      {activeTool === 'cut' && (
        <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
          <span style={{ fontSize: 11.5 }}>{t(language, 'viewport.cut.hint')}</span>
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            disabled={!selectedObj}
            onClick={() => setActiveDialog('cut')}
          >
            <Scissors size={13} />
            <span>{t(language, 'viewport.cut.openDialog')}</span>
          </button>
        </div>
      )}

      {/* Aviso de sección y toasts en la misma columna: se apilan en vez de montarse. */}
      <SectionViewNotice />
      <ToastStack />
    </div>
  );
};
