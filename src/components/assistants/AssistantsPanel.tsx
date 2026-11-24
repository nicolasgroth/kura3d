/**
 * @file src/components/assistants/AssistantsPanel.tsx
 * @description Panel de operación «Asistentes» (no modal, en el lugar del inspector, como Texto 3D): muestra la lista de
 * recetas incorporadas o, con una elegida, su formulario. Se abre desde «Insertar» y desde la paleta de comandos; se
 * cierra al crear, con su botón X o con Escape desde la lista (Escape en el formulario vuelve a la lista).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback } from 'react';
import { t } from '../../i18n';
import { closeAssistants, showAssistantRecipe, useAssistantsPanel } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { RecipeForm } from './RecipeForm';
import { RecipeList } from './RecipeList';
import { findAssistantRecipe } from './recipeFormModel';

export const AssistantsPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useAssistantsPanel((s) => s.open);
  const recipeId = useAssistantsPanel((s) => s.recipeId);
  const entry = findAssistantRecipe(recipeId);
  const back = useCallback(() => showAssistantRecipe(null), []);
  return (
    <OperationPanel open={open} onClose={closeAssistants} title={t(language, 'asis.title')} className="kura-asis-panel" initialFocus="#kura-asis-first">
      {entry ? <RecipeForm key={entry.id} entry={entry} onBack={back} onCreated={closeAssistants} /> : <RecipeList onOpen={showAssistantRecipe} />}
    </OperationPanel>
  );
};
