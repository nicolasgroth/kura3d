/**
 * @file src/components/inspector/RoleField.tsx
 * @description Tipo del objeto en el inspector (Sólido | Negativo | Referencia, un paso de deshacer cada
 * cambio) y, si es referencia, su opacidad propia (por defecto la global de Ajustes).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useState } from 'react';
import { OBJECT_ROLES, REFERENCE_OPACITY, isReference } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import { effectiveReferenceOpacity, useReferenceOpacityStore } from '../../store/referenceOpacityStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { ObjectRole, SceneObject } from '../../types/kura';
import '../../styles/reference.css';

const LABEL: Record<ObjectRole, TranslationKey> = {
  solid: 'inspector.role.solid',
  negative: 'inspector.role.hole',
  reference: 'inspector.role.reference',
};
const TIP: Partial<Record<ObjectRole, TranslationKey>> = {
  negative: 'inspector.role.holeTip',
  reference: 'inspector.role.referenceTip',
};

export const RoleField: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const groupId = useId();
  return (
    <>
      <div className="kura-field-row">
        <span className="kura-field-label" id={groupId}>{t(language, 'inspector.field.role')}</span>
        <div className="kura-segmented" role="group" aria-labelledby={groupId}>
          {OBJECT_ROLES.map((role) => {
            const tip = TIP[role];
            return (
              <button
                key={role}
                type="button"
                className={`kura-btn ${primary.role === role ? 'is-active' : ''}`}
                aria-pressed={primary.role === role}
                disabled={primary.locked}
                onClick={() => primary.role !== role && updateObjectMeta(primary.id, { role })}
                title={tip ? t(language, tip) : undefined}
              >
                {t(language, LABEL[role])}
              </button>
            );
          })}
        </div>
      </div>
      {isReference(primary) && <ReferenceOpacityField primary={primary} />}
    </>
  );
};

/** Deslizador de opacidad: se ve en vivo y deja un solo paso de deshacer al soltar. */
const ReferenceOpacityField: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const fallback = useReferenceOpacityStore((s) => s.defaultOpacity);
  const stored = effectiveReferenceOpacity(primary, fallback);
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);
  const id = useId();
  const commit = () => {
    if (Math.abs(draft - stored) > 1e-6) updateObjectMeta(primary.id, { referenceOpacity: draft });
  };
  const percent = new Intl.NumberFormat(language, { style: 'percent' }).format(draft);
  return (
    <div className="kura-form-field kura-reference-opacity">
      <label htmlFor={id}>{t(language, 'reference.opacity')}</label>
      <div className="kura-reference-opacity-row">
        <input
          id={id}
          type="range"
          min={REFERENCE_OPACITY.min}
          max={REFERENCE_OPACITY.max}
          step={0.05}
          value={draft}
          aria-valuetext={percent}
          disabled={primary.locked}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        <output htmlFor={id}>{percent}</output>
      </div>
      {primary.referenceOpacity !== undefined && (
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={primary.locked}
          onClick={() => updateObjectMeta(primary.id, { referenceOpacity: undefined })}
        >
          {t(language, 'reference.opacity.reset')}
        </button>
      )}
    </div>
  );
};
