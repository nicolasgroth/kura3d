/**
 * @file src/components/split/SplitOverlays.tsx
 * @description Capas HTML de "dividir para imprimir" sobre el visor: el panel (según
 * `activeDialog`), el aviso discreto cuando la pieza seleccionada no cabe en la cama de su placa y el
 * control "Armado" de un grupo dividido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isSolid } from '../../core/scene/objectRole';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Grid3x3 } from 'lucide-react';
import { t } from '../../i18n';
import { toUserSize } from '../../core/scene/displayAxes';
import { exceedsBed } from '../../core/scene/splitGroups';
import { findPlate, plateBed } from '../../core/scene/plates';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';
import type { Vec3 } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import { computeWorldBounds } from '../viewport/viewportHelpers';
import { SplitAssemblyControl } from './SplitAssemblyControl';
import { SplitForBedPanel } from './SplitForBedPanel';
import '../../styles/splitForBed.css';

/** Aviso "No cabe en la cama (X × Y × Z mm)" con el botón para dividir. */
export const SplitFitNotice: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const activeDialog = useKuraStore((s) => s.activeDialog);
  // Con la cama oculta («Sin cama») el aviso de tamaño no se muestra como alarma; reaparece al mostrarla.
  const showBed = useKuraStore((s) => s.showBed);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const plates = useKuraStore((s) => s.plates);

  const [collapsed, setCollapsed] = useState(false);
  const obj = selectedIds.length === 1 ? objects.find((o) => o.id === selectedIds[0]) ?? null : null;
  const size = useMemo<Vec3 | null>(() => {
    if (!obj || !isSolid(obj) || obj.metadata?.split) return null;
    const b = computeWorldBounds(obj);
    return [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ];
  }, [obj]);
  // La cama de la placa de la pieza (la propia si la tiene); sin placa, la del proyecto.
  const bed = plateBed(findPlate(plates, obj?.plateRef), activeBed({ printerProfile, customBedDimensions: customBed }));
  if (!obj || !size || activeDialog === 'splitForBed' || !showBed || !exceedsBed(size, bed)) return null;
  // `size` está en ejes del motor (Y arriba): se muestra en los del usuario (X × Y × Z, Z = altura)
  const dims = toUserSize(size).map((v) => formatNumber(language, v, { maximumFractionDigits: 0 })).join(' × ');
  // Con varias placas, el aviso dice de qué placa es la cama que no alcanza.
  const plate = plates.length > 1 ? findPlate(plates, obj.plateRef) : null;
  const notice = plate ? t(language, 'plates.split.notice', { plate: plate.name, size: dims }) : t(language, 'split.notice', { size: dims });

  return (
    <div className="kura-split-notice" role="status" data-collapsed={collapsed || undefined}>
      <button
        type="button"
        className="kura-split-notice-toggle"
        aria-expanded={!collapsed}
        aria-label={t(language, collapsed ? 'split.noticeExpand' : 'split.noticeCollapse')}
        title={t(language, collapsed ? 'split.noticeExpand' : 'split.noticeCollapse')}
        onClick={() => setCollapsed((c) => !c)}
      >
        <AlertTriangle size={13} aria-hidden="true" />
      </button>
      {!collapsed && <span>{notice}</span>}
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        disabled={busy || obj.locked}
        title={t(language, 'split.openTip')}
        aria-keyshortcuts="Shift+C"
        onClick={() => setActiveDialog('splitForBed')}
      >
        <Grid3x3 size={13} aria-hidden="true" />
        <span>{t(language, 'split.open')}</span>
      </button>
    </div>
  );
};

export const SplitOverlays: React.FC = () => {
  const open = useKuraStore((s) => s.activeDialog === 'splitForBed');
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  return (
    <>
      <SplitFitNotice />
      <SplitAssemblyControl />
      <SplitForBedPanel
        open={open}
        onClose={() => {
          if (useKuraStore.getState().activeDialog === 'splitForBed') setActiveDialog(null);
        }}
      />
    </>
  );
};
