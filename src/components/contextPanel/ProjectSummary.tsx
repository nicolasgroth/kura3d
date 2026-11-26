/**
 * @file src/components/contextPanel/ProjectSummary.tsx
 * @description Contexto «Proyecto» del panel derecho (sin selección o desde el botón «Proyecto»): nombre editable
 * en línea, archivo, estado de guardado, cantidad de objetos, y cama activa y unidades editables ahí mismo con
 * su lápiz; debajo, las acciones de archivo (Nuevo, Abrir, Guardar, Guardar como, recientes), la leyenda de
 * filamentos y las operaciones de escena (acomodar en cuadrícula, aplicar restas). Tras las acciones de archivo va la sección
 * «Datos del proyecto» (`ProjectInfoSection`: descripción, notas, autor y fechas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId } from 'react';
import { Combine, Grid } from 'lucide-react';
import { isNegative, isSolid } from '../../core/scene/objectRole';
import { getLocalizedPrinterName, t } from '../../i18n';
import { usePlateToolReason } from '../viewmode/usePlateToolReason';
import { isProjectDirty, useKuraStore } from '../../store/useKuraStore';
import { formatDimension } from '../../utils/units';
import { toUserSize } from '../../core/scene/displayAxes';
import { FilamentLegendCard } from '../inspector/FilamentLegendCard';
import { BedProfileSelect } from '../fitToBed/BedProfileSelect';
import { UNIT_OPTIONS } from '../settings/MeasuresFields';
import type { UnitSystem } from '../../types/kura';
import { InlineFactEditor } from './InlineFactEditor';
import { ProjectFileActions } from './ProjectFileActions';
import { ProjectInfoSection } from './ProjectInfoSection';
import { ProjectNameField } from './ProjectNameField';

export const ProjectSummary: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const projectLocation = useKuraStore((s) => s.projectLocation);
  const objects = useKuraStore((s) => s.objects);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const custom = useKuraStore((s) => s.customBedDimensions);
  const dirty = useKuraStore(isProjectDirty);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const setUnitSystem = useKuraStore((s) => s.setUnitSystem);
  const unitSelectId = useId();
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const plateReason = usePlateToolReason();
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);

  const visible = objects.filter((o) => o.visible);
  const canApplyHoles = visible.some(isNegative) && visible.some(isSolid);
  // Tamaño interno [x, y(alto), z]; toUserSize lo entrega como ancho × fondo × alto del usuario.
  const bed = toUserSize(custom ? [custom.width, custom.height, custom.depth] : [printerProfile.bedWidthMm, printerProfile.maxHeightMm, printerProfile.bedDepthMm]);
  const bedSize = bed.map((mm) => formatDimension(mm, unitSystem, 0, language)).join(' × ');
  const printerName = getLocalizedPrinterName(language, printerProfile);

  return (
    <>
      <section className="kura-card" data-testid="panel-project">
        <p className="kura-ctx-hint">{t(language, 'inspector.emptyTitle')}</p>
        <dl className="kura-ctx-facts">
          <dt>{t(language, 'panel.project.name')}</dt>
          <dd className="kura-fact-dd" data-testid="panel-project-name"><ProjectNameField /></dd>
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
          <dd className="kura-fact-dd">
            <InlineFactEditor
              help="project.bed"
              testId="panel-project-bed-edit"
              title={`${printerName} · ${bedSize}`}
              value={<>{printerName}<span className="kura-ctx-sub">{bedSize}</span></>}
            >
              <BedProfileSelect />
            </InlineFactEditor>
          </dd>
          <dt>{t(language, 'panel.project.units')}</dt>
          <dd className="kura-fact-dd">
            <InlineFactEditor help="project.units" testId="panel-project-units-edit" value={unitSystem}>
              <label className="kura-field-label" htmlFor={unitSelectId}>{t(language, 'dialog.settings.unitLabel')}</label>
              <select id={unitSelectId} className="kura-select" value={unitSystem} onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}>
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </InlineFactEditor>
          </dd>
        </dl>
        <p className="kura-ctx-hint">{t(language, 'panel.project.hint')}</p>
      </section>

      <ProjectFileActions />

      <ProjectInfoSection />

      <FilamentLegendCard />

      {objects.length > 0 && (
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
          <button type="button" className="kura-btn kura-btn-sm" disabled={Boolean(plateReason)} title={plateReason ?? t(language, 'inspector.pro.arrangeGrid')} onClick={() => alignSelectedObjects('arrange_grid')}>
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
