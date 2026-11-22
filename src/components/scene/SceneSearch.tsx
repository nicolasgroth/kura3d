/**
 * @file src/components/scene/SceneSearch.tsx
 * @description Campo de búsqueda de la lista de escena (F3): filtra por nombre; Enter selecciona y encuadra
 * el primer resultado; F3 / Mayús+F3 pasan al siguiente o anterior; Escape borra el texto y devuelve el foco a la lista. También expone
 * `useRevealSceneOnRequest`, que abre la pestaña Escena cuando F2 o F3 la necesitan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { matchSceneObjects } from '../../store/slices/quickActionsSlice';
import '../../styles/sceneSearch.css';

/** Una petición se atiende si es reciente (el panel puede montarse justo después de pedirla). */
export const REQUEST_FRESH_MS = 1000;

export const SceneSearch: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const filter = useKuraStore((s) => s.sceneFilter);
  const objects = useKuraStore((s) => s.objects);
  const setSceneFilter = useKuraStore((s) => s.setSceneFilter);
  const findSceneMatch = useKuraStore((s) => s.findSceneMatch);
  const focusRequest = useKuraStore((s) => s.searchFocusRequest);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const matches = matchSceneObjects(objects, filter).length;

  useEffect(() => {
    if (focusRequest && Date.now() - focusRequest.at < REQUEST_FRESH_MS) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusRequest]);

  return (
    <div className="kura-scene-search" role="search">
      <Search size={13} aria-hidden="true" className="kura-scene-search-icon" />
      <input
        ref={inputRef}
        type="text"
        className="kura-input kura-scene-search-input"
        value={filter}
        placeholder={t(language, 'scene.search.placeholder')}
        aria-label={t(language, 'scene.search.label')}
        aria-keyshortcuts="F3"
        title={t(language, 'scene.search.tip')}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setSceneFilter(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            findSceneMatch(e.shiftKey ? 'prev' : 'first');
          } else if (e.key === 'F3') {
            e.preventDefault();
            findSceneMatch(e.shiftKey ? 'prev' : 'next');
          } else if (e.key === 'Escape') {
            // Borra el texto (si hay) y devuelve el foco a la lista de escena para seguir con teclado.
            e.preventDefault();
            if (filter) setSceneFilter('');
            const list = document.querySelector<HTMLElement>('.kura-scene-list');
            if (list) list.focus();
            else inputRef.current?.blur();
          }
        }}
      />
      {filter && (
        <button
          type="button"
          className="kura-mini-icon-btn"
          aria-label={t(language, 'scene.search.clear')}
          title={t(language, 'scene.search.clear')}
          onClick={() => {
            setSceneFilter('');
            inputRef.current?.focus();
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
      <span className={matches === 0 && filter.trim() ? 'kura-scene-search-none' : 'sr-only'} role="status" aria-live="polite">
        {filter.trim() ? (matches === 0 ? t(language, 'scene.search.none') : t(language, 'scene.search.count', { count: matches, total: objects.length })) : ''}
      </span>
    </div>
  );
};

/** Abre la pestaña Escena (y el panel) cuando F2 o F3 piden la lista. */
export function useRevealSceneOnRequest(showSceneTab: () => void): void {
  const renameRequest = useKuraStore((s) => s.renameRequest);
  const focusRequest = useKuraStore((s) => s.searchFocusRequest);
  const leftCollapsed = useKuraStore((s) => s.leftCollapsed);
  const toggleLeftSidebar = useKuraStore((s) => s.toggleLeftSidebar);
  const at = Math.max(renameRequest?.at ?? 0, focusRequest?.at ?? 0);
  const n = (renameRequest?.n ?? 0) + (focusRequest?.n ?? 0);

  useEffect(() => {
    if (!at || Date.now() - at > REQUEST_FRESH_MS) return;
    showSceneTab();
    if (leftCollapsed) toggleLeftSidebar();
    // Solo al llegar una petición nueva (`n`); el resto de valores se leen vigentes en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
}
