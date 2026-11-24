/**
 * @file src/components/inspector/ModulesPanel.tsx
 * @description Panel de módulos dinámicos (+ / −) del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isNegative, isSolid } from '../../core/scene/objectRole';
import React from 'react';
import { Combine, FileUp, MinusCircle, PlusCircle } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type PrimitiveType } from '../../types/kura';
import { applyHolesLabel } from '../../store/holeScopeLabel';
import { MODULAR_PRIMITIVES } from './inspectorConstants';
import { type InspectorSectionProps } from './inspectorTypes';

/** Módulos dinámicos para cualquier forma o modelo importado. */
export const ModulesPanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const { modularShape, setModularShape } = ui;
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const addModularPrimitive = useKuraStore((s) => s.addModularPrimitive);
  const importModelAsModuleFromDialog = useKuraStore((s) => s.importModelAsModuleFromDialog);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const holeCount = objects.filter((o) => isNegative(o) && o.visible).length;
  const solidCount = objects.filter((o) => isSolid(o) && o.visible).length;
  const hasAnyHoles = holeCount > 0;
  const isBusy = Boolean(busyOperation);

  return (
    <div className="kura-form-field">
      <label htmlFor="kura-modular-shape">{t(language, 'inspector.op.modularTitle')}</label>
      <div className="kura-modular-picker">
        <select
          id="kura-modular-shape"
          className="kura-select"
          value={modularShape}
          onChange={(e) => setModularShape(e.target.value as PrimitiveType)}
        >
          {MODULAR_PRIMITIVES.map((shape) => (
            <option key={shape} value={shape}>
              {t(language, `sidebar.primitive.${shape}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={isBusy}
          onClick={() => void addModularPrimitive(modularShape, 'positive', primary.id)}
          title={t(language, 'inspector.op.modularAdd')}
        >
          <PlusCircle size={13} />
          <span>+</span>
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-amber"
          disabled={isBusy}
          onClick={() => void addModularPrimitive(modularShape, 'negative', primary.id)}
          title={t(language, 'inspector.op.modularSub')}
        >
          <MinusCircle size={13} />
          <span>−</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 4 }}>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy}
          onClick={() => void importModelAsModuleFromDialog('positive', primary.id)}
        >
          <FileUp size={12} />
          <span>{t(language, 'inspector.op.importModuleAdd')}</span>
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy}
          onClick={() => void importModelAsModuleFromDialog('negative', primary.id)}
        >
          <FileUp size={12} style={{ color: 'var(--accent-amber)' }} />
          <span>{t(language, 'inspector.op.importModuleSub')}</span>
        </button>
      </div>

      {hasAnyHoles && solidCount > 0 && (
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-amber"
          disabled={isBusy}
          onClick={() => void applyHolesOnSolids()}
        >
          <Combine size={13} />
          <span>{applyHolesLabel(language, objects, selectedIds)}</span>
        </button>
      )}
    </div>
  );
};
