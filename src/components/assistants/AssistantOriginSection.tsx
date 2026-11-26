/**
 * @file src/components/assistants/AssistantOriginSection.tsx
 * @description Ficha del inspector «Creada con un asistente»: aparece en las piezas que generó una receta (donde antes la
 * pieza se veía sin parámetros) y ofrece «Editar con el asistente», que reabre el formulario con las respuestas guardadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { WandSparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { openAssistantEdit } from './editActions';
import { findAssistantRecipe, recipeCard } from './recipeFormModel';
import '../../styles/assistantsPreview.css';

export const AssistantOriginSection: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const busy = useKuraStore((s) => Boolean(s.busyOperation || s.projectBusy));
  const prov = primary.metadata?.recipe;
  if (!prov) return null;
  const entry = findAssistantRecipe(prov.id);
  const name = entry ? recipeCard(entry, language).title : prov.id;
  const title = t(language, 'asis.edit.section');
  return (
    <section className="kura-card" aria-label={title}>
      <h3 className="kura-section-label">{title}</h3>
      <p className="kura-field-label kura-asis-edit-note">{t(language, 'asis.edit.sectionNote', { name })}</p>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={busy || primary.locked}
        title={t(language, 'asis.edit.tip')}
        onClick={() => openAssistantEdit(primary.id)}
      >
        <WandSparkles size={13} aria-hidden="true" />
        <span>{t(language, 'asis.edit.action')}</span>
      </button>
    </section>
  );
};
