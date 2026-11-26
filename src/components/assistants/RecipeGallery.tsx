/**
 * @file src/components/assistants/RecipeGallery.tsx
 * @description Galería de Asistentes: tarjetas con miniatura generada (silueta isométrica de la receta con sus valores
 * por defecto), nombre, para qué sirve y categoría; filtro por categoría y búsqueda por texto. Cuadrícula navegable con
 * flechas, Inicio/Fin y Enter; filtro y búsqueda viven en un store para conservarse al entrar y volver de un asistente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Box, Home, Shapes, Tag } from 'lucide-react';
import { t } from '../../i18n';
import { setGalleryCategory, setGalleryQuery, useAssistantsGallery } from '../../store/assistantsGallery';
import { useKuraStore } from '../../store/useKuraStore';
import { filterGallery, galleryCategory, galleryHaystack, gridMove, usedCategories, type GalleryCategory, type GalleryItem } from './galleryModel';
import { assistantRecipes, recipeCard, type AssistantRecipe } from './recipeFormModel';
import { cancelThumbnails, getThumbnail, requestThumbnails, subscribeThumbnails } from './thumbnailLoader';
import '../../styles/assistantsGallery.css';

const CATEGORY_ICON = { cajas: Box, regalos: Tag, hogar: Home, otros: Shapes } as const;

interface Entry extends GalleryItem {
  readonly recipe: AssistantRecipe;
  readonly title: string;
  readonly description: string | undefined;
}

const Thumb: React.FC<{ id: string; category: GalleryCategory }> = ({ id, category }) => {
  const state = useSyncExternalStore(subscribeThumbnails, () => getThumbnail(id));
  if (state && state !== 'none') {
    return (
      <svg className="kura-asis-thumb" viewBox={`0 0 ${state.width} ${state.height}`} aria-hidden="true" focusable="false">
        {state.layers.map((layer, k) => (
          <path key={k} d={layer.d} className={`kura-thumb-s${layer.shade}`} />
        ))}
      </svg>
    );
  }
  const Icon = CATEGORY_ICON[category];
  return (
    <span className={`kura-asis-thumb is-placeholder${state === undefined ? ' is-loading' : ''}`} aria-hidden="true">
      <Icon size={30} />
    </span>
  );
};

export const RecipeGallery: React.FC<{ onOpen: (recipeId: string) => void }> = ({ onOpen }) => {
  const language = useKuraStore((s) => s.language);
  const category = useAssistantsGallery((s) => s.category);
  const query = useAssistantsGallery((s) => s.query);
  const gridRef = useRef<HTMLUListElement | null>(null);

  const entries = useMemo<Entry[]>(
    () =>
      assistantRecipes().map((recipe) => {
        const card = recipeCard(recipe, language);
        const r = recipe.validated.recipe;
        return {
          id: recipe.id,
          recipe,
          title: card.title,
          description: card.description,
          category: galleryCategory(r.category),
          haystack: galleryHaystack(card.title, card.description, (r.tags ?? []).join(' ')),
        };
      }),
    [language],
  );
  const categories = useMemo(() => usedCategories(entries), [entries]);
  const shown = filterGallery(entries, category, query);

  useEffect(() => {
    requestThumbnails(entries.map((e) => e.recipe));
    return cancelThumbnails;
  }, [entries]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('.kura-asis-card') ?? []);
    const index = buttons.findIndex((b) => b === document.activeElement);
    if (index < 0) return;
    // Columnas = tarjetas en la primera fila (la cuadrícula se adapta al ancho del panel).
    const top = buttons[0]!.offsetTop;
    const columns = Math.max(1, buttons.filter((b) => b.offsetTop === top).length);
    const next = gridMove(e.key, index, buttons.length, columns);
    if (next === null) return;
    e.preventDefault();
    buttons[next]?.focus();
  };

  const filterActive = category !== 'all' || query.trim() !== '';
  const catName = (c: GalleryCategory) => t(language, `asis.cat.${c}`);

  return (
    <div className="kura-asis-list-wrap kura-asis-gallery">
      <p className="kura-gen-note">{t(language, 'asis.listIntro')}</p>
      <div className="kura-asis-gallery-tools">
        <input
          type="search"
          className="kura-input kura-asis-search"
          value={query}
          aria-label={t(language, 'asis.gallery.search')}
          title={t(language, 'asis.gallery.search')}
          placeholder={t(language, 'asis.gallery.searchHint')}
          onChange={(e) => setGalleryQuery(e.target.value)}
        />
        <div className="kura-asis-chips" role="group" aria-label={t(language, 'asis.gallery.filter')}>
          <button
            type="button"
            className={`kura-asis-chip${category === 'all' ? ' is-active' : ''}`}
            aria-pressed={category === 'all'}
            title={t(language, 'asis.gallery.clearTip')}
            onClick={() => setGalleryCategory('all')}
          >
            {t(language, 'asis.gallery.all')}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`kura-asis-chip${category === c ? ' is-active' : ''}`}
              aria-pressed={category === c}
              title={t(language, 'asis.gallery.filterTip', { name: catName(c) })}
              onClick={() => setGalleryCategory(c)}
            >
              {catName(c)}
            </button>
          ))}
        </div>
        <p className="kura-field-hint" role="status" aria-live="polite">
          {t(language, 'asis.gallery.count', { count: shown.length })}
        </p>
      </div>
      {shown.length === 0 ? (
        <div className="kura-asis-empty">
          <p>{t(language, 'asis.gallery.empty')}</p>
          {filterActive && (
            <button
              type="button"
              className="kura-btn"
              title={t(language, 'asis.gallery.clearTip')}
              onClick={() => {
                setGalleryCategory('all');
                setGalleryQuery('');
              }}
            >
              {t(language, 'asis.gallery.clear')}
            </button>
          )}
        </div>
      ) : (
        <ul className="kura-asis-grid" ref={gridRef} aria-label={t(language, 'asis.listLabel')} onKeyDown={onKeyDown}>
          {shown.map((entry, k) => (
            <li key={entry.id}>
              <button
                type="button"
                id={k === 0 ? 'kura-asis-first' : undefined}
                className="kura-asis-card kura-asis-gcard"
                data-recipe={entry.id}
                data-category={entry.category}
                title={t(language, 'asis.openTip', { name: entry.title })}
                onClick={() => onOpen(entry.id)}
              >
                <Thumb id={entry.id} category={entry.category} />
                <span className="kura-asis-card-text">
                  <span className="kura-asis-card-title">{entry.title}</span>
                  {entry.description && <span className="kura-asis-card-desc">{entry.description}</span>}
                  <span className="kura-asis-card-meta">
                    {catName(entry.category)}
                    {entry.recipe.validated.recipe.presets?.length ? ` · ${t(language, 'asis.variants', { count: entry.recipe.validated.recipe.presets.length })}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
