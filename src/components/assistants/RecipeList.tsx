/**
 * @file src/components/assistants/RecipeList.tsx
 * @description Lista de asistentes: una tarjeta por receta incorporada con su nombre, descripción breve y cuántas
 * variantes trae. Los textos son los de la receta en el idioma activo; lo demás va por i18n. Cada tarjeta es un
 * botón (teclado: Tab y Enter).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { assistantRecipes, recipeCard } from './recipeFormModel';

export const RecipeList: React.FC<{ onOpen: (recipeId: string) => void }> = ({ onOpen }) => {
  const language = useKuraStore((s) => s.language);
  return (
    <div className="kura-asis-list-wrap">
      <p className="kura-gen-note">{t(language, 'asis.listIntro')}</p>
      <ul className="kura-asis-list" aria-label={t(language, 'asis.listLabel')}>
        {assistantRecipes().map((entry, k) => {
          const card = recipeCard(entry, language);
          return (
            <li key={entry.id}>
              <button
                type="button"
                id={k === 0 ? 'kura-asis-first' : undefined}
                className="kura-asis-card"
                data-recipe={entry.id}
                title={t(language, 'asis.openTip', { name: card.title })}
                onClick={() => onOpen(entry.id)}
              >
                <span className="kura-asis-card-text">
                  <span className="kura-asis-card-title">{card.title}</span>
                  {card.description && <span className="kura-asis-card-desc">{card.description}</span>}
                  {card.variantCount > 0 && <span className="kura-asis-card-meta">{t(language, 'asis.variants', { count: card.variantCount })}</span>}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
