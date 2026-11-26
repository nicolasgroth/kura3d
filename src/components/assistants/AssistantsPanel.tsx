/**
 * @file src/components/assistants/AssistantsPanel.tsx
 * @description Panel de operación «Asistentes» (no modal, en el lugar del inspector, como Texto 3D): muestra la lista de
 * recetas incorporadas o, con una elegida, su formulario. Se abre desde «Insertar» y desde la paleta de comandos; se
 * cierra al crear, con su botón X o con Escape desde la lista (Escape en el formulario vuelve a la lista). Con una
 * pieza reabierta («Editar con el asistente») el formulario trae sus respuestas, o se explica por qué no se puede.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { closeAssistants, showAssistantRecipe, useAssistantsPanel } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { EditProblem } from './EditProblem';
import { RecipeForm } from './RecipeForm';
import { RecipeGallery } from './RecipeGallery';
import { findAssistantRecipe } from './recipeFormModel';

export const AssistantsPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useAssistantsPanel((s) => s.open);
  const recipeId = useAssistantsPanel((s) => s.recipeId);
  const edit = useAssistantsPanel((s) => s.edit);
  const entry = findAssistantRecipe(recipeId);
  // Al volver a la lista, el foco regresa a la tarjeta de la receta de origen (no queda en BODY).
  const returnTo = useRef<string | null>(null);
  const back = useCallback(() => {
    returnTo.current = useAssistantsPanel.getState().recipeId;
    showAssistantRecipe(null);
  }, []);
  useEffect(() => {
    const id = returnTo.current;
    if (entry || !id) return;
    returnTo.current = null;
    const handle = window.setTimeout(() => document.querySelector<HTMLElement>(`.kura-asis-card[data-recipe="${CSS.escape(id)}"]`)?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [entry]);
  return (
    <OperationPanel open={open} onClose={closeAssistants} title={t(language, 'asis.title')} className="kura-asis-panel" initialFocus="#kura-asis-first">
      {edit && edit.status !== 'ok' ? (
        <EditProblem plan={edit} />
      ) : entry ? (
        <RecipeForm
          key={`${entry.id}:${edit?.status === 'ok' ? edit.session.objectIds.join(',') : ''}`}
          entry={entry}
          {...(edit?.status === 'ok' ? { edit: edit.session } : {})}
          onBack={back}
          onCreated={closeAssistants}
        />
      ) : (
        <RecipeGallery onOpen={showAssistantRecipe} />
      )}
    </OperationPanel>
  );
};
