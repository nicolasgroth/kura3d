/**
 * @file src/components/assistants/assistantPaletteItems.tsx
 * @description Entradas de la paleta de comandos para los asistentes: «Asistentes» (abre la lista) y una por receta
 * incorporada, con el nombre de la receta en el idioma activo (abre directo su formulario).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { WandSparkles } from 'lucide-react';
import { t } from '../../i18n';
import { openAssistants } from '../../store/assistantsPanel';
import type { LanguageCode } from '../../types/kura';
import { assistantRecipes, recipeCard } from './recipeFormModel';

export interface AssistantPaletteItem {
  id: string;
  label: string;
  category: string;
  keywords: string;
  kind: 'local';
  icon: React.ReactNode;
  run: () => void;
}

export function assistantPaletteItems(language: LanguageCode, category: string): AssistantPaletteItem[] {
  const keywords = t(language, 'asis.cmd.keywords');
  return [
    {
      id: 'gen-assistants',
      label: t(language, 'asis.title'),
      category,
      keywords,
      kind: 'local',
      icon: <WandSparkles size={15} />,
      run: () => openAssistants(),
    },
    ...assistantRecipes().map((entry) => {
      const name = recipeCard(entry, language).title;
      return {
        id: `gen-assistant-${entry.id}`,
        label: t(language, 'asis.cmd.recipe', { name }),
        category,
        keywords: `${keywords} ${name}`,
        kind: 'local' as const,
        icon: <WandSparkles size={15} />,
        run: () => openAssistants(entry.id),
      };
    }),
  ];
}
