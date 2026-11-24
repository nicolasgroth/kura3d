/**
 * @file src/components/assistants/EditProblem.tsx
 * @description Explica por qué no se puede reabrir una pieza con su asistente (la receta ya no existe o cambió de versión
 * mayor) y ofrece crear una pieza nueva: con la receta, si sigue existiendo, o desde la lista de asistentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { CircleAlert, WandSparkles } from 'lucide-react';
import { t } from '../../i18n';
import { showAssistantRecipe } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { AssistantEditPlan } from './editPlan';
import { findAssistantRecipe, recipeCard } from './recipeFormModel';
import '../../styles/assistantsPreview.css';

export const EditProblem: React.FC<{ plan: Exclude<AssistantEditPlan, { status: 'ok' }> }> = ({ plan }) => {
  const language = useKuraStore((s) => s.language);
  const entry = findAssistantRecipe(plan.recipeId);
  const name = entry ? recipeCard(entry, language).title : plan.recipeId;
  const message =
    plan.status === 'missing'
      ? t(language, 'asis.edit.missing', { name })
      : t(language, 'asis.edit.incompatible', { name, saved: plan.saved, current: plan.current });
  return (
    <div className="kura-asis-form-wrap">
      <div className="kura-asis-head">
        <h3 className="kura-asis-title">{t(language, 'asis.edit.problemTitle')}</h3>
      </div>
      <p className="kura-asis-note is-warning" role="alert">
        <CircleAlert size={13} aria-hidden="true" />
        <span>{message}</span>
      </p>
      <div className="kura-asis-edit-actions">
        <button
          type="button"
          id="kura-asis-first"
          className="kura-btn kura-btn-primary"
          title={t(language, 'asis.edit.createNewTip')}
          onClick={() => showAssistantRecipe(entry ? entry.id : null)}
        >
          <WandSparkles size={13} aria-hidden="true" />
          <span>{t(language, 'asis.edit.createNew')}</span>
        </button>
      </div>
    </div>
  );
};
