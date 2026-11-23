/**
 * @file src/components/contextPanel/ProjectSummary.tsx
 * @description Contexto «Proyecto» del panel derecho (sin selección): nombre, archivo, estado de guardado,
 * cantidad de objetos, cama activa y unidades, con acceso a cambiar unidades o cama; debajo, la leyenda de
 * filamentos y las operaciones de escena (acomodar en cuadrícula, aplicar restas). Solo muestra datos que el
 * proyecto ya tiene: no hay descripción ni fechas en el modelo de datos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Combine, Grid, Ruler } from 'lucide-react';
import { isNegative, isSolid } from '../../core/scene/objectRole';
import { getLocalizedPrinterName, t } from '../../i18n';
import { isProjectDirty, useKuraStore } from '../../store/useKuraStore';
import { formatDimension } from '../../utils/units';
import { toUserSize } from '../../core/scene/displayAxes';
import { FilamentLegendCard } from '../inspector/FilamentLegendCard';

export const ProjectSummary: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const projectName = useKuraStore((s) => s.projectName);
  const projectLocation = useKuraStore((s) => s.projectLocation);
  const objects = useKuraStore((s) => s.objects);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const custom = useKuraStore((s) => s.customBedDimensions);
  const dirty = useKuraStore(isProjectDirty);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const requestMeasuresPopover = useKuraStore((s) => s.requestMeasuresPopover);
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);

  const visible = objects.filter((o) => o.visible);
  const canApplyHoles = visible.some(isNegative) && visible.some(isSolid);
  // Tamaño interno [x, y(alto), z]; toUserSize lo entrega como ancho × fondo × alto del usuario.
  const bed = toUserSize(custom ? [custom.width, custom.height, custom.depth] : [printerProfile.bedWidthMm, printerProfile.maxHeightMm, printerProfile.bedDepthMm]);
  const bedSize = bed.map((mm) => formatDimension(mm, unitSystem, 0, language)).join(' × ');
  const name = projectName ?? t(language, 'app.untitled');

  return (
    <>
      <section className="kura-card" data-testid="panel-project">
        <p className="kura-ctx-hint">{t(language, 'inspector.emptyTitle')}</p>
        <dl className="kura-ctx-facts">
          <dt>{t(language, 'panel.project.name')}</dt>
          <dd title={name}>{name}</dd>
          {projectLocation && (
            <>
              <dt>{t(language, 'panel.project.location')}</dt>
              <dd title={projectLocation}>{projectLocation}</dd>
            </>
          )}
          <dt>{t(language, 'panel.project.state')}</dt>
          <dd>{t(language, dirty ? 'panel.project.unsaved' : 'panel.project.saved')}</dd>
          <dt>{t(language, 'panel.project.objects')}</dt>
          <dd data-testid="panel-project-count">{objects.length}</dd>
          <dt>{t(language, 'panel.project.bed')}</dt>
          <dd title={`${getLocalizedPrinterName(language, printerProfile)} · ${bedSize}`}>
            {getLocalizedPrinterName(language, printerProfile)}
            <span className="kura-ctx-sub">{bedSize}</span>
          </dd>
          <dt>{t(language, 'panel.project.units')}</dt>
          <dd>{unitSystem}</dd>
        </dl>
        <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'panel.project.change')} onClick={() => requestMeasuresPopover('printer')}>
          <Ruler size={13} aria-hidden="true" />
          <span>{t(language, 'panel.project.change')}</span>
        </button>
        <p className="kura-ctx-hint">{t(language, 'panel.project.hint')}</p>
      </section>

      <FilamentLegendCard />

      {objects.length > 0 && (
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'inspector.pro.arrangeGrid')} onClick={() => alignSelectedObjects('arrange_grid')}>
            <Grid size={13} aria-hidden="true" />
            <span>{t(language, 'inspector.pro.arrangeGrid')}</span>
          </button>
        </section>
      )}

      {canApplyHoles && (
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.op.booleanTitle')}</h3>
          <button type="button" className="kura-btn kura-btn-amber" disabled={Boolean(busyOperation)} title={t(language, 'inspector.op.applyHoles')} onClick={() => void applyHolesOnSolids()}>
            <Combine size={14} aria-hidden="true" />
            <span>{t(language, 'inspector.op.applyHoles')}</span>
          </button>
        </section>
      )}
    </>
  );
};
